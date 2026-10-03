import { pokeapiClient } from './pokeapiClient';
import { Pokemon, PokemonType, PokemonStat, PokemonAbility, PokemonVariety, LoadStatus, EvolutionChainData, EvolutionNode, Move, MoveDamageClass } from '../models/pokemonModel';
import { WeaknessCalculator } from './weaknessCalculator';

const SKIP_PATTERNS = [
  /^pikachu-(rock-star|belle|pop-star|phd|libre|original-cap|hoenn-cap|sinnoh-cap|unova-cap|kalos-cap|alola-cap|world-cap|partner-cap)/,
  /^pichu-spiky-eared$/,
];

const COSMETIC_FORM_SPECIES = new Set<string>([
  'unown', 'arceus', 'vivillon', 'burmy', 'cherrim', 'deerling', 'sawsbuck', 'silvally', 'type-null',
]);


const REGION_MAP: Record<string, { region: string; generation: number }> = {
  'kanto': { region: 'Kanto', generation: 1 },
  'johto': { region: 'Johto', generation: 2 },
  'hoenn': { region: 'Hoenn', generation: 3 },
  'sinnoh': { region: 'Sinnoh', generation: 4 },
  'unova': { region: 'Unova', generation: 5 },
  'kalos': { region: 'Kalos', generation: 6 },
  'alola': { region: 'Alola', generation: 7 },
  'galar': { region: 'Galar', generation: 8 },
  'hisui': { region: 'Hisui', generation: 8 },
  'paldea': { region: 'Paldea', generation: 9 },
};

const REGIONAL_REGION_MAP: Record<string, string> = {
  'alola': 'Alola',
  'galar': 'Galar',
  'hisui': 'Hisui',
  'paldea': 'Paldea',
};

const FLAVOR_VERSION_MAP: Record<string, string[]> = {
  'alola': ['sun', 'moon', 'ultra-sun', 'ultra-moon'],
  'galar': ['sword', 'shield'],
  'hisui': ['legends-arceus'],
  'paldea': ['scarlet', 'violet'],
};

const FORM_NAME_MAP: Record<string, string> = {
  'mega': 'Mega',
  'mega-x': 'Mega X',
  'mega-y': 'Mega Y',
  'alola': 'Alolan',
  'galar': 'Galarian',
  'hisui': 'Hisuian',
  'gmax': 'Gigantamax',
};

const HISUI_ORIGIN_IDS = new Set<number>([899, 900, 901, 902, 903, 904, 905]);

const REGIONAL_TOKENS = new Set(['alola', 'galar', 'hisui', 'paldea', 'paldea-evolved', 'paldea-combat', 'paldea-blaze', 'paldea-aqua', 'eternamax', 'gmax', 'totem', 'mega', 'mega-x', 'mega-y', 'default']);

// Genus overrides for non-official (fabricated) Mega forms; keyed by base name.
const MEGA_GENUS_OVERRIDES: Record<string, string> = {
  'Darkrai': 'Bad Dream Pokémon',
};

class DataFetcher {
  private allPokemon: Pokemon[] = [];
  private evolutionChains: Record<number, EvolutionChainData> = {};
  private moves: Map<number, Move> = new Map();
  private moveList: { name: string; url: string }[] | null = null;
  private status: LoadStatus = {
    phase: 'idle',
    totalSpecies: 0,
    loadedSpecies: 0,
    totalPokemon: 0,
    loadedPokemon: 0,
    percentComplete: 0,
    message: 'Not started',
  };
  private calc = new WeaknessCalculator();

  getStatus(): LoadStatus {
    return { ...this.status };
  }

  /**
   * Route all load-status updates through here. When the in-memory dataset is
   * already populated (a background refresh of an existing cache), the phase stays
   * 'ready' so routes keep serving the current data; progress is still surfaced via
   * `message`/`percentComplete`. A cold boot (no data yet) shows the real phases.
   */
  private updateStatus(phase: LoadStatus['phase'], fields: Partial<LoadStatus> = {}): void {
    const hasData = this.allPokemon.length > 0 && this.evolutionChains && Object.keys(this.evolutionChains).length > 0;
    if (hasData) {
      this.status = { ...this.status, ...fields, phase: 'ready' };
    } else {
      this.status = { ...this.status, phase, ...fields };
    }
  }

  getAll(): Pokemon[] {
    return this.allPokemon;
  }

  getEvolutionChainForSpecies(speciesId: number): EvolutionChainData | undefined {
    return this.evolutionChains[speciesId];
  }

  getAllEvolutionChains(): EvolutionChainData[] {
    return Object.values(this.evolutionChains);
  }

