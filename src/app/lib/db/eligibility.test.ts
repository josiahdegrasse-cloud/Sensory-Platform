import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('../supabase', () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

import {
  fetchConceptReadyPanelists,
  fetchEligiblePanelists,
  fetchPanelistSafetyDeclaration,
  fetchSampleAllergenDeclarationsForProducts,
  saveSampleAllergenDeclaration,
  saveSampleAllergenDeclarationsForProducts,
} from './eligibility';

describe('sample eligibility data access', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.from.mockReset();
  });

  it('loads the current declarations for every product in an imported batch', async () => {
    const inQuery = vi.fn().mockResolvedValue({
      data: [{
        id: 'declaration-1', product_id: 'product-1', formulation_version_id: null,
        version: 1, status: 'verified', contains_allergens: ['milk'],
        may_contain_allergens: [], other_allergens: [], ingredient_statement: 'Milk',
        verified_at: '2026-08-19T12:00:00.000Z',
      }],
      error: null,
    });
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ in: inQuery })),
      })),
    });

    await expect(fetchSampleAllergenDeclarationsForProducts(['product-1', 'product-2'])).resolves.toEqual([
      expect.objectContaining({ id: 'declaration-1', productId: 'product-1', status: 'verified', containsAllergens: ['milk'] }),
    ]);
    expect(inQuery).toHaveBeenCalledWith('product_id', ['product-1', 'product-2']);
  });

  it('requests only the eligible roster for the exact product', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        id: 'panelist-1', name: 'Avery', email: 'avery@example.com', panelist_id: 'P-001',
        completed_count: 7, age_years: 31, age_band: '25–34', gender: 'non_binary',
        gender_self_description: null, nationality_code: 'GB', ethnicity: 'mixed', region: 'Leeds',
        household_size: 2, household_size_prefer_not_to_say: false,
        children_in_household: false, dietary_pattern: 'flexitarian', dietary_other: null,
        grocery_role: 'shared_shopper', category_usage_frequency: 'weekly', smoker_status: 'non_smoker',
        weekly_food_spend: '40_60', occupation_group: 'professional', annual_income_range: '40_60k',
      }],
      error: null,
    });

    await expect(fetchEligiblePanelists({ productId: 'product-1' })).resolves.toEqual([
      expect.objectContaining({ id: 'panelist-1', ageYears: 31, nationalityCode: 'GB', completedCount: 7 }),
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith('list_eligible_panelists', { p_product_id: 'product-1' });
  });

  it('loads a concept roster without a product or formulation target', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        id: 'panelist-1', name: 'Avery', email: 'avery@example.com', panelist_id: 'P-001',
        completed_count: 7, age_years: 31, age_band: '25–34', gender: 'non_binary',
        gender_self_description: null, nationality_code: 'GB', ethnicity: 'mixed', region: 'Leeds',
        household_size: 2, household_size_prefer_not_to_say: false,
        children_in_household: false, dietary_pattern: 'flexitarian', dietary_other: null,
        grocery_role: 'shared_shopper', category_usage_frequency: 'weekly', smoker_status: 'non_smoker',
        weekly_food_spend: '40_60', occupation_group: 'professional', annual_income_range: '40_60k',
      }],
      error: null,
    });

    await expect(fetchConceptReadyPanelists()).resolves.toEqual([
      expect.objectContaining({ id: 'panelist-1', ageYears: 31, completedCount: 7 }),
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith('list_concept_ready_panelists');
  });

  it('loads an administrator-visible safety declaration through the audited RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        panelist_id: 'panelist-1',
        allergen_avoidances: ['milk', 'tree_nuts'],
        other_avoidances: ['kiwi'],
        declaration_confirmed_at: '2026-08-17T10:00:00.000Z',
        declaration_expires_at: '2027-08-17T10:00:00.000Z',
        health_consent_at: '2026-08-17T10:00:00.000Z',
        health_consent_version: 'v1',
        adult_confirmed_at: '2026-08-17T10:00:00.000Z',
        age_band: '25–34',
        updated_at: '2026-08-17T10:00:00.000Z',
      }],
      error: null,
    });

    await expect(fetchPanelistSafetyDeclaration('panelist-1')).resolves.toEqual({
      panelistId: 'panelist-1',
      allergenAvoidances: ['milk', 'tree_nuts'],
      otherAvoidances: ['kiwi'],
      declarationConfirmedAt: '2026-08-17T10:00:00.000Z',
      declarationExpiresAt: '2027-08-17T10:00:00.000Z',
      healthConsentAt: '2026-08-17T10:00:00.000Z',
      healthConsentVersion: 'v1',
      adultConfirmedAt: '2026-08-17T10:00:00.000Z',
      ageBand: '25–34',
      updatedAt: '2026-08-17T10:00:00.000Z',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('get_panelist_safety_declaration', {
      target_panelist_id: 'panelist-1',
    });
  });

  it('returns no declaration when the panelist has not submitted one', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    await expect(fetchPanelistSafetyDeclaration('panelist-2')).resolves.toBeNull();
  });

  it('saves contains and may-contain declarations separately before recalculation', async () => {
    mocks.rpc.mockResolvedValue({ data: 'declaration-1', error: null });
    await saveSampleAllergenDeclaration({
      productId: 'product-1',
      containsAllergens: ['milk'],
      mayContainAllergens: ['tree_nuts'],
      otherAllergens: ['kiwi'],
      verify: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith('save_sample_allergen_declaration', {
      p_product_id: 'product-1',
      p_contains_allergens: ['milk'],
      p_may_contain_allergens: ['tree_nuts'],
      p_other_allergens: ['kiwi'],
      p_verify: true,
    });
  });

  it('applies one shared allergen declaration to every survey product', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: 'declaration-1', error: null })
      .mockResolvedValueOnce({ data: 'declaration-2', error: null });

    await expect(saveSampleAllergenDeclarationsForProducts({
      productIds: ['product-1', 'product-2'],
      containsAllergens: ['milk'],
      mayContainAllergens: ['tree_nuts'],
      otherAllergens: [],
      ingredientStatement: 'Milk, almonds',
      verify: true,
    })).resolves.toEqual(['declaration-1', 'declaration-2']);

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'save_sample_allergen_declaration', {
      p_product_id: 'product-1',
      p_contains_allergens: ['milk'],
      p_may_contain_allergens: ['tree_nuts'],
      p_other_allergens: [],
      p_ingredient_statement: 'Milk, almonds',
      p_verify: true,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'save_sample_allergen_declaration', {
      p_product_id: 'product-2',
      p_contains_allergens: ['milk'],
      p_may_contain_allergens: ['tree_nuts'],
      p_other_allergens: [],
      p_ingredient_statement: 'Milk, almonds',
      p_verify: true,
    });
  });
});
