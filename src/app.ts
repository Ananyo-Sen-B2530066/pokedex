import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { pokeapiClient } from './services/pokeapiClient';
import { dataFetcher } from './services/dataFetcher';
import { WeaknessCalculator } from './services/weaknessCalculator';
import { resolveProjectPath } from './services/projectPaths';
import { GMAX_MOVES, classifyMoveKind, getGMaxMoveById, getGMaxMoveByName, getZMoveRequirement } from './services/gmaxMoves';

// True when running inside a serverless runtime (Netlify Functions, AWS Lambda,
// Vercel Functions). Nothing here ever calls app.listen — that's the local
// launcher's job (src/index.ts).
export function isServerless(): boolean {
  return !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.NETLIFY || !!process.env.VERCEL;
}

const app = express();
const calc = new WeaknessCalculator();

function zReq(name: string): { requiresMove?: { pokemon: string; requires: string } } {
  if (!name) return {};
  const req = getZMoveRequirement(name);
  return req ? { requiresMove: req } : {};
}

const UNOWN_A_OVERRIDE = resolveProjectPath(path.join('public', 'icons', 'unown-a.png')) || '';

function hasUnownAOverride(): boolean {
  return !!UNOWN_A_OVERRIDE && fs.existsSync(UNOWN_A_OVERRIDE);
}

function applyUnownAOverride(pokemon: any): any {
  if (pokemon && pokemon.id === 201 && hasUnownAOverride()) {
    return {
      ...pokemon,
      sprites: {
        ...(pokemon.sprites || {}),
        official: '/icons/unown-a.png',
        default: '/icons/unown-a.png',
      },
    };
  }
  return pokemon;
}

// Terapagos Stellar Form Terastallizes into the Stellar type (Gen IX)
// Stellar has no defensive matchups, so it takes neutral damage from every type.
function applyStellarOverride(pokemon: any): any {
  if (pokemon && pokemon.name === 'Terapagos' && pokemon.form === 'Stellar') {
    const types = [{ type: 'Stellar', slot: 1 }];
    const attackerTypes = [
      'normal', 'fire', 'water', 'grass', 'electric', 'ice',
      'fighting', 'poison', 'ground', 'flying', 'psychic',
      'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
    ];
    const weaknesses: Record<string, any> = {};
    for (const at of attackerTypes) {
      const info = calc.analyzeWeaknesses(at, ['Stellar']);
      weaknesses[at] = {
        multiplier: info.multiplier,
        category: info.category,
        description: info.description,
      };
    }
    return { ...pokemon, types, weaknesses };
  }
  return pokemon;
}

const FORM_FLAVORS_PATH = resolveProjectPath(path.join('data', 'form-flavors.json'));

function loadFormFlavors(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    if (FORM_FLAVORS_PATH && fs.existsSync(FORM_FLAVORS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(FORM_FLAVORS_PATH, 'utf-8'));
      for (const entry of Array.isArray(raw) ? raw : []) {
        const text = String(entry?.text || '').trim();
        if (entry && typeof entry.speciesId === 'number' && entry.form && text) {
          map.set(`${entry.speciesId}|${entry.form}`, text);
        }
      }
    }
  } catch (err: any) {
    console.error('Failed to load form flavors:', err.message);
  }
  return map;
}

let formFlavors = loadFormFlavors();
let formFlavorsMtimeMs = -1;

try {
  if (FORM_FLAVORS_PATH) formFlavorsMtimeMs = fs.statSync(FORM_FLAVORS_PATH).mtimeMs;
} catch {
  // File missing; will be picked up on first request
}

// Re-reads form-flavors.json whenever the file changes so edits apply without a server restart
function getFormFlavors(): Map<string, string> {
  try {
    if (FORM_FLAVORS_PATH) {
      const stat = fs.statSync(FORM_FLAVORS_PATH);
      if (stat.mtimeMs !== formFlavorsMtimeMs) {
        formFlavors = loadFormFlavors();
        formFlavorsMtimeMs = stat.mtimeMs;
      }
    }
  } catch {
    // File unreadable/missing — keep the current map
  }
  return formFlavors;
}

