import { Move } from '../models/pokemonModel';

export const GMAX_MOVES: Move[] = [
  { id: 10019, name: 'G-Max Wildfire', type: 'Fire', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'selected-pokemon', description: 'A Fire-type attack that Gigantamax Charizard use. This move continues to deal damage to opponents for four turns.', pokemon: ['Charizard'] },
  { id: 10020, name: 'G-Max Cannonade', type: 'Water', damageClass: 'special', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'selected-pokemon', description: 'A Water-type attack that Gigantamax Blastoise use. This move continues to deal damage to opponents for four turns.', pokemon: ['Blastoise'] },
  { id: 10021, name: 'G-Max Befuddle', type: 'Bug', damageClass: 'special', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'selected-pokemon', description: 'A Bug-type attack that Gigantamax Butterfree use. This move inflicts poison, paralysis, or sleep on opponents.', pokemon: ['Butterfree'] },
  { id: 10022, name: 'G-Max Volt Crash', type: 'Electric', damageClass: 'special', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'An Electric-type attack that Gigantamax Pikachu use. This move paralyzes all opponents.', pokemon: ['Pikachu'] },
  { id: 10023, name: 'G-Max Gold Rush', type: 'Normal', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Normal-type attack that Gigantamax Meowth use. This move confuses all opponents and earns extra money.', pokemon: ['Meowth'] },
  { id: 10024, name: 'G-Max Chi Strike', type: 'Fighting', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Fighting-type attack that Gigantamax Machamp use. This move raises the chance of critical hits for the user and its allies.', pokemon: ['Machamp'] },
  { id: 10025, name: 'G-Max Terror', type: 'Ghost', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Ghost-type attack that Gigantamax Gengar use. This move prevents opponents from escaping.', pokemon: ['Gengar'] },
  { id: 10026, name: 'G-Max Foam Burst', type: 'Water', damageClass: 'special', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Water-type attack that Gigantamax Kingler use. This move harshly lowers the Speed of all opponents.', pokemon: ['Kingler'] },
  { id: 10027, name: 'G-Max Resonance', type: 'Ice', damageClass: 'special', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'An Ice-type attack that Gigantamax Lapras use. This move reduces damage from Physical and Special moves for five turns.', pokemon: ['Lapras'] },
  { id: 10028, name: 'G-Max Cuddle', type: 'Normal', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Normal-type attack that Gigantamax Eevee use. This move infatuates opponents of the opposite gender.', pokemon: ['Eevee'] },
  { id: 10029, name: 'G-Max Replenish', type: 'Normal', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Normal-type attack that Gigantamax Snorlax use. This move restores the user\'s or an ally\'s used Berries.', pokemon: ['Snorlax'] },
  { id: 10030, name: 'G-Max Malodor', type: 'Poison', damageClass: 'special', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Poison-type attack that Gigantamax Garbodor use. This move poisons all opponents.', pokemon: ['Garbodor'] },
  { id: 10031, name: 'G-Max Meltdown', type: 'Steel', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Steel-type attack that Gigantamax Melmetal use. This move makes opponents unable to use the same move twice in a row.', pokemon: ['Melmetal'] },
  { id: 10032, name: 'G-Max Drum Solo', type: 'Grass', damageClass: 'physical', power: 160, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'selected-pokemon', description: 'A Grass-type attack that Gigantamax Rillaboom use. This move ignores the effects of the target\'s Ability.', pokemon: ['Rillaboom'] },
  { id: 10033, name: 'G-Max Fireball', type: 'Fire', damageClass: 'physical', power: 160, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'selected-pokemon', description: 'A Fire-type attack that Gigantamax Cinderace use. This move ignores the effects of the target\'s Ability.', pokemon: ['Cinderace'] },
  { id: 10034, name: 'G-Max Hydrosnipe', type: 'Water', damageClass: 'special', power: 160, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'selected-pokemon', description: 'A Water-type attack that Gigantamax Inteleon use. This move ignores the effects of the target\'s Ability.', pokemon: ['Inteleon'] },
  { id: 10035, name: 'G-Max Wind Rage', type: 'Flying', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Flying-type attack that Gigantamax Corviknight use. This move removes the effects of moves like Reflect and Light Screen.', pokemon: ['Corviknight'] },
  { id: 10036, name: 'G-Max Gravitas', type: 'Psychic', damageClass: 'special', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Psychic-type attack that Gigantamax Orbeetle use. This move intensifies gravity for five turns.', pokemon: ['Orbeetle'] },
  { id: 10037, name: 'G-Max Stonesurge', type: 'Water', damageClass: 'special', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Water-type attack that Gigantamax Drednaw use. This move scatters sharp rocks around the field.', pokemon: ['Drednaw'] },
  { id: 10038, name: 'G-Max Volcalith', type: 'Rock', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Rock-type attack that Gigantamax Coalossal use. This move continues to deal damage to opponents for four turns.', pokemon: ['Coalossal'] },
  { id: 10039, name: 'G-Max Tartness', type: 'Grass', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Grass-type attack that Gigantamax Flapple use. This move lowers the evasiveness of all opponents.', pokemon: ['Flapple'] },
  { id: 10040, name: 'G-Max Sweetness', type: 'Grass', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Grass-type attack that Gigantamax Appletun use. This move cures the status conditions of the user and its allies.', pokemon: ['Appletun'] },
  { id: 10041, name: 'G-Max Sandblast', type: 'Ground', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Ground-type attack that Gigantamax Sandaconda use. This move traps opponents in a raging sandstorm for four to five turns.', pokemon: ['Sandaconda'] },
  { id: 10042, name: 'G-Max Stun Shock', type: 'Electric', damageClass: 'special', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'An Electric-type attack that Gigantamax Toxtricity use. This move inflicts poison or paralysis on opponents.', pokemon: ['Toxtricity'] },
  { id: 10043, name: 'G-Max Centiferno', type: 'Fire', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Fire-type attack that Gigantamax Centiskorch use. This move traps opponents in flames for four to five turns.', pokemon: ['Centiskorch'] },
  { id: 10044, name: 'G-Max Smite', type: 'Fairy', damageClass: 'special', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Fairy-type attack that Gigantamax Hatterene use. This move confuses all opponents.', pokemon: ['Hatterene'] },
  { id: 10045, name: 'G-Max Snooze', type: 'Dark', damageClass: 'special', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Dark-type attack that Gigantamax Grimmsnarl use. This move makes the target drowsy, causing it to fall asleep on the next turn.', pokemon: ['Grimmsnarl'] },
  { id: 10046, name: 'G-Max Finale', type: 'Fairy', damageClass: 'special', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Fairy-type attack that Gigantamax Alcremie use. This move heals the HP of the user and its allies.', pokemon: ['Alcremie'] },
  { id: 10047, name: 'G-Max Steelsurge', type: 'Steel', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Steel-type attack that Gigantamax Copperajah use. This move scatters sharp spikes around the field.', pokemon: ['Copperajah'] },
  { id: 10048, name: 'G-Max Depletion', type: 'Dragon', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'all-opponents', description: 'A Dragon-type attack that Gigantamax Duraludon use. This move takes away PP from the last move the target used.', pokemon: ['Duraludon'] },
  { id: 10049, name: 'G-Max One Blow', type: 'Dark', damageClass: 'special', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'selected-pokemon', description: 'A Dark-type attack that Single Strike Gigantamax Urshifu use. This move can hit through guarding moves like Protect and Max Guard.', pokemon: ['Urshifu'] },
  { id: 10050, name: 'G-Max Rapid Flow', type: 'Water', damageClass: 'special', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'selected-pokemon', description: 'A Water-type attack that Rapid Strike Gigantamax Urshifu use. This move can hit through guarding moves like Protect and Max Guard.', pokemon: ['Urshifu'] },
  { id: 10051, name: 'G-Max Vine Lash', type: 'Grass', damageClass: 'physical', power: 140, accuracy: 100, pp: 10, generation: 8, category: 'Max Move', priority: 0, target: 'selected-pokemon', description: 'A Grass-type attack that Gigantamax Venusaur use. This move continues to deal damage to opponents for four turns.', pokemon: ['Venusaur'] },
];

export type MoveKind = 'z' | 'max' | 'gigantamax' | 'standard';

const range = (a: number, b: number): number[] => {
  const r: number[] = [];
  for (let i = a; i <= b; i++) r.push(i);
  return r;
};

// PokeAPI move IDs for Z-Moves (typed Z-moves, signature Z-moves, and 10,000,000 Volt Thunderbolt).
const Z_MOVE_IDS = new Set<number>([
  ...range(622, 658),
  ...range(695, 703),
  719,
  ...range(723, 728),
]);

export function classifyMoveKind(id: number, name: string): MoveKind {
  const n = name.toLowerCase();
  if (n.startsWith('g-max')) return 'gigantamax';
  if (n.startsWith('max ')) return 'max';
  if (n.startsWith('z-')) return 'z';
  if (Z_MOVE_IDS.has(id)) return 'z';
  return 'standard';
}

const norm = (s: string) => s.toLowerCase().replace(/[-\s]/g, ' ').replace(/\s+/g, ' ').trim();
const byName = new Map<string, Move>();
for (const m of GMAX_MOVES) byName.set(norm(m.name), m);
const byId = new Map<number, Move>();
for (const m of GMAX_MOVES) byId.set(m.id, m);

export function getGMaxMoveById(id: number): Move | undefined {
  return byId.get(id);
}

export function getGMaxMoveByName(name: string): Move | undefined {
  return byName.get(norm(name));
}

export interface ZMoveRequirement {
  pokemon: string;
  requires: string;
}

// Signature Z-Moves only trigger when the Pokémon holding the matching Z-Crystal
// knows its required signature move. Listed per official game data.
const Z_MOVE_REQUIREMENTS: Record<string, ZMoveRequirement> = {
  'catastropika': { pokemon: 'Pikachu', requires: 'Volt Tackle' },
  'sinister arrow raid': { pokemon: 'Decidueye', requires: 'Spirit Shackle' },
  'malicious moonsault': { pokemon: 'Incineroar', requires: 'Darkest Lariat' },
  'oceanic operetta': { pokemon: 'Primarina', requires: 'Sparkling Aria' },
  'guardian of alola': { pokemon: 'Tapu Koko, Tapu Lele, Tapu Bulu, or Tapu Fini', requires: "Nature's Madness" },
  'soul-stealing 7-star strike': { pokemon: 'Marshadow', requires: 'Spectral Thief' },
  'stoked sparksurfer': { pokemon: 'Alolan Raichu', requires: 'Thunderbolt' },
  'pulverizing pancake': { pokemon: 'Snorlax', requires: 'Giga Impact' },
  'extreme evoboost': { pokemon: 'Eevee', requires: 'Last Resort' },
  'genesis supernova': { pokemon: 'Mew', requires: 'Psychic' },
  '10,000,000 volt thunderbolt': { pokemon: 'Pikachu wearing a cap', requires: 'Thunderbolt' },
  'light that burns the sky': { pokemon: 'Ultra Necrozma', requires: 'Photon Geyser' },
  'searing sunraze smash': { pokemon: 'Solgaleo or Dusk Mane Necrozma', requires: 'Sunsteel Strike' },
  'menacing moonraze maelstrom': { pokemon: 'Lunala or Dawn Wings Necrozma', requires: 'Moongeist Beam' },
  "let's snuggle forever": { pokemon: 'Mimikyu', requires: 'Play Rough' },
  'splintered stormshards': { pokemon: 'Lycanroc', requires: 'Stone Edge' },
  'clangorous soulblaze': { pokemon: 'Kommo-o', requires: 'Clanging Scales' },
};

const normReqKey = (s: string) =>
  s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[,.\s-]+/g, ' ').trim();

const Z_MOVE_REQ_BY_NORM = new Map<string, ZMoveRequirement>();
for (const [key, req] of Object.entries(Z_MOVE_REQUIREMENTS)) {
  Z_MOVE_REQ_BY_NORM.set(normReqKey(key), req);
}

export function getZMoveRequirement(name: string): ZMoveRequirement | undefined {
  return Z_MOVE_REQ_BY_NORM.get(normReqKey(name));
}
