import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { resolveProjectPath } from './projectPaths';

const CACHE_TTL = 24 * 60 * 60 * 1000;
const CACHE_VERSION = 3;

// Locates the data directory wherever this code is running (local cwd or the
// Netlify function bundle — see projectPaths.ts).
function getCacheDir(): string {
  const existing = resolveProjectPath('data/cache.json');
  return existing ? path.dirname(existing) : path.join(process.cwd(), 'data');
}
function getCacheFile(): string {
  return path.join(getCacheDir(), 'cache.json');
}
function getCacheBackupFile(): string {
  return path.join(getCacheDir(), 'cache.backup.json');
}
function getCacheTmpFile(): string {
  return path.join(getCacheDir(), 'cache.json.tmp');
}

interface CachedData {
  data: any;
  timestamp: number;
}

class RateLimiter {
  private requests: number[] = [];
  private windowMs: number;
  private maxRequests: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldest = this.requests[0];
      const waitTime = this.windowMs - (now - oldest) + 100;
      console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requests.shift();
    }

    this.requests.push(Date.now());
  }

  reset(): void {
    this.requests = [];
  }
}

export class PokeAPIClient {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;
  private pokemonCache: Map<number, CachedData> = new Map();
  private speciesCache: Map<number, CachedData> = new Map();
  private typeCache: Map<string, CachedData> = new Map();
  private abilityCache: Map<string, CachedData> = new Map();
  private moveCache: Map<string, CachedData> = new Map();
  private moveList: { name: string; url: string }[] | null = null;
  private diskCache: { pokemon: any[]; evolutionChains?: any; moves?: any[]; timestamp: number; version?: number } | null = null;
  private diskCacheReadOnly = false;

  // On serverless platforms the filesystem is read-only outside /tmp, so cache
  // writes are disabled and the committed data/cache.json is treated as a
  // read-only snapshot (refreshed locally and re-committed).
  setDiskCacheReadOnly(v: boolean): void {
    this.diskCacheReadOnly = v;
  }

  getDiskCacheReadOnly(): boolean {
    return this.diskCacheReadOnly;
  }

  constructor() {
    this.client = axios.create({
      baseURL: 'https://pokeapi.co/api/v2',
      timeout: 30000,
      headers: { 'Accept': 'application/json' },
    });
    this.rateLimiter = new RateLimiter(100, 300000);
  }

  private async fetchWithCache<T>(url: string, cache: Map<string, CachedData>): Promise<T> {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data as T;
    }