// Zygarde's Power Construct ability variants share the dex entry of their size form (e.g. '50-power-construct' -> '50')
function lookupFormFlavor(speciesId: number, form?: string): string | undefined {
  if (!form) return undefined;
  const map = getFormFlavors();
  const exact = map.get(`${speciesId}|${form}`);
  if (exact) return exact;
  if (form.endsWith('-power-construct')) {
    return map.get(`${speciesId}|${form.replace(/-power-construct$/, '')}`);
  }
  return undefined;
}

// Replaces a form's flavorText with its official Pokédex entry when provided
function applyFormFlavorOverride(pokemon: any): any {
  if (!pokemon || !pokemon.form) return pokemon;
  const text = lookupFormFlavor(pokemon.speciesId ?? pokemon.id, pokemon.form);
  if (text) {
    return { ...pokemon, flavorText: text };
  }
  return pokemon;
}

let LEGENDARY: Record<number, string> = {};
try {
  const legendaryPath = resolveProjectPath(path.join('data', 'legendary.json'));
  if (legendaryPath) {
    LEGENDARY = JSON.parse(fs.readFileSync(legendaryPath, 'utf8')) as Record<number, string>;
  }
} catch (err: any) {
  console.error('Failed to load legendary.json:', err.message);
}

function applyLegendaryOverride(pokemon: any): any {
  if (!pokemon) return pokemon;
  const status = LEGENDARY[pokemon.speciesId ?? pokemon.id] || null;
  return { ...pokemon, legendaryStatus: status };
}

// The 27 canonical starters (base species ids), by debut generation.
const STARTER_SPECIES_IDS = new Set<number>([
  1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501,
  650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912,
]);

// Expand the base starter ids to the full starter evolution line (base + middle +
// final), so "Starter Pokémon" matches every stage of a starter's family.
//
// Derived caches like this one are keyed to the dataFetcher's data revision so a
// long-lived process can never keep serving families/stage data computed against a
// dataset that was later replaced (or was still loading when first hit).
function isDataCurrent(cachedRevision: number): boolean {
  return dataFetcher.getStatus().phase === 'ready' && dataFetcher.getDataRevision() === cachedRevision;
}

let STARTER_FAMILY_IDS: Set<number> | null = null;
let STARTER_FAMILY_REVISION = -1;
function getStarterFamilyIds(): Set<number> {
  if (STARTER_FAMILY_IDS && isDataCurrent(STARTER_FAMILY_REVISION)) return STARTER_FAMILY_IDS;
  const family = new Set<number>(STARTER_SPECIES_IDS);
  for (const id of STARTER_SPECIES_IDS) {
    const chain = dataFetcher.getEvolutionChainForSpecies(id);
    if (!chain) continue;
    for (const n of chain.nodes) {
      family.add(n.speciesId);
      (n.continuesTo || []).forEach(cid => family.add(cid));
    }
  }
  if (dataFetcher.getStatus().phase === 'ready') {
    STARTER_FAMILY_REVISION = dataFetcher.getDataRevision();
    STARTER_FAMILY_IDS = family;
  }
  return family;
}

let STAGE_SETS: { finalStage: Set<number>; firstStage: Set<number>; middleStage: Set<number> } | null = null;
let STAGE_SETS_REVISION = -1;
function getStageSets() {
  if (STAGE_SETS && isDataCurrent(STAGE_SETS_REVISION)) return STAGE_SETS;
  const sets = dataFetcher.getStageSets();
  if (dataFetcher.getStatus().phase === 'ready') {
    STAGE_SETS_REVISION = dataFetcher.getDataRevision();
    STAGE_SETS = sets;
  }
  return sets;
}

// The 9 canonical pseudo-legendary lines: their final evolution form species ids.
const PSEUDO_LEGENDARY_SPECIES_IDS = new Set<number>([
  149, // Dragonite
  248, // Tyranitar
  373, // Salamence
  376, // Metagross
  445, // Garchomp
  635, // Hydreigon
  706, // Goodra
  784, // Kommo-o
  887, // Dragapult
  998, // Baxcalibur
]);

