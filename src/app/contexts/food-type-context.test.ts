import { describe, expect, it } from 'vitest';
import { matchFoodType, mergeFoodTypeRecords, sampleMatchesFoodType } from './food-type-context';

describe('food type matching', () => {
  it('classifies meat categories and M-prefixed samples as meat', () => {
    expect(matchFoodType('Pea Protein Burger')).toBe('meat');
    expect(matchFoodType('Plant-based chicken patty')).toBe('meat');
    expect(sampleMatchesFoodType('M12', 'Soy Mince')).toBe('meat');
  });

  it('classifies yogurt as its own expandable food type', () => {
    expect(matchFoodType('Greek Yogurt')).toBe('yogurt');
    expect(matchFoodType('Coconut yoghurt')).toBe('yogurt');
    expect(sampleMatchesFoodType('Y3', 'Strawberry Skyr')).toBe('yogurt');
  });

  it('keeps existing bread and cheese matching intact', () => {
    expect(matchFoodType('Sourdough loaf')).toBe('bread');
    expect(matchFoodType('Coconut-based cheese')).toBe('cheese');
    expect(sampleMatchesFoodType('B4', 'Rye Sourdough')).toBe('bread');
  });

  it('lets an optimistic delete override stale active database data', () => {
    expect(mergeFoodTypeRecords(
      [{ type: 'meat', status: 'active' }],
      [{ type: 'meat', status: 'deleted' }],
    )).toEqual([{ type: 'meat', status: 'deleted' }]);
  });

  it('tracks deletion status for built-in food types', () => {
    expect(mergeFoodTypeRecords(
      [
        { type: 'bread', status: 'active' },
        { type: 'cheese', status: 'deleted' },
      ],
      [],
    )).toEqual([
      { type: 'bread', status: 'active' },
      { type: 'cheese', status: 'deleted' },
    ]);
  });
});
