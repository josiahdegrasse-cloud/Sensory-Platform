import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SampleAllergenDeclaration } from '../lib/db/eligibility';
import { BatchSampleAllergenDeclarationEditor, SampleAllergenDeclarationEditor } from './sample-allergen-declaration';

const state = vi.hoisted(() => ({ declarations: [] as SampleAllergenDeclaration[] }));
vi.mock('../lib/hooks', () => ({
  useSampleAllergenDeclarationsForProducts: () => ({ data: state.declarations, isLoading: false }),
  useSampleAllergenDeclaration: () => ({ data: state.declarations[0], isLoading: false }),
  useSaveSampleAllergenDeclarationsForProducts: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSaveSampleAllergenDeclaration: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const productIds = Array.from({ length: 6 }, (_, index) => `sample-${index}`);
const renderBatch = () => renderToStaticMarkup(createElement(BatchSampleAllergenDeclarationEditor, { productIds, sampleName: 'Cheddar demo' }));

describe('verified allergen review', () => {
  beforeEach(() => {
    state.declarations = productIds.map(productId => ({
      id: `declaration-${productId}`, productId, formulationVersionId: null,
      version: 1, status: 'verified', containsAllergens: [], mayContainAllergens: [],
      otherAllergens: [], ingredientStatement: null, verifiedAt: '2026-09-30T12:00:00Z',
    }));
  });

  it('reopens a verified six-survey batch as a locked summary without review controls', () => {
    const html = renderBatch();
    expect(html).toContain('Verified for all 6 surveys');
    expect(html).toContain('No declared allergens.');
    expect(html).toContain('Edit declaration');
    expect(html).not.toContain('Verify for all surveys');
    expect(html).not.toContain('role="checkbox"');
  });

  it.each(['draft', 'missing'] as const)('keeps the checklist open when one survey is %s', condition => {
    if (condition === 'missing') state.declarations.pop();
    else state.declarations[5].status = 'draft';
    const html = renderBatch();
    expect(html).toContain('Verify for all surveys');
    expect(html).not.toContain('Verified for all 6 surveys');
  });

  it('includes allergens from every survey instead of implying the first represents them all', () => {
    state.declarations[5].containsAllergens = ['milk'];
    state.declarations[3].mayContainAllergens = ['tree_nuts'];
    const html = renderBatch();
    expect(html).toContain('Milk');
    expect(html).toContain('Tree nuts (may contain)');
    expect(html).not.toContain('No declared allergens.');
  });

  it('locks a saved individual declaration too', () => {
    const html = renderToStaticMarkup(createElement(SampleAllergenDeclarationEditor, {
      target: { productId: productIds[0] }, sampleName: 'Cheddar demo',
    }));
    expect(html).toContain('Allergen declaration verified');
    expect(html).toContain('Edit declaration');
    expect(html).not.toContain('Verify declaration');
  });
});