// Resolver that maps a speciesId to its direct evolution neighbours and the
// metadata (number of evolutions, line size, trigger, item, min level) needed
// to craft hints WITHOUT revealing the target's name or its partners' names.
let EVO_RESOLVER: {
  parents: Map<number, number[]>;
  children: Map<number, number[]>;
  node: Map<number, { trigger?: string; item?: string; minLevel?: number }>;
} | null = null;
let EVO_RESOLVER_REVISION = -1;
function getEvoResolver() {
  if (EVO_RESOLVER && isDataCurrent(EVO_RESOLVER_REVISION)) return EVO_RESOLVER;
  const parents = new Map<number, number[]>();
  const children = new Map<number, number[]>();
  const node = new Map<number, { trigger?: string; item?: string; minLevel?: number }>();
  const processed = new Set<number>();
  const seenParentChild = new Set<string>();
  LINE_SIZE.clear();
  for (const chain of dataFetcher.getAllEvolutionChains()) {
    const chainIds = new Set<number>();
    for (const n of chain.nodes || []) {
      chainIds.add(n.speciesId);
      if (!processed.has(n.speciesId)) {
        processed.add(n.speciesId);
        node.set(n.speciesId, {
          trigger: n.trigger,
          item: n.item,
          minLevel: n.minLevel,
        });
      }
      const to = n.continuesTo || [];
      for (const cid of to) {
        const childKey = `${n.speciesId}>${cid}`;
        if (!seenParentChild.has(childKey)) {
          seenParentChild.add(childKey);
          const cl = children.get(n.speciesId) || [];
          cl.push(cid);
          children.set(n.speciesId, cl);
          const pl = parents.get(cid) || [];
          pl.push(n.speciesId);
          parents.set(cid, pl);
        }
      }
    }
    const lineSize = chainIds.size;
    for (const id of chainIds) {
      if (!LINE_SIZE.has(id)) LINE_SIZE.set(id, lineSize);
    }
  }
  if (dataFetcher.getStatus().phase === 'ready') {
    EVO_RESOLVER_REVISION = dataFetcher.getDataRevision();
    EVO_RESOLVER = { parents, children, node };
  }
  return { parents, children, node };
}

// speciesId -> size of the evolution line it belongs to (for line hints).
const LINE_SIZE = new Map<number, number>();

// Abilities that PokeAPI hasn't populated yet for certain Mega forms (upstream
// gaps in the community "Mega Dimension" dataset).  Keyed by the Pokemon's dex
// id.  Only include abilities that are officially confirmed in Pokémon Champions.
const MEGA_ABILITY_OVERRIDES: Record<number, { name: string; isHidden: boolean; description: string }[]> = {
  // Mega Baxcalibur — Thermal Exchange (confirmed in Champions Regulation M-C, Sept 9 2026)
  10325: [
    { name: 'Thermal Exchange', isHidden: false, description: 'Boosts the Attack stat when the Pokémon is hit by a Fire-type move. The Pokémon also cannot be burned.' },
  ],
  // Mega Golisopod — Tough Claws (confirmed in Champions Regulation M-C, Sept 9 2026)
  10316: [
    { name: 'Tough Claws', isHidden: false, description: 'Strengthens moves that make contact to 1.33× their power.' },
  ],
};

function applyAbilityOverride(pokemon: any): any {
  if (!pokemon) return pokemon;
  const id = pokemon.id ?? pokemon.speciesId;
  if (Array.isArray(pokemon.abilities) && pokemon.abilities.length === 0 && MEGA_ABILITY_OVERRIDES[id]) {
    return { ...pokemon, abilities: MEGA_ABILITY_OVERRIDES[id] };
  }
  return pokemon;
}

