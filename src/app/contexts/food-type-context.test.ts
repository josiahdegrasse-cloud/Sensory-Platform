import { describe, expect, it } from 'vitest';
import { matchFoodType, mergeFoodTypeRecords, registerActiveFoodTypes, sampleMatchesFoodType } from './food-type-context';

describe('food type matching', () => {
  it('classifies meat categories and M-prefixed samples as meat', () => {
    expect(matchFoodType('Pea Protein Burger')).toBe('plant-based-meat');
    expect(matchFoodType('Plant-based chicken patty')).toBe('meat');
    expect(sampleMatchesFoodType('M12', 'Soy Mince')).toBe('meat');
  });

  it('classifies yogurt as its own expandable food type', () => {
    expect(matchFoodType('Greek Yogurt')).toBe('greek-yogurt');
    expect(matchFoodType('Coconut yoghurt')).toBe('plant-based-yogurt');
    expect(sampleMatchesFoodType('Y3', 'Strawberry Skyr')).toBe('yogurt');
  });

  it('keeps existing bread and cheese matching intact', () => {
    expect(matchFoodType('Sourdough loaf')).toBe('sourdough');
    expect(matchFoodType('Coconut-based cheese')).toBe('plant-based-cheese');
    expect(sampleMatchesFoodType('B4', 'Rye Sourdough')).toBe('bread');
  });

  it('does not treat long sauce sample codes as legacy cheese sample IDs', () => {
    expect(sampleMatchesFoodType('SAUCE-20260630-005', 'Spicy Mango Chili Sauce')).toBe('sauce');
    expect(sampleMatchesFoodType('S4', 'Coconut Cheddar')).toBe('cheese');
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

  it('reactivates a locally deleted type when imported data registers it again', () => {
    expect(registerActiveFoodTypes(
      [{ type: 'meat', status: 'deleted' }],
      ['Meat'],
    )).toEqual([{ type: 'meat', status: 'active' }]);
  });
});
