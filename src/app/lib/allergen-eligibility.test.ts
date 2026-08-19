import { describe, expect, it } from 'vitest';
import { ALLERGEN_OPTIONS, splitOtherAvoidances } from './allergen-eligibility';

describe('allergen eligibility vocabulary', () => {
  it('covers the 14 regulated UK allergen groups exactly once', () => {
    expect(ALLERGEN_OPTIONS).toHaveLength(14);
    expect(new Set(ALLERGEN_OPTIONS.map(option => option.code)).size).toBe(14);
    expect(ALLERGEN_OPTIONS.map(option => option.code)).toEqual(expect.arrayContaining([
      'cereals_containing_gluten', 'milk', 'peanuts', 'tree_nuts', 'sulphites',
    ]));
  });

  it('normalizes and deduplicates other avoidances without changing phrases', () => {
    expect(splitOtherAvoidances(' Kiwi, buckwheat\nKIWI,  sesame seed oil ')).toEqual([
      'kiwi', 'buckwheat', 'sesame seed oil',
    ]);
  });
});