function applyStageOverride(pokemon: any): any {
  if (!pokemon) return pokemon;
  const speciesId = pokemon.speciesId ?? pokemon.id;
  const stages = getStageSets();
  const resolver = getEvoResolver();

  const childIds = resolver.children.get(speciesId) || [];
  const preIds = resolver.parents.get(speciesId) || [];
  const lineSize = LINE_SIZE.get(speciesId) || 1;

  // The evolution trigger/item/level apply to the direct children (the step
  // that happens FROM this species), so aggregate from the child nodes.
  let trigger: string | undefined;
  let item: string | undefined;
  let minLevel: number | undefined;
  for (const cid of childIds) {
    const cnd = resolver.node.get(cid);
    if (cnd?.trigger) trigger = cnd.trigger;
    if (cnd?.item) item = cnd.item;
    if (cnd?.minLevel) minLevel = Math.min(minLevel || Infinity, cnd.minLevel) as number;
  }
  if (minLevel === Infinity) minLevel = undefined;

  return {
    ...pokemon,
    isStarter: getStarterFamilyIds().has(speciesId),
    isFinal: stages.finalStage.has(speciesId),
    isMiddle: stages.middleStage.has(speciesId),
    isFirstStage: stages.firstStage.has(speciesId),
    pseudoLegendaryStatus: PSEUDO_LEGENDARY_SPECIES_IDS.has(speciesId) ? 'pseudo-legendary' : null,
    // Non-revealing evolution metadata for tricky hints (never names).
    evoNextCount: childIds.length,
    evoPreCount: preIds.length,
    evoLineCount: lineSize,
    evoTrigger: trigger || null,
    evoItem: item || null,
    evoMinLevel: typeof minLevel === 'number' ? minLevel : null,
  };
}

const applyOverrides = (pokemon: any) =>
  applyAbilityOverride(applyStageOverride(applyLegendaryOverride(applyStellarOverride(applyFormFlavorOverride(applyUnownAOverride(pokemon))))));


app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Pokedex API running',
    serverless: isServerless(),
    cacheStats: pokeapiClient.getCacheStats(),
    cacheStale: pokeapiClient.isDiskCacheStale(),
    loadStatus: dataFetcher.getStatus(),
    version: '3.0.0-fullpokedex',
  });
});

app.get('/status', (req, res) => {
  res.json(dataFetcher.getStatus());
});

const REFRESH_TTL = 24 * 60 * 60 * 1000;
export { REFRESH_TTL };

// Owner-only controls. The owner key comes from the environment (or a development
// default) and is never shipped to the client; the browser only ever holds the key
// the owner types in, stored locally after a successful verification.
const OWNER_KEY = process.env.POKEDEX_OWNER_KEY || 'rotom-owner';

function isOwner(req: any): boolean {
  const key = req.headers['x-owner-key'];
  return typeof key === 'string' && key.length > 0 && key === OWNER_KEY;
}

function requireOwner(req: any, res: any): boolean {
  if (isOwner(req)) return true;
  res.status(401).json({ ok: false, error: 'Owner authentication required.' });
  return false;
}

// Verify the owner key without triggering any data operations.
app.get('/api/owner/verify', (req, res) => {
  res.json({ ok: true, owner: isOwner(req) });
});

// Trigger a full cache refresh from the PokéAPI (owner-only). On serverless
// platforms this is a no-op: the dataset is a committed snapshot refreshed
// locally and re-deployed.
app.get('/api/refresh', (req, res) => {
  if (isServerless()) {
    return res.json({ ok: true, serverless: true, note: 'Refreshing is disabled here; refresh locally and redeploy (see README)' });
  }
  if (!requireOwner(req, res)) return;
  const { force } = req.query;
  const info = pokeapiClient.getDiskCacheInfo();
  const stale = info.ageMs != null && info.ageMs > REFRESH_TTL;
  if (force === '1') {
    const { started } = dataFetcher.refreshData();
    return res.json({ ok: true, started, refreshing: dataFetcher.isRefreshing(), status: dataFetcher.getStatus() });
  }
  if (dataFetcher.getStatus().phase !== 'ready') {
    return res.json({ ok: true, started: dataFetcher.isRefreshing(), refreshing: dataFetcher.isRefreshing(), status: dataFetcher.getStatus() });
  }
  if (stale) {
    const { started } = dataFetcher.refreshData();
    return res.json({ ok: true, started, refreshing: dataFetcher.isRefreshing(), cacheAgeMs: info.ageMs, status: dataFetcher.getStatus() });
  }
  return res.json({ ok: true, started: false, refreshing: false, cacheIsFresh: true, cacheAgeMs: info.ageMs, status: dataFetcher.getStatus(), refreshUrl: '/api/refresh?force=1' });
});

