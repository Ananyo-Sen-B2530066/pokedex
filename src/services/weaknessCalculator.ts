import { TYPE_EFFECTIVENESS } from '../types/typeChart';
import { Pokemon, TypeWeaknessInfo } from '../models/pokemonModel';

export class WeaknessCalculator {

  getEffectiveness(attackerType: string, defenderTypes: string[]): number {
    let multiplier = 1;

    for (const defType of defenderTypes) {
      // Normalize case: capitalize first letter for chart lookup
      const normalizedDefType = defType.charAt(0).toUpperCase() + defType.slice(1).toLowerCase();
      const normalizedAtkType = attackerType.charAt(0).toUpperCase() + attackerType.slice(1).toLowerCase();

      const effectiveness = TYPE_EFFECTIVENESS[normalizedAtkType]?.[normalizedDefType];
      if (effectiveness === undefined) {
        continue;
      }
      multiplier *= effectiveness;
    }

    return multiplier;
  }

  analyzeWeaknesses(attackerType: string, defenderTypes: string[]): TypeWeaknessInfo {
    const multiplier = this.getEffectiveness(attackerType, defenderTypes);

    const categories: Record<number, TypeWeaknessInfo> = {
      0: {
        type: attackerType,
        multiplier: 0,
        category: 'immunities',
        description: 'No effect',
      },
      0.25: {
        type: attackerType,
        multiplier: 0.25,
        category: 'resistances',
        description: 'Quadruple resistance',
      },
      0.5: {
        type: attackerType,
        multiplier: 0.5,
        category: 'resistances',
        description: 'Double resistance',
      },
      1: {
        type: attackerType,
        multiplier: 1,
        category: 'neutral',
        description: 'Neutral effect',
      },
      2: {
        type: attackerType,
        multiplier: 2,
        category: 'weaknesses',
        description: 'Double weakness',
      },
      4: {
        type: attackerType,
        multiplier: 4,
        category: 'weaknesses',
        description: 'Quadruple weakness',
      },
    };

    return categories[multiplier] || categories[1];
  }

  getPokemonWeaknesses(pokemon: Pokemon, attackerType: string): TypeWeaknessInfo {
    const typeNames = pokemon.types.map(t => t.type);
    return this.analyzeWeaknesses(attackerType, typeNames);
  }

  getTimesOfWeakness(multiplier: number): string {
    if (multiplier === 0) return 'Immunity';
    if (multiplier === 0.25) return 'Quadruple Resistance';
    if (multiplier === 0.5) return 'Double Resistance';
    if (multiplier === 1) return 'Neutral';
    if (multiplier === 2) return 'Double Weakness';
    if (multiplier === 4) return 'Quadruple Weakness';
    return 'Unknown';
  }

  getTypeWeaknessSummary(pokemon: Pokemon): Record<string, TypeWeaknessInfo> {
    const summary: Record<string, TypeWeaknessInfo> = {};
    const attackerTypes = Object.keys(TYPE_EFFECTIVENESS);

    for (const attackerType of attackerTypes) {
      const weaknesses = this.analyzeWeaknesses(attackerType, pokemon.types.map(t => t.type));
      summary[attackerType] = weaknesses;
    }

    return summary;
  }
}