import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    functions: { invoke: mocks.invoke },
    from: vi.fn(),
  },
}));

import { completePanelistProfile, fetchOwnPanelistProfileSetup, fetchPanelists, invitePanelistAccount, panelistShippingAddress } from './panelists';

describe('panelist account workflow', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.invoke.mockReset();
  });

  it('formats a complete shipping address without blank lines', () => {
    expect(panelistShippingAddress({
      addressLine1: '12 Market Street',
      addressLine2: null,
      city: 'Leeds',
      region: 'West Yorkshire',
      postalCode: 'LS1 1AA',
      country: 'United Kingdom',
    })).toBe('12 Market Street\nLeeds, West Yorkshire\nLS1 1AA\nUnited Kingdom');
  });

  it('loads the privacy-conscious administrator directory with research and readiness fields', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        id: 'panelist-1',
        name: 'Avery Johnson',
        email: 'avery@example.com',
        panelist_id: 'NFI-001',
        status: 'active',
        consent_accepted_at: '2026-01-01T00:00:00Z',
        consent_version: 'v1',
        completed_count: 5,
        training_level: 'trained',
        phone: '+44 7700 900123',
        address_line_1: '12 Market Street',
        address_line_2: null,
        city: 'Leeds',
        region: 'West Yorkshire',
        postal_code: 'LS1 1AA',
        country: 'United Kingdom',
        profile_completed_at: '2026-01-01T00:00:00Z',
        eligibility_completed_at: '2026-01-01T00:00:00Z',
        age_years: 31,
        age_band: '25–34',
        gender: 'female',
        gender_self_description: null,
        nationality_code: 'GB',
        ethnicity: 'mixed',
        household_size: 2,
        household_size_prefer_not_to_say: false,
        children_in_household: false,
        dietary_pattern: 'flexitarian',
        dietary_other: null,
        grocery_role: 'shared_shopper',
        category_usage_frequency: 'weekly',
        smoker_status: 'non_smoker',
        weekly_food_spend: '40_60',
        occupation_group: 'professional',
        annual_income_range: '40_60k',
        declaration_confirmed_at: '2026-01-01T00:00:00Z',
        declaration_expires_at: '2027-01-01T00:00:00Z',
        research_profile_updated_at: '2026-01-01T00:00:00Z',
        last_activity_at: '2026-02-01T00:00:00Z',
      }],
      error: null,
    });

    await expect(fetchPanelists()).resolves.toEqual([
      expect.objectContaining({
        id: 'panelist-1',
        ageYears: 31,
        nationalityCode: 'GB',
        dietaryPattern: 'flexitarian',
        declarationExpiresAt: '2027-01-01T00:00:00Z',
        completedCount: 5,
      }),
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith('list_panelist_directory');
  });

  it('loads the signed-in panelist profile for a safe update flow', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        name: 'Avery Johnson', phone: '+44 7700 900123', address_line_1: '12 Market Street',
        address_line_2: null, city: 'Leeds', region: 'West Yorkshire', postal_code: 'LS1 1AA',
        country: 'United Kingdom', birth_month: 4, birth_year: 1990,
        allergen_avoidances: ['milk'], other_avoidances: ['lactose'], gender: 'female',
        gender_self_description: null, nationality_code: 'GB', ethnicity: 'mixed',
        household_size: 2, household_size_prefer_not_to_say: false, children_in_household: false,
        dietary_pattern: 'flexitarian', dietary_other: null, grocery_role: 'shared_shopper',
        category_usage_frequency: 'weekly', smoker_status: 'non_smoker', weekly_food_spend: '40_60',
        occupation_group: 'professional', annual_income_range: '40_60k',
      }],
      error: null,
    });
    await expect(fetchOwnPanelistProfileSetup()).resolves.toEqual(expect.objectContaining({
      name: 'Avery Johnson', nationalityCode: 'GB', allergenAvoidances: ['milk'], otherAvoidances: ['lactose'],
    }));
    expect(mocks.rpc).toHaveBeenCalledWith('get_own_panelist_profile_setup');
  });

  it('sends only the invited email and profile route to the invitation function', async () => {
    mocks.invoke.mockResolvedValue({ data: { invited: true }, error: null });
    await invitePanelistAccount(' Panelist@Example.com ', 'https://sensory.example/panelist/profile');
    expect(mocks.invoke).toHaveBeenCalledWith('invite-panelist', {
      body: {
        email: 'panelist@example.com',
        redirectTo: 'https://sensory.example/panelist/profile',
      },
    });
  });

  it('writes adult safety and shipping details through the constrained profile RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await completePanelistProfile({
      name: 'Avery Johnson',
      phone: '+44 7700 900123',
      addressLine1: '12 Market Street',
      city: 'Leeds',
      postalCode: 'LS1 1AA',
      country: 'United Kingdom',
      consentVersion: 'v1',
      birthMonth: 4,
      birthYear: 1990,
      allergenAvoidances: ['milk'],
      otherAvoidances: [],
      healthConsentVersion: 'safety-v1',
      gender: 'female',
      nationalityCode: 'GB',
      ethnicity: 'mixed',
      householdSize: 2,
      dietaryPattern: 'flexitarian',
      groceryRole: 'shared_shopper',
      smokerStatus: 'non_smoker',
      weeklyFoodSpend: '40_60',
      occupationGroup: 'professional',
      annualIncomeRange: '40_60k',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('complete_panelist_eligibility_profile', expect.objectContaining({
      p_name: 'Avery Johnson',
      p_phone: '+44 7700 900123',
      p_address_line_1: '12 Market Street',
      p_postal_code: 'LS1 1AA',
      p_country: 'United Kingdom',
      p_consent_version: 'v1',
      p_birth_month: 4,
      p_birth_year: 1990,
      p_allergen_avoidances: ['milk'],
      p_health_consent_version: 'safety-v1',
      p_gender: 'female',
      p_nationality_code: 'GB',
      p_ethnicity: 'mixed',
      p_smoker_status: 'non_smoker',
    }));
  });
});
