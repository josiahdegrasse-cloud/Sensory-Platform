import { describe, expect, it } from 'vitest';
import { matchFoodType, sampleMatchesFoodType } from './food-type-context';

describe('food type matching', () => {
  it('classifies meat categories and M-prefixed samples as meat', () => {
    expect(matchFoodType('Pea Protein Burger')).toBe('meat');
    expect(matchFoodType('Plant-based chicken patty')).toBe('meat');
    expect(sampleMatchesFoodType('M12', 'Soy Mince')).toBe('meat');
  });

  it('keeps existing bread and cheese matching intact', () => {
    expect(matchFoodType('Sourdough loaf')).toBe('bread');
    expect(matchFoodType('Coconut-based cheese')).toBe('cheese');
    expect(sampleMatchesFoodType('B4', 'Rye Sourdough')).toBe('bread');
  });
});
