import { describe, expect, it } from 'vitest';
import {
  compareFormulationVersions,
  deriveStructuredIngredients,
  splitIngredientStatement,
  verifiedAllergenTags,
  type FormulationVersion,
} from './formulation-profile';

function version(overrides: Partial<FormulationVersion>): FormulationVersion {
  return {
    id: 'version-1',
    instrumentalSampleId: 'sample-db-1',
    projectId: 'project-1',
    importBatchId: 'batch-1',
    sampleId: 'A1',
    sampleName: 'Prototype A',
    versionNumber: 1,
    exactStatement: 'Water, milk, salt',
    statementSource: 'manual',
    fingerprint: 'abc123',
    isCurrent: true,
    reviewStatus: 'pending_review',
    changeSummary: null,
    createdAt: '2026-07-15T00:00:00Z',
    reviewedAt: null,
    ingredients: deriveStructuredIngredients('Water, milk, salt'),
    ...overrides,
  };
}

describe('formulation profile', () => {
  it('preserves parenthetical sub-ingredients as one ordered ingredient', () => {
    expect(splitIngredientStatement('Water, Base (cashew, starch, salt), Cultures; Oil')).toEqual([
      'Water',
      'Base (cashew, starch, salt)',
      'Cultures',
      'Oil',
    ]);
  });

  it('copies only explicit percentages and marks classifications as suggestions', () => {
    const ingredients = deriveStructuredIngredients('Water, Pea Protein (12%), Salt, Natural flavour');
    expect(ingredients[0].percentage).toBeNull();
    expect(ingredients[1]).toEqual(expect.objectContaining({
      suppliedName: 'Pea Protein (12%)',
      percentage: 12,
      functionalRole: 'Protein system',
      reviewStatus: 'suggested',
    }));
  });

  it('does not expose suggested allergens as verified safety data', () => {
    const suggested = version({ reviewStatus: 'reviewed' });
    expect(verifiedAllergenTags(suggested)).toEqual([]);

    const reviewed = version({
      reviewStatus: 'reviewed',
      ingredients: suggested.ingredients.map(item => ({
        ...item,
        reviewStatus: 'verified',
      })),
    });
    expect(verifiedAllergenTags(reviewed)).toEqual(['Milk']);
  });

  it('shows ingredient additions, removals, and reordering between versions', () => {
    const before = version({ ingredients: deriveStructuredIngredients('Water, salt, milk') });
    const after = version({
      id: 'version-2',
      versionNumber: 2,
      ingredients: deriveStructuredIngredients('Milk, water, cultures'),
    });
    expect(compareFormulationVersions(after, before)).toEqual({
      added: ['cultures'],
      removed: ['salt'],
      reordered: ['Milk', 'water'],
    });
  });
});
