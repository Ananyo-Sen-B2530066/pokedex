export interface PokemonType {
  type: string;
  slot?: number;
}

export interface PokemonStat {
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface PokemonAbility {
  name: string;
  isHidden: boolean;
  description: string;
}

export interface PokemonVariety {
  name: string;
  isDefault: boolean;
  url: string;
}

export interface EvolutionNode {
  speciesId: number;
  rawName: string;
  name: string;
  continuesTo: number[];
  minLevel?: number;
  trigger?: string;
  item?: string;
}

export interface EvolutionChainData {
  speciesId: number;
  rootId: number;
  nodes: EvolutionNode[];
}

export interface Pokemon {
  id: number;
  name: string;
  displayName: string;
  baseName: string;
  types: PokemonType[];
  region: string;
  generation: number;
  form?: string;
  formType: 'base' | 'mega' | 'primal' | 'gigantamax' | 'regional' | 'cosplay';
  isMega: boolean;
  isGmax: boolean;
  isRegionalVariant: boolean;
  isDefault: boolean;

  stats: PokemonStat;
  height: number;
  weight: number;
  abilities: PokemonAbility[];
  sprites: {
    official: string;
    default: string;
    frontShiny: string;
  };
  cries?: {
    latest: string;
    legacy?: string;
  };
  flavorText: string;
  genera: string;

  varieties: PokemonVariety[];
  speciesId: number;

  weaknesses?: Record<string, { multiplier: number; category: string; description: string }>;
  moves?: string[];
  source?: string;
}

export type MoveDamageClass = 'physical' | 'special' | 'status';

export interface Move {
  id: number;
  name: string;
  type: string;
  damageClass: MoveDamageClass;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  generation: number;
  category?: string;
  priority: number | null;
  target?: string;
  description: string;
  effect?: string;
  pokemon?: string[];
}

export interface TypeWeaknessInfo {
  type: string;
  multiplier: number;
  category: 'immunities' | 'resistances' | 'neutral' | 'weaknesses';
  description: string;
}

export interface LoadStatus {
  phase: 'idle' | 'loading-species' | 'loading-pokemon' | 'merging' | 'saving' | 'ready' | 'error';
  totalSpecies: number;
  loadedSpecies: number;
  totalPokemon: number;
  loadedPokemon: number;
  percentComplete: number;
  message: string;
  startedAt?: number;
  completedAt?: number;
}