  // Derives evolution-stage sets from the loaded evolution chains:
  // - finalStage: species with no children (the end of an evolution line)
  // - firstStage: species with no pre-evolution anywhere (the start of a line)
  // - middleStage: species that has both a pre-evolution and children
  getStageSets(): { finalStage: Set<number>; firstStage: Set<number>; middleStage: Set<number> } {
    const hasPrev = new Set<number>();
    const hasNext = new Set<number>();
    const finalStage = new Set<number>();
    const firstStage = new Set<number>();
    const middleStage = new Set<number>();
    for (const key in this.evolutionChains) {
      const nodes = this.evolutionChains[key]?.nodes || [];
      for (const n of nodes) {
        if (!n.continuesTo || n.continuesTo.length === 0) finalStage.add(n.speciesId);
        (n.continuesTo || []).forEach(cid => hasPrev.add(cid));
        if (n.continuesTo && n.continuesTo.length) hasNext.add(n.speciesId);
      }
    }
    for (const key in this.evolutionChains) {
      const nodes = this.evolutionChains[key]?.nodes || [];
      for (const n of nodes) {
        if (!hasPrev.has(n.speciesId)) firstStage.add(n.speciesId);
        if (hasPrev.has(n.speciesId) && hasNext.has(n.speciesId)) middleStage.add(n.speciesId);
      }
    }
    return { finalStage, firstStage, middleStage };
  }

  getById(id: number): Pokemon | undefined {
    return this.allPokemon.find(p => p.id === id && p.isDefault);
  }

  getByIdAndForm(id: number, form?: string): Pokemon | undefined {
    if (!form) return this.allPokemon.find(p => p.id === id && p.isDefault);
    const formLower = form.toLowerCase();
    return this.allPokemon.find(p =>
      p.id === id && (
        p.form?.toLowerCase() === formLower ||
        p.name.toLowerCase().includes(formLower)
      )
    );
  }

  getByType(type: string): Pokemon[] {
    const typeLower = type.toLowerCase();
    return this.allPokemon.filter(p =>
      p.types.some(t => t.type.toLowerCase() === typeLower)
    );
  }