app.post('/api/refresh', (req, res) => {
  if (isServerless()) {
    return res.json({ ok: true, serverless: true, note: 'Refreshing is disabled here; refresh locally and redeploy (see README)' });
  }
  if (!requireOwner(req, res)) return;
  const { started } = dataFetcher.refreshData();
  res.json({ ok: true, started, refreshing: dataFetcher.isRefreshing(), status: dataFetcher.getStatus() });
});

app.get('/pokemon', async (req, res) => {
  try {
    const { type, search, form, region, gen, offset, limit } = req.query;

    if (dataFetcher.getStatus().phase !== 'ready') {
      return res.json({
        loading: true,
        status: dataFetcher.getStatus(),
        pokemon: [],
      });
    }

    let results = dataFetcher.getAll();

    if (type) {
      const typeLower = type.toString().toLowerCase();
      results = results.filter(p =>
        p.types.some((t: any) => t.type.toLowerCase() === typeLower)
      );
    }

    if (search) {
      const q = search.toString().toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.baseName.toLowerCase().includes(q) ||
        p.displayName.toLowerCase().includes(q)
      );
    }

    if (form) {
      const formLower = form.toString().toLowerCase();
      results = results.filter(p =>
        p.form?.toLowerCase().includes(formLower) ||
        p.formType === formLower
      );
    }

    if (region) {
      const regionLower = region.toString().toLowerCase();
      results = results.filter(p =>
        p.region.toLowerCase() === regionLower
      );
    }

    if (gen) {
      const genNum = parseInt(gen.toString());
      if (!isNaN(genNum)) {
        results = results.filter(p => p.generation === genNum);
      }
    }

    // Pagination keeps each response small enough for serverless platforms
    // (Netlify caps buffered function responses at 6 MB). When absent, the
    // full array is returned as before (local server, no change in behaviour).
    const hasPaging = offset !== undefined || limit !== undefined;
    if (hasPaging) {
      const total = results.length;
      const off = Math.max(0, parseInt(String(offset ?? '0'), 10) || 0);
      const lim = parseInt(String(limit ?? '0'), 10) || total;
      const page = results.slice(off, Math.min(off + lim, total));
      res.json({
        pokemon: page.map(applyOverrides),
        total,
        offset: off,
        limit: lim,
        hasMore: off + lim < total,
      });
      return;
    }

    res.json(results.map(applyOverrides));
  } catch (error) {
    console.error('Error in /pokemon:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/pokemon/type/:type', async (req, res) => {
  try {
    const type = req.params.type;

    if (dataFetcher.getStatus().phase !== 'ready') {
      return res.json({ loading: true, status: dataFetcher.getStatus(), pokemon: [] });
    }

    const typeLower = type.toString().toLowerCase();
    let results = dataFetcher.getByType(type);
    if (typeLower === 'stellar' && results.length === 0) {
      results = dataFetcher.getAll().filter(
        (p: any) => p.name === 'Terapagos' && p.form === 'Stellar'
      );
    }
    res.json(results.map(applyOverrides));
  } catch (error) {
    console.error('Error in /pokemon/type/:type:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/pokemon/search/:query', async (req, res) => {
  try {
    const query = req.params.query;

    if (dataFetcher.getStatus().phase !== 'ready') {
      return res.json({ loading: true, status: dataFetcher.getStatus(), pokemon: [] });
    }

    const results = dataFetcher.search(query);
    res.json(results.map(applyOverrides));
  } catch (error) {
    console.error('Error in /pokemon/search/:query:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/pokemon/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const form = req.query.form as string | undefined;

    if (dataFetcher.getStatus().phase !== 'ready') {
      return res.json({ loading: true, status: dataFetcher.getStatus() });
    }

    let pokemon = form
      ? dataFetcher.getByIdAndForm(id, form)
      : dataFetcher.getById(id);

    if (!pokemon) {
      pokemon = dataFetcher.getByIdAndForm(id, form);
    }

    if (!pokemon) {
      return res.status(404).json({ error: 'Pokemon not found' });
    }

    res.json(applyOverrides(pokemon));
  } catch (error) {
    console.error('Error in /pokemon/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/evolution/:speciesId', async (req, res) => {
  try {
    if (dataFetcher.getStatus().phase !== 'ready') {
      return res.json({ loading: true, status: dataFetcher.getStatus() });
    }
    const speciesId = parseInt(req.params.speciesId);
    const chain = dataFetcher.getEvolutionChainForSpecies(speciesId);
    if (!chain) {
      return res.status(404).json({ error: 'Evolution chain not found' });
    }
    res.json(chain);
  } catch (error) {
    console.error('Error in /evolution/:speciesId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/type/:type/weaknesses', async (req, res) => {
  try {
    const type = req.params.type;

    if (dataFetcher.getStatus().phase !== 'ready') {
      return res.json({ loading: true, status: dataFetcher.getStatus() });
    }

    const pokemonOfType = dataFetcher.getByType(type);

    const summary: Record<string, any> = {};
    for (const pokemon of pokemonOfType) {
      summary[pokemon.name] = pokemon.weaknesses;
    }

    res.json({
      type,
      summary,
      totalPokemon: pokemonOfType.length,
    });
  } catch (error) {
    console.error('Error in /type/:type/weaknesses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/pokemon/weakness/times/:category', async (req, res) => {
    try {
      const category = req.params.category.toLowerCase();
      const validCategories = ['immunities', 'resistances', 'neutral', 'weaknesses'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category. Valid: immunities, resistances, neutral, weaknesses' });
    }

    if (dataFetcher.getStatus().phase !== 'ready') {
      return res.json({ loading: true, status: dataFetcher.getStatus(), pokemon: [] });
    }

    const allPokemon = dataFetcher.getAll();

    const filtered = allPokemon.filter((p: any) => {
      return Object.values(p.weaknesses || {}).some(
        (w: any) => w.category === category
      );
    });

    const byType: Record<string, any[]> = {};
    filtered.forEach((p: any) => {
      const typeNames = p.types?.map((t: any) => t.type) || [];
      typeNames.forEach((t: any) => {
        if (!byType[t]) byType[t] = [];
        const weaknessCount = Object.values(p.weaknesses || {}).filter(
          (w: any) => w.category === category
        ).length;
        byType[t].push({
          id: p.id,
          name: p.name,
          types: p.types,
          weaknessCount: weaknessCount > 0 ? weaknessCount : undefined,
        });
      });
    });

    res.json({
      category,
      count: filtered.length,
      pokemon: filtered.map(applyOverrides),
      byType,
    });
  } catch (error) {
    console.error('Error in /pokemon/weakness/times/:category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/abilities', async (req, res) => {
  try {
    const { q, hidden } = req.query;

    if (dataFetcher.getStatus().phase !== 'ready') {
      return res.json({ loading: true, status: dataFetcher.getStatus(), abilities: [] });
    }

    const byName = new Map<string, any>();
    for (const p of dataFetcher.getAll()) {
      for (const a of (p.abilities || [])) {
        if (!a || !a.name) continue;
        const key = String(a.name).toLowerCase();
        const existing = byName.get(key);
        if (existing) {
          existing.count++;
          if (a.isHidden) existing.hasHidden = true;
          if (!existing.description && a.description) existing.description = a.description;
        } else {
          byName.set(key, {
            name: a.name,
            description: a.description || '',
            count: 1,
            isHidden: !!a.isHidden,
            hasHidden: !!a.isHidden,
          });
        }
      }
    }

    let list = Array.from(byName.values());
    const qLower = q ? String(q).toLowerCase() : '';
    if (qLower) {
      list = list.filter(a =>
        a.name.toLowerCase().includes(qLower) ||
        a.description.toLowerCase().includes(qLower)
      );
    }
    if (hidden === 'true') list = list.filter(a => a.hasHidden);
    list.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ total: list.length, abilities: list });
  } catch (error) {
    console.error('Error in /abilities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/moves', async (req, res) => {
  try {
    const { type, 'class': damageClass, generation, q, kind, signature } = req.query;

    if (dataFetcher.getStatus().phase !== 'ready') {
      return res.json({ loading: true, status: dataFetcher.getStatus(), moves: [] });
    }

    const typeLower = type ? type.toString().toLowerCase() : '';
    const classLower = damageClass ? damageClass.toString().toLowerCase() : '';
    const genNum = generation ? parseInt(generation.toString()) : NaN;
    const qLower = q ? q.toString().toLowerCase() : '';
    const kindLower = kind ? kind.toString().toLowerCase() : '';
    const signatureOnly = signature === '1';

    let moveIds: number[] = [];
    if (typeLower) {
      try {
        moveIds = await dataFetcher.getTypeMoveIds(typeLower);
      } catch (err: any) {
        console.log(`getTypeMoveIds failed for ${typeLower}: ${err.message}`);
      }
    } else {
      const list = await dataFetcher.loadMoveList();
      moveIds = list
        .map((entry: any) => {
          const match = (entry.url || '').match(/\/move\/(\d+)\/?$/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter((id: number) => id > 0);
    }

    const moves: any[] = [];
    for (const id of moveIds) {
      try {
        const move = await dataFetcher.loadMove(id);
        if (!move) continue;
        if (typeLower && move.type.toLowerCase() !== typeLower) continue;
        if (classLower && move.damageClass !== classLower) continue;
        if (!isNaN(genNum) && move.generation !== genNum) continue;
        if (qLower && !move.name.toLowerCase().includes(qLower)) continue;
        if (kindLower && classifyMoveKind(move.id, move.name) !== kindLower) continue;
        if (signatureOnly && !zReq(move.name).requiresMove) continue;
        moves.push({ ...move, kind: classifyMoveKind(move.id, move.name), ...zReq(move.name) });
      } catch (err: any) {
        console.log(`Error processing move ${id}: ${err.message}`);
      }
    }

    for (const move of GMAX_MOVES) {
      if (typeLower && move.type.toLowerCase() !== typeLower) continue;
      if (classLower && move.damageClass !== classLower) continue;
      if (!isNaN(genNum) && move.generation !== genNum) continue;
      if (qLower && !move.name.toLowerCase().includes(qLower)) continue;
      if (kindLower && classifyMoveKind(move.id, move.name) !== kindLower) continue;
      if (signatureOnly && !zReq(move.name).requiresMove) continue;
      moves.push({ ...move, kind: classifyMoveKind(move.id, move.name), ...zReq(move.name) });
    }

    moves.sort((a, b) => a.id - b.id);
    res.json({ total: moves.length, moves });
  } catch (error) {
    console.error('Error in /moves:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/moves/:nameOrId', async (req, res) => {
  try {
    if (dataFetcher.getStatus().phase !== 'ready') {
      return res.json({ loading: true, status: dataFetcher.getStatus() });
    }
    const param = req.params.nameOrId;
    const asId = parseInt(param);
    let move = asId ? dataFetcher.getMoveById(asId) || getGMaxMoveById(asId) : undefined;
    if (!move) {
      move = await dataFetcher.loadMove(asId || param);
    }
    if (!move) {
      move = getGMaxMoveByName(param);
    }
    if (!move) {
      return res.status(404).json({ error: 'Move not found' });
    }
    res.json({ ...move, kind: classifyMoveKind(move.id, move.name), ...zReq(move.name) });
  } catch (error) {
    console.error('Error in /moves/:nameOrId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ---- data bootstrap -------------------------------------------------------

// Serverless runtimes have no long-lived process and a read-only filesystem.
// Config flags flip the app into snapshot mode: cache is a committed, read-only
// file and no network refresh ever starts.
if (isServerless()) {
  pokeapiClient.setDiskCacheReadOnly(true);
  dataFetcher.setBackgroundRefreshEnabled(false);
}

let readyPromise: Promise<void> | null = null;

// Loads the dataset once per instance. All requests await this promise, so a
// cold function instantiation blocks until `ready` before answering. On
// serverless the cached data loads synchronously (sub-second); the refresher is
// off, so nothing pokes the network.
export function ensureDataReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = dataFetcher.init()
      .catch((err: any) => {
        readyPromise = null;
        throw err;
      });
  }
  return readyPromise;
}

export { app };