    await this.rateLimiter.waitIfNeeded();
    const response = await this.client.get(url);
    cache.set(url, { data: response.data, timestamp: Date.now() });
    return response.data as T;
  }

  async getPokemon(idOrName: string | number): Promise<any> {
    const key = typeof idOrName === 'string' ? idOrName.toLowerCase() : idOrName;
    const cached = this.pokemonCache.get(key as number);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    await this.rateLimiter.waitIfNeeded();
    const response = await this.client.get(`/pokemon/${key}`);
    if (typeof key === 'number') {
      this.pokemonCache.set(key, { data: response.data, timestamp: Date.now() });
    }
    return response.data;
  }

  async getPokemonSpecies(idOrName: string | number): Promise<any> {
    const key = typeof idOrName === 'string' ? idOrName.toLowerCase() : idOrName;
    const cached = this.speciesCache.get(key as number);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    await this.rateLimiter.waitIfNeeded();
    const response = await this.client.get(`/pokemon-species/${key}`);
    if (typeof key === 'number') {
      this.speciesCache.set(key, { data: response.data, timestamp: Date.now() });
    }
    return response.data;
  }

  async getTypeData(typeName: string): Promise<any> {
    const key = typeName.toLowerCase();
    const cached = this.typeCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    await this.rateLimiter.waitIfNeeded();
    const response = await this.client.get(`/type/${key}`);
    this.typeCache.set(key, { data: response.data, timestamp: Date.now() });
    return response.data;
  }

  async getAbility(idOrName: string | number): Promise<any> {
    const key = typeof idOrName === 'string' ? idOrName.toLowerCase() : idOrName;
    const cached = this.abilityCache.get(String(key));
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    await this.rateLimiter.waitIfNeeded();
    const response = await this.client.get(`/ability/${key}`);
    this.abilityCache.set(String(key), { data: response.data, timestamp: Date.now() });
    return response.data;
  }

  async getPokemonForm(idOrName: string | number): Promise<any> {
    const key = typeof idOrName === 'string' ? idOrName.toLowerCase() : idOrName;
    await this.rateLimiter.waitIfNeeded();
    const response = await this.client.get(`/pokemon-form/${key}`);
    return response.data;
  }

  async getMoveList(): Promise<{ name: string; url: string }[]> {
    if (this.moveList) return this.moveList;
    const results: { name: string; url: string }[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      await this.rateLimiter.waitIfNeeded();
      const response = await this.client.get(`/move?limit=${limit}&offset=${offset}`);
      results.push(...response.data.results);
      if (!response.data.next) break;
      offset += limit;
    }

    this.moveList = results;
    return results;
  }

  async getMove(idOrName: string | number): Promise<any> {
    const key = typeof idOrName === 'string' ? idOrName.toLowerCase() : idOrName;
    const cacheKey = String(key);
    const cached = this.moveCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    await this.rateLimiter.waitIfNeeded();
    const response = await this.client.get(`/move/${key}`);
    this.moveCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    return response.data;
  }

  async getEvolutionChain(id: number): Promise<any> {
    await this.rateLimiter.waitIfNeeded();
    const response = await this.client.get(`/evolution-chain/${id}`);
    return response.data;
  }

  async getAllPokemonForms(): Promise<{ name: string; url: string }[]> {
    const results: { name: string; url: string }[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      await this.rateLimiter.waitIfNeeded();
      const response = await this.client.get(`/pokemon-form?limit=${limit}&offset=${offset}`);
      results.push(...response.data.results);

      if (!response.data.next) break;
      offset += limit;
    }

    return results;
  }

  async getAllSpeciesIds(): Promise<{ name: string; url: string }[]> {
    const results: { name: string; url: string }[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      await this.rateLimiter.waitIfNeeded();
      const response = await this.client.get(`/pokemon-species?limit=${limit}&offset=${offset}`);
      results.push(...response.data.results);

      if (!response.data.next) break;
      offset += limit;
    }

    return results;
  }

  async getAllPokemonIds(): Promise<{ name: string; url: string }[]> {
    const results: { name: string; url: string }[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      await this.rateLimiter.waitIfNeeded();
      const response = await this.client.get(`/pokemon?limit=${limit}&offset=${offset}`);
      results.push(...response.data.results);

      if (!response.data.next) break;
      offset += limit;
    }

    return results;
  }

  async getPokemonBatch(ids: number[]): Promise<any[]> {
    const results: any[] = [];

    for (const id of ids) {
      try {
        const pokemon = await this.getPokemon(id);
        results.push(pokemon);
      } catch (err: any) {
        console.log(`Failed to fetch pokemon ${id}: ${err.message}`);
      }
    }

    return results;
  }

  async getSpeciesBatch(ids: number[]): Promise<any[]> {
    const results: any[] = [];

    for (const id of ids) {
      try {
        const species = await this.getPokemonSpecies(id);
        results.push(species);
      } catch (err: any) {
        console.log(`Failed to fetch species ${id}: ${err.message}`);
      }
    }

    return results;
  }

  saveDiskCache(pokemon: any[], evolutionChains?: any, moves?: any[]): void {
    if (this.diskCacheReadOnly) {
      console.log('Disk cache writes disabled (read-only mode); skipping save');
      return;
    }
    const CACHE_FILE = getCacheFile();
    const CACHE_TMP_FILE = getCacheTmpFile();
    const CACHE_BACKUP_FILE = getCacheBackupFile();
    const CACHE_DIR = getCacheDir();
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    this.diskCache = { pokemon, evolutionChains, moves, timestamp: Date.now(), version: CACHE_VERSION };
    // Write atomically (tmp + rename) so an interrupted save can never corrupt the
    // primary cache, then mirror it into a backup for the "file vanished" case.
    this.writeCacheFileSync(CACHE_TMP_FILE, CACHE_FILE, this.diskCache);
    try {
      this.writeCacheFileSync(CACHE_TMP_FILE, CACHE_BACKUP_FILE, this.diskCache);
    } catch (err: any) {
      console.log(`Disk cache backup write failed: ${err?.message}`);
    }
    console.log(`Disk cache saved: ${pokemon.length} Pokemon, ${moves ? moves.length : 0} moves`);
  }

  private writeCacheFileSync(tmpPath: string, destPath: string, data: unknown): void {
    fs.writeFileSync(tmpPath, JSON.stringify(data));
    fs.renameSync(tmpPath, destPath);
  }

  loadDiskCache(): { pokemon: any[]; evolutionChains?: any; moves?: any[] } | null {
    const CACHE_FILE = getCacheFile();
    const CACHE_BACKUP_FILE = getCacheBackupFile();
    const primary = this.tryParseCacheFile(CACHE_FILE);
    if (primary) return primary;

    // Primary missing or unusable — fall back to the last good backup and restore
    // the primary from it so future boots use the primary file again.
    console.log('Disk cache primary missing or invalid, trying backup...');
    const backup = this.tryParseCacheFile(CACHE_BACKUP_FILE);
    if (backup) {
      try {
        const CACHE_DIR = getCacheDir();
        if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.copyFileSync(CACHE_BACKUP_FILE, CACHE_FILE);
        console.log('Disk cache restored from backup');
      } catch (err: any) {
        console.log(`Disk cache restore failed: ${err?.message}`);
      }
      return backup;
    }

    console.log('No usable disk cache found, will refetch from PokéAPI');
    return null;
  }

  /**
   * Parse and structurally validate a cache file. Age is intentionally NOT a
   * reason to reject here: an older-but-well-formed cache is still perfectly good
   * to boot from, and freshness is handled afterwards by a background refresh
   * (see DataFetcher.init and isDiskCacheStale).
   */
  private tryParseCacheFile(file: string): { pokemon: any[]; evolutionChains?: any; moves?: any[] } | null {
    try {
      if (!fs.existsSync(file)) return null;
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (data.version !== CACHE_VERSION) {
        console.log(`Disk cache version (${data.version}) != current (${CACHE_VERSION}), ignoring`);
        return null;
      }
      if (!Array.isArray(data.pokemon) || data.pokemon.length <= 100) {
        console.log('Disk cache has no usable pokemon list, ignoring');
        return null;
      }
      const ageMs = Date.now() - (data.timestamp || 0);
      if (data.timestamp && ageMs > CACHE_TTL) {
        console.log(`Disk cache is ${Math.round(ageMs / 3600000)}h old (stale); will use it and refresh in the background`);
      }
      this.diskCache = data;
      console.log(`Disk cache loaded: ${data.pokemon.length} Pokemon, ${data.moves ? data.moves.length : 0} moves`);
      return { pokemon: data.pokemon, evolutionChains: data.evolutionChains, moves: data.moves };
    } catch {
      console.log(`Disk cache unreadable or corrupt: ${file}`);
      return null;
    }
  }

  isDiskCacheStale(): boolean {
    const t = this.diskCache?.timestamp;
    return t != null && Date.now() - t > CACHE_TTL;
  }

  getDiskCacheInfo(): { exists: boolean; timestamp: number | null; ageMs: number | null; version: number | null } {
    try {
      const CACHE_FILE = getCacheFile();
      if (!fs.existsSync(CACHE_FILE)) return { exists: false, timestamp: null, ageMs: null, version: null };
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      const ageMs = Date.now() - (data.timestamp || 0);
      return { exists: true, timestamp: data.timestamp, ageMs, version: data.version };
    } catch {
      return { exists: false, timestamp: null, ageMs: null, version: null };
    }
  }

  getCacheStats() {
    return {
      pokemonCacheSize: this.pokemonCache.size,
      speciesCacheSize: this.speciesCache.size,
      typeCacheSize: this.typeCache.size,
      abilityCacheSize: this.abilityCache.size,
      moveCacheSize: this.moveCache.size,
      moveListLoaded: !!this.moveList,
      diskCacheExists: fs.existsSync(getCacheFile()),
      diskCacheReadOnly: this.diskCacheReadOnly,
    };
  }

  resetRateLimiter(): void {
    this.rateLimiter.reset();
  }
}

export const pokeapiClient = new PokeAPIClient();