  search(query: string): Pokemon[] {
    const q = query.toLowerCase();
    return this.allPokemon.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.baseName.toLowerCase().includes(q) ||
      p.displayName.toLowerCase().includes(q)
    );
  }

  getMoveById(id: number): Move | undefined {
    return this.moves.get(id);
  }

  async loadMove(idOrName: string | number): Promise<Move | undefined> {
    if (typeof idOrName === 'number') {
      const cached = this.moves.get(idOrName);
      if (cached) return cached;
    }
    try {
      const raw = await pokeapiClient.getMove(idOrName);
      const move = this.transformMove(raw);
      this.moves.set(move.id, move);
      return move;
    } catch (err: any) {
      console.log(`Failed to fetch move ${idOrName}: ${err.message}`);
      return undefined;
    }
  }

  async loadMoveList(): Promise<{ name: string; url: string }[]> {
    if (this.moveList) return this.moveList;
    this.moveList = await pokeapiClient.getMoveList();
    return this.moveList;
  }

  async buildAllMoves(): Promise<void> {
    const list = await this.loadMoveList();
    const ids = list
      .map((entry: any) => {
        const match = (entry.url || '').match(/\/move\/(\d+)\/?$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(id => id > 0);

    const BATCH_SIZE = 100;
    const BATCH_DELAY = 15000;
    let loaded = 0;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      pokeapiClient.resetRateLimiter();
      const batch = ids.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (id) => {
        try {
          return await pokeapiClient.getMove(id);
        } catch (e: any) {
          console.log(`Failed to fetch move ${id}: ${e.message}`);
          return undefined;
        }
      }));
      for (const raw of results) {
        if (!raw) continue;
        const move = this.transformMove(raw);
        this.moves.set(move.id, move);
      }
      loaded += batch.length;
      this.status.message = `Loading moves: ${loaded}/${ids.length}`;
      console.log(`DataFetcher: Moves ${loaded}/${ids.length}`);
      if (i + BATCH_SIZE < ids.length) {
        console.log(`DataFetcher: Waiting ${BATCH_DELAY / 1000}s before next move batch...`);
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }
  }

  async getMoveByUrl(url: string): Promise<Move | undefined> {
    const match = url.match(/\/move\/(\d+)\/?$/);
    const id = match ? parseInt(match[1]) : 0;
    if (!id) return undefined;
    const cached = this.moves.get(id);
    if (cached) return cached;
    return this.loadMove(id);
  }

  async getTypeMoveIds(typeName: string): Promise<number[]> {
    const type = await pokeapiClient.getTypeData(typeName);
    const ids: number[] = [];
    for (const m of (type.moves || [])) {
      const match = (m.url || '').match(/\/move\/(\d+)\/?$/);
      const id = match ? parseInt(match[1]) : 0;
      if (id) ids.push(id);
    }
    return ids;
  }

  private transformMove(raw: any): Move {
    const enEffect = (raw.effect_entries || []).find((e: any) => e.language?.name === 'en');
    const enFlavor = (raw.flavor_text_entries || []).find((e: any) => e.language?.name === 'en');
    const nameList = raw.names || [];
    const enName = nameList.find((n: any) => n.language?.name === 'en');

    const genMatch = (raw.generation?.name || '').match(/generation-(\w+)/);
    const generation = genMatch ? this.parseGeneration(genMatch[1]) : null;

    const damageClass = (raw.damage_class?.name || 'status') as MoveDamageClass;

    return {
      id: raw.id,
      name: enName?.name || this.capitalize((raw.name || '').replace(/-/g, ' ')),
      type: this.capitalize(raw.type?.name || ''),
      damageClass,
      power: raw.power ?? null,
      accuracy: raw.accuracy ?? null,
      pp: raw.pp ?? null,
      generation: generation || 1,
      category: this.capitalize(raw.meta?.category?.name || raw.damage_class?.name || ''),
      priority: raw.priority ?? null,
      target: raw.target?.name || '',
      description: enFlavor
        ? enFlavor.flavor_text.replace(/[\n\f\r]/g, ' ').replace(/\s+/g, ' ').trim()
        : '',
      effect: enEffect ? enEffect.effect.replace(/[\n\f\r]/g, ' ').replace(/\s+/g, ' ').trim() : '',
      pokemon: this.learnersFor(raw.name),
    };
  }

  private learnersFor(moveRawName: string): string[] {
    const learners = this.allPokemon
      .filter(p => p.isDefault && (p.moves || []).includes(moveRawName))
      .sort((a, b) => a.id - b.id)
      .map(p => p.baseName);
    return Array.from(new Set(learners));
  }


  private refreshing = false;

  // Monotonic counter bumped whenever the in-memory dataset is replaced
  // (disk-cache load or a completed full fetch). Derived caches in index.ts
  // compare against this so they never serve state computed from stale data.
  private dataRevision = 0;

  getDataRevision(): number {
    return this.dataRevision;
  }

  isRefreshing(): boolean {
    return this.refreshing;
  }

  async init(): Promise<void> {
    console.log('DataFetcher: Initializing...');

    const cached = pokeapiClient.loadDiskCache();
    if (cached && cached.pokemon && cached.pokemon.length > 100) {
      this.allPokemon = cached.pokemon;
      this.evolutionChains = cached.evolutionChains || {};
      this.dataRevision++;
      for (const m of (cached.moves || [])) {
        this.moves.set(m.id, m);
      }
      if (this.moves.size < 100) {
        this.updateStatus('merging', { message: 'Fetching moves...', percentComplete: 95 });
        pokeapiClient.resetRateLimiter();
        await this.buildAllMoves();
        pokeapiClient.saveDiskCache(this.allPokemon, this.evolutionChains, Array.from(this.moves.values()));
      }
      this.status = {
        phase: 'ready',
        totalSpecies: 0,
        loadedSpecies: 0,
        totalPokemon: cached.pokemon.length,
        loadedPokemon: cached.pokemon.length,
        percentComplete: 100,
        message: `Loaded ${cached.pokemon.length} Pokemon from cache`,
        completedAt: Date.now(),
      };
      console.log(`DataFetcher: Loaded ${cached.pokemon.length} Pokemon from cache`);

      // Boot is instant from disk even if the cache is old; a stale cache just
      // triggers a background refresh so the app keeps serving meanwhile.
      if (pokeapiClient.isDiskCacheStale()) {
        console.log('DataFetcher: Cache is stale — refreshing in the background (serving cached data meanwhile)...');
        this.refreshData();
      }
      return;
    }

    await this.runFullFetch();
  }

  /**
   * Trigger a full cache refresh from the PokéAPI. Runs in the background and never
   * blocks; a no-op if a refresh (or initial load) is already in progress. On success
   * the in-memory data and disk cache are atomically replaced so the app stays consistent.
   */
  refreshData(): { started: boolean } {
    if (this.refreshing) {
      console.log('DataFetcher: refresh already in progress, skipping');
      return { started: false };
    }
    this.refreshing = true;
    (async () => {
      try {
        await this.doFullFetch();
      } catch (err: any) {
        console.error('DataFetcher refresh worker error:', err.message);
      } finally {
        this.refreshing = false;
      }
    })();
    return { started: true };
  }

  private async runFullFetch(): Promise<void> {
    if (this.refreshing) {
      console.log('DataFetcher: full fetch already in progress, skipping');
      return;
    }
    this.refreshing = true;
    try {
      await this.doFullFetch();
    } finally {
      this.refreshing = false;
    }
  }

  private async doFullFetch(): Promise<void> {
    this.updateStatus('loading-species', { message: 'Fetching species list...', startedAt: Date.now() });

    try {
      const speciesList = await pokeapiClient.getAllSpeciesIds();
      this.status.totalSpecies = speciesList.length;
      console.log(`DataFetcher: Found ${speciesList.length} species`);

      this.updateStatus('loading-pokemon', { message: 'Fetching Pokemon data...' });

      pokeapiClient.resetRateLimiter();

      const pokemonList = await pokeapiClient.getAllPokemonIds();
      this.status.totalPokemon = pokemonList.length;
      console.log(`DataFetcher: Found ${pokemonList.length} Pokemon entries`);

      const BATCH_SIZE = 90;
      const BATCH_DELAY = 15000;
      const allRawPokemon: any[] = [];
      const allRawSpecies: any[] = [];

      for (let i = 0; i < speciesList.length; i += BATCH_SIZE) {
        pokeapiClient.resetRateLimiter();
        const batch = speciesList.slice(i, i + BATCH_SIZE);
        const batchIds = batch.map(s => {
          const match = s.url.match(/\/(\d+)\/?$/);
          return match ? parseInt(match[1]) : 0;
        }).filter(id => id > 0);

        const speciesBatch = await pokeapiClient.getSpeciesBatch(batchIds);
        allRawSpecies.push(...speciesBatch);

        this.status.loadedSpecies = Math.min(i + BATCH_SIZE, speciesList.length);
        this.status.percentComplete = Math.round((this.status.loadedSpecies / speciesList.length) * 40);
        this.status.message = `Loading species: ${this.status.loadedSpecies}/${speciesList.length}`;
        console.log(`DataFetcher: Species ${this.status.loadedSpecies}/${speciesList.length}`);

        if (i + BATCH_SIZE < speciesList.length) {
          console.log(`DataFetcher: Waiting ${BATCH_DELAY / 1000}s before next batch...`);
          await new Promise(r => setTimeout(r, BATCH_DELAY));
        }
      }

      for (let i = 0; i < pokemonList.length; i += BATCH_SIZE) {
        pokeapiClient.resetRateLimiter();
        const batch = pokemonList.slice(i, i + BATCH_SIZE);
        const batchIds = batch.map(p => {
          const match = p.url.match(/\/(\d+)\/?$/);
          return match ? parseInt(match[1]) : 0;
        }).filter(id => id > 0);

        const pokemonBatch = await pokeapiClient.getPokemonBatch(batchIds);
        allRawPokemon.push(...pokemonBatch);

        this.status.loadedPokemon = Math.min(i + BATCH_SIZE, pokemonList.length);
        this.status.percentComplete = 40 + Math.round((this.status.loadedPokemon / pokemonList.length) * 50);
        this.status.message = `Loading Pokemon: ${this.status.loadedPokemon}/${pokemonList.length}`;
        console.log(`DataFetcher: Pokemon ${this.status.loadedPokemon}/${pokemonList.length}`);

        if (i + BATCH_SIZE < pokemonList.length) {
          console.log(`DataFetcher: Waiting ${BATCH_DELAY / 1000}s before next batch...`);
          await new Promise(r => setTimeout(r, BATCH_DELAY));
        }
      }

      this.updateStatus('merging', { message: 'Processing data...', percentComplete: 92 });

      pokeapiClient.resetRateLimiter();

      const speciesMap = new Map<number, any>();
      for (const s of allRawSpecies) {
        speciesMap.set(s.id, s);
      }

      const abilityDescriptions = await this.fetchAbilityDescriptions(allRawPokemon);

      const processed: Pokemon[] = [];
      const speciesDefaultMap = new Map<number, number>();

      for (const raw of allRawPokemon) {
        const speciesUrl: string = raw.species?.url || '';
        const speciesMatch = speciesUrl.match(/\/(\d+)\/?$/);
        const speciesId = speciesMatch ? parseInt(speciesMatch[1]) : raw.id;

        if (SKIP_PATTERNS.some(p => p.test(raw.name))) continue;

        const species = speciesMap.get(speciesId);
        if (!species) continue;

        if (!speciesDefaultMap.has(speciesId)) {
          speciesDefaultMap.set(speciesId, raw.id);
        }

        const pokemon = this.transformPokemon(raw, species, speciesId, abilityDescriptions);
        processed.push(pokemon);
      }

      for (const pokemon of processed) {
        this.computeWeaknesses(pokemon);
      }

      // Build everything locally and only commit on success, so a failed refresh
      // never leaves the app with a partially-updated dataset.
      const newEvolutionChains = await this.fetchEvolutionChains(allRawSpecies);
      await this.addCosmeticForms(processed);

      this.updateStatus('merging', { message: 'Fetching moves...', percentComplete: 96 });
      const movesToSave = this.moves.size ? Array.from(this.moves.values()) : [];
      if (movesToSave.length < 100) {
        pokeapiClient.resetRateLimiter();
        await this.buildAllMoves();
      }

      this.allPokemon = processed;
      this.evolutionChains = newEvolutionChains;
      this.dataRevision++;

      this.updateStatus('saving', { message: 'Saving to cache...', percentComplete: 98 });
      pokeapiClient.saveDiskCache(processed, newEvolutionChains, Array.from(this.moves.values()));

      this.updateStatus('ready', {
        percentComplete: 100,
        message: `Loaded ${processed.length} Pokemon`,
        completedAt: Date.now(),
      });
      console.log(`DataFetcher: Complete! ${processed.length} Pokemon loaded`);

    } catch (error: any) {
      console.error('DataFetcher error:', error.message);
      this.updateStatus('error', {
        message: `Error: ${error.message}`,
      });
    }
  }

  private transformPokemon(raw: any, species: any, speciesId: number, abilityDescriptions: Map<string, string>): Pokemon {
    const name = raw.name as string;
    const isDefault = raw.is_default as boolean;

    const generationName: string = species.generation?.name || '';
    const genMatch = generationName.match(/generation-(\w+)/);
    const generation = genMatch ? this.parseGeneration(genMatch[1]) : 1;

    const speciesRawName: string = species.name || name;
    const formPart = this.getFormPart(name, speciesRawName);
    const regionInfo = this.getRegionInfo(species, generation, formPart);
    const formInfo = this.getFormInfo(name, isDefault, species, speciesRawName);
    const baseDisplayName = this.getSpeciesDisplayName(species) || this.capitalize(speciesRawName.split('-')[0]);

    const types: PokemonType[] = (raw.types || [])
      .sort((a: any, b: any) => a.slot - b.slot)
      .map((t: any) => ({
        type: this.capitalize(t.type.name),
        slot: t.slot,
      }));

    const stats: PokemonStat = {
      hp: this.getStat(raw.stats, 'hp'),
      attack: this.getStat(raw.stats, 'attack'),
      defense: this.getStat(raw.stats, 'defense'),
      spAtk: this.getStat(raw.stats, 'special-attack'),
      spDef: this.getStat(raw.stats, 'special-defense'),
      speed: this.getStat(raw.stats, 'speed'),
    };

    const abilities: PokemonAbility[] = (raw.abilities || []).map((a: any) => ({
      name: this.capitalize(a.ability.name.replace('-', ' ')),
      isHidden: a.is_hidden,
      description: abilityDescriptions.get(a.ability.name) || '',
    }));

    const flavorText = this.getFlavorText(species, formPart);
    const genera = this.getGenera(species);

    const varieties: PokemonVariety[] = (species.varieties || []).map((v: any) => ({
      name: v.pokemon.name,
      isDefault: v.is_default,
      url: v.pokemon.url,
    }));

    return {
      id: raw.id,
      name: baseDisplayName,
      displayName: formInfo.displayName,
      baseName: baseDisplayName,
      types,
      region: regionInfo.region,
      generation,
      form: formInfo.form,
      formType: formInfo.formType,
      isMega: formInfo.formType === 'mega',
      isGmax: formInfo.formType === 'gigantamax',
      isRegionalVariant: formInfo.formType === 'regional',
      isDefault,
      stats,
      height: (raw.height || 0) / 10,
      weight: (raw.weight || 0) / 10,
      abilities,
      sprites: {
        official: raw.sprites?.other?.['official-artwork']?.front_default || raw.sprites?.front_default || '',
        default: raw.sprites?.front_default || '',
        frontShiny: raw.sprites?.other?.['official-artwork']?.front_shiny || raw.sprites?.front_shiny || '',
      },
      cries: raw.cries
        ? { latest: raw.cries.latest, legacy: raw.cries.legacy }
        : undefined,
      flavorText,
      genera: formInfo.formType === 'mega' ? (MEGA_GENUS_OVERRIDES[baseDisplayName] || genera) : genera,
      varieties,
      speciesId,
      moves: (raw.moves || []).map((m: any) => m.move?.name).filter(Boolean),
    };
  }

  private async fetchAbilityDescriptions(allRawPokemon: any[]): Promise<Map<string, string>> {
    const descriptions = new Map<string, string>();
    const uniqueAbilities = new Map<string, string>();

    for (const raw of allRawPokemon) {
      for (const a of (raw.abilities || [])) {
        const abilityName: string = a.ability?.name;
        if (abilityName && !uniqueAbilities.has(abilityName)) {
          uniqueAbilities.set(abilityName, a.ability?.url || '');
        }
      }
    }

    const names = Array.from(uniqueAbilities.keys());
    console.log(`DataFetcher: Fetching ${names.length} unique abilities`);
    this.updateStatus('merging', { message: `Fetching ability details (${names.length})...`, percentComplete: 94 });

    const BATCH_SIZE = 50;
    const BATCH_DELAY = 15000;

    for (let i = 0; i < names.length; i += BATCH_SIZE) {
      pokeapiClient.resetRateLimiter();
      const batch = names.slice(i, i + BATCH_SIZE);
      for (const name of batch) {
        try {
          const data = await pokeapiClient.getAbility(name);
          const enEntry = (data.effect_entries || []).find((e: any) => e.language?.name === 'en');
          const description = enEntry?.effect
            ? enEntry.effect.replace(/[\n\f\r]/g, ' ').replace(/\s+/g, ' ').trim()
            : '';
          descriptions.set(name, description);
        } catch (err: any) {
          console.log(`Failed to fetch ability ${name}: ${err.message}`);
        }
      }
      if (i + BATCH_SIZE < names.length) {
        console.log(`DataFetcher: Waiting ${BATCH_DELAY / 1000}s before next ability batch...`);
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }

    return descriptions;
  }

  private async fetchEvolutionChains(allRawSpecies: any[]): Promise<Record<number, EvolutionChainData>> {
    const chainIds = new Set<number>();
    for (const s of allRawSpecies) {
      const match = (s.evolution_chain?.url || '').match(/\/evolution-chain\/(\d+)\/?$/);
      const chainId = match ? parseInt(match[1]) : 0;
      if (chainId) chainIds.add(chainId);
    }

    const chainIdList = Array.from(chainIds);
    console.log(`DataFetcher: Fetching ${chainIdList.length} evolution chains`);
    this.updateStatus('merging', { message: `Fetching evolution chains (${chainIdList.length})...` });

    const BATCH_SIZE = 50;
    const BATCH_DELAY = 15000;
    const chains: Record<number, EvolutionChainData> = {};

    for (let i = 0; i < chainIdList.length; i += BATCH_SIZE) {
      pokeapiClient.resetRateLimiter();
      const batch = chainIdList.slice(i, i + BATCH_SIZE);
      for (const chainId of batch) {
        try {
          const data = await pokeapiClient.getEvolutionChain(chainId);
          const nodes: Record<string, EvolutionNode> = {};
          const walk = (c: any) => {
            const rawName = c.species?.name || '';
            const match = (c.species?.url || '').match(/\/pokemon-species\/(\d+)\/?$/);
            const speciesId = match ? parseInt(match[1]) : 0;
            const detail = c.evolution_details?.[0] || {};
            const trigger = detail.trigger?.name || '';
            const item = detail.item?.name || '';
            const node: EvolutionNode = {
              speciesId,
              rawName,
              name: this.capitalize(rawName.split('-')[0]),
              continuesTo: [],
              minLevel: detail.min_level,
              trigger: trigger || undefined,
              item: item || undefined,
            };
            nodes[rawName] = node;
            for (const child of (c.evolves_to || [])) {
              const childNode = walk(child);
              nodes[rawName].continuesTo.push(childNode.speciesId);
            }
            return node;
          };
          const root = walk(data.chain);
          const allNodes = Object.values(nodes);
          for (const n of allNodes) {
            if (n.speciesId) {
              chains[n.speciesId] = { speciesId: n.speciesId, rootId: root.speciesId, nodes: allNodes };
            }
          }
        } catch (err: any) {
          console.log(`Failed to fetch evolution chain ${chainId}: ${err.message}`);
        }
      }
      if (i + BATCH_SIZE < chainIdList.length) {
        console.log(`DataFetcher: Waiting ${BATCH_DELAY / 1000}s before next evolution batch...`);
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }

    return chains;
  }

  private async addCosmeticForms(processed: Pokemon[]): Promise<void> {
    const defaults = new Map<string, Pokemon>();
    for (const p of processed) {
      if (p.isDefault) {
        defaults.set(p.baseName.toLowerCase(), p);
        if (p.varieties) {
          for (const v of p.varieties) {
            defaults.set(v.name.toLowerCase(), p);
          }
        }
      }
    }

    try {
      const forms = await pokeapiClient.getAllPokemonForms();
      const uniqueNames = Array.from(new Set(forms.map((f: any) => f.name)));
      const candidates = uniqueNames.filter((fn: string) => {
        const base = fn.split('-')[0];
        return COSMETIC_FORM_SPECIES.has(base) || COSMETIC_FORM_SPECIES.has(fn);
      });
      console.log(`DataFetcher: Found ${candidates.length} cosmetic form candidates`);

      let added = 0;
      for (const formName of candidates) {
        try {
          const detail = await pokeapiClient.getPokemonForm(formName);
          const linkedRawName = (detail.pokemon?.name || formName).toLowerCase();
          if (!COSMETIC_FORM_SPECIES.has(linkedRawName)) continue;

          const defaultPokemon = defaults.get(linkedRawName);
          if (!defaultPokemon) continue;

          const sprite = detail.sprites?.front_default || '';
          if (!sprite) continue;
          const exists = processed.some(p => p.speciesId === defaultPokemon.speciesId && p.sprites?.default === sprite);
          if (exists) continue;

          const formLabel = (detail.form_name || '').trim();
          const cosmeticTypes = this.getCosmeticFormTypes(linkedRawName, formName);
          const clone: Pokemon = {
            ...defaultPokemon,
            ...(cosmeticTypes ? { types: cosmeticTypes } : {}),
            id: detail.id || 0,
            displayName: formLabel ? `${defaultPokemon.name} (${formLabel})` : defaultPokemon.name,
            form: formLabel || (formName !== linkedRawName ? this.capitalize(formName.replace(linkedRawName, '').replace(/^-/, '')) : undefined),
            formType: 'cosplay',
            isDefault: false,
            isMega: false,
            isGmax: false,
            isRegionalVariant: false,
            sprites: {
              official: sprite,
              default: sprite,
              frontShiny: detail.sprites?.other?.['official-artwork']?.front_shiny || detail.sprites?.front_shiny || '',
            },
          };
          if (clone.types !== defaultPokemon.types || cosmeticTypes) {
            this.computeWeaknesses(clone);
          }
          processed.push(clone);
          added++;
        } catch (err: any) {
          console.log(`Failed to fetch cosmetic form ${formName}: ${err.message}`);
        }
      }
      console.log(`DataFetcher: Added ${added} cosmetic forms`);
    } catch (err: any) {
      console.log(`DataFetcher: Cosmetic form fetch failed: ${err.message}`);
    }
  }

  private getCosmeticFormTypes(linkedRawName: string, formName: string): PokemonType[] | null {
    const base = linkedRawName.toLowerCase();
    const part = formName.toLowerCase().startsWith(base + '-')
      ? formName.slice(base.length + 1).toLowerCase()
      : formName.toLowerCase();

    if (base === 'arceus') {
      const plateTypes: Record<string, string> = {
        bug: 'Bug', dark: 'Dark', dragon: 'Dragon', electric: 'Electric',
        fairy: 'Fairy', fighting: 'Fighting', fire: 'Fire', flying: 'Flying',
        ghost: 'Ghost', grass: 'Grass', ground: 'Ground', ice: 'Ice',
        poison: 'Poison', psychic: 'Psychic', rock: 'Rock', steel: 'Steel',
        water: 'Water', normal: 'Normal',
      };
      const type = plateTypes[part];
      if (!type) return null;
      return [{ type, slot: 1 }];
    }

    if (base === 'burmy') {
      const cloakTypes: Record<string, string[]> = {
        sandy: ['Bug', 'Ground'],
        sand: ['Bug', 'Ground'],
        trash: ['Bug', 'Steel'],
        tash: ['Bug', 'Steel'],
        plant: ['Bug', 'Grass'],
      };
      const types = cloakTypes[part];
      if (!types) return null;
      return types.map((t, i) => ({ type: t, slot: i + 1 }));
    }

    return null;
  }

  private getFormPart(rawName: string, speciesRawName: string): string {
    if (rawName === speciesRawName) return '';
    if (rawName.startsWith(speciesRawName + '-')) {
      return rawName.slice(speciesRawName.length + 1);
    }
    return rawName.split('-').slice(1).join('-');
  }

  private getSpeciesDisplayName(species: any): string {
    const names = species.names || [];
    const english = names.find((n: any) => n.language?.name === 'en');
    return english?.name || '';
  }

  private getFormInfo(name: string, isDefault: boolean, species: any, speciesRawName: string): { displayName: string; form?: string; formType: Pokemon['formType'] } {
    const baseDisplayName = this.getSpeciesDisplayName(species) || this.capitalize(speciesRawName.split('-')[0]);
    const formPart = this.getFormPart(name, speciesRawName);

    if (isDefault) {
      if (!formPart) {
        if (speciesRawName === 'unown') {
          return { displayName: 'Unown (F)', form: 'F', formType: 'base' };
        }
        return { displayName: baseDisplayName, formType: 'base' };
      }
      if (formPart.includes('mega')) {
        const megaType = formPart.replace('mega', '').replace('-', '').trim();
        const form = megaType ? `Mega ${megaType.toUpperCase()}` : 'Mega';
        return { displayName: `${baseDisplayName} (${form})`, form, formType: 'mega' };
      }
      if (formPart.includes('gmax')) {
        return { displayName: `${baseDisplayName} (Gigantamax)`, form: 'Gigantamax', formType: 'gigantamax' };
      }
      if (formPart === 'primal') {
        return { displayName: `${baseDisplayName} (Primal)`, form: 'Primal', formType: 'primal' };
      }
      if (formPart === 'alola') {
        return { displayName: `${baseDisplayName} (Alolan)`, form: 'Alolan', formType: 'regional' };
      }
      if (formPart === 'galar') {
        return { displayName: `${baseDisplayName} (Galarian)`, form: 'Galarian', formType: 'regional' };
      }
      if (formPart === 'hisui') {
        return { displayName: `${baseDisplayName} (Hisuian)`, form: 'Hisuian', formType: 'regional' };
      }
      if (formPart === 'paldea' || REGIONAL_TOKENS.has(formPart)) {
        return { displayName: baseDisplayName, form: undefined, formType: 'base' };
      }
      const form = this.capitalize(formPart);
      return { displayName: `${baseDisplayName} (${form})`, form, formType: 'base' };
    }

    if (formPart.includes('mega')) {
      const megaType = formPart.replace('mega', '').replace('-', '').trim();
      const form = megaType ? `Mega ${megaType.toUpperCase()}` : 'Mega';
      return { displayName: `${baseDisplayName} (${form})`, form, formType: 'mega' };
    }

    if (formPart.includes('gmax')) {
      return { displayName: `${baseDisplayName} (Gigantamax)`, form: 'Gigantamax', formType: 'gigantamax' };
    }

    if (formPart === 'primal') {
      return { displayName: `${baseDisplayName} (Primal)`, form: 'Primal', formType: 'primal' };
    }

    if (formPart === 'alola') {
      return { displayName: `${baseDisplayName} (Alolan)`, form: 'Alolan', formType: 'regional' };
    }

    if (formPart === 'galar') {
      return { displayName: `${baseDisplayName} (Galarian)`, form: 'Galarian', formType: 'regional' };
    }

    if (formPart === 'hisui') {
      return { displayName: `${baseDisplayName} (Hisuian)`, form: 'Hisuian', formType: 'regional' };
    }

    if (formPart === 'paldea') {
      return { displayName: `${baseDisplayName} (Paldea)`, form: 'Paldea', formType: 'regional' };
    }

    if (formPart === 'default' || !formPart) {
      return { displayName: baseDisplayName, form: undefined, formType: 'base' };
    }

    return { displayName: `${baseDisplayName} (${this.capitalize(formPart)})`, form: this.capitalize(formPart), formType: 'cosplay' };
  }

  private isRegional(formPart: string): boolean {
    return REGIONAL_TOKENS.has(formPart);
  }

  private getRegionInfo(species: any, generation: number, formPart: string = ''): { region: string; generation: number } {
    const regionalRegion = REGIONAL_REGION_MAP[formPart];
    if (regionalRegion) {
      return { region: regionalRegion, generation };
    }
    if (species && HISUI_ORIGIN_IDS.has(species.id)) {
      return { region: 'Hisui', generation };
    }
    const entry = Object.entries(REGION_MAP).find(([_, v]) => v.generation === generation);
    return {
      region: entry ? entry[1].region : 'Unknown',
      generation,
    };
  }

  private getFlavorText(species: any, formPart: string = ''): string {
    const entries = species.flavor_text_entries || [];
    const englishEntries = entries.filter((e: any) => e.language?.name === 'en');

    let favorite: any;
    const versions = FLAVOR_VERSION_MAP[formPart];
    if (versions) {
      for (const version of versions) {
        favorite = englishEntries.find((e: any) => e.version?.name === version);
        if (favorite) break;
      }
    }
    if (!favorite) favorite = englishEntries[0];
    if (!favorite) return '';

    return favorite.flavor_text.replace(/[\n\f]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private getGenera(species: any): string {
    const genera = species.genera || [];
    const english = genera.find((g: any) => g.language?.name === 'en');
    return english?.genus || '';
  }

  private getStat(stats: any[], name: string): number {
    const stat = stats?.find((s: any) => s.stat?.name === name);
    return stat?.base_stat || 0;
  }

  private capitalize(str: string): string {
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  private parseGeneration(gen: string): number {
    const map: Record<string, number> = { 'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9 };
    return map[gen] || 1;
  }

  private computeWeaknesses(pokemon: Pokemon): void {
    const typeNames = pokemon.types.map(t => t.type);
    const weaknesses: Record<string, { multiplier: number; category: string; description: string }> = {};

    const attackerTypes = [
      'normal', 'fire', 'water', 'grass', 'electric', 'ice',
      'fighting', 'poison', 'ground', 'flying', 'psychic',
      'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
    ];

    for (const attackerType of attackerTypes) {
      const effectiveness = this.calc.getEffectiveness(attackerType, typeNames);
      const categoryData = this.calc.analyzeWeaknesses(attackerType, typeNames);
      weaknesses[attackerType] = {
        multiplier: effectiveness,
        category: categoryData.category,
        description: categoryData.description,
      };
    }

    pokemon.weaknesses = weaknesses;
  }
}

export const dataFetcher = new DataFetcher();
