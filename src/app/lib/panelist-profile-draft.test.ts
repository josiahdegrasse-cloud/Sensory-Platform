import { describe, expect, it, vi } from 'vitest';
import {
  clearPanelistProfileDraft,
  loadPanelistProfileDraft,
  PANELIST_PROFILE_DRAFT_STORAGE_PREFIX,
  savePanelistProfileDraft,
  type PanelistProfileDraft,
} from './panelist-profile-draft';

const draft: PanelistProfileDraft = {
  name: 'Avery Johnson',
  birthMonth: '4',
  birthYear: '1990',
  noKnownAllergies: false,
  allergenAvoidances: ['milk'],
  lactoseIntolerance: true,
  otherAvoidances: 'kiwi',
  healthConsent: true,
  gender: 'prefer_not_to_say',
  genderSelfDescription: '',
  nationalityCode: 'GB',
  ethnicity: 'prefer_not_to_say',
  householdSize: '2',
  dietaryPattern: 'omnivore',
  dietaryOther: '',
  smokerStatus: 'non_smoker',
  weeklyFoodSpend: '40_60',
  occupationGroup: 'professional',
  annualIncomeRange: 'prefer_not_to_say',
  groceryRole: 'shared_shopper',
  phone: '+44 7700 900123',
  addressLine1: '12 Market Street',
  addressLine2: '',
  city: 'Leeds',
  region: 'West Yorkshire',
  postalCode: 'LS1 1AA',
  country: 'United Kingdom',
  consent: true,
};

function memoryStorage(initialValue: string | null = null) {
  let value = initialValue;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, nextValue: string) => { value = nextValue; }),
    removeItem: vi.fn(() => { value = null; }),
  };
}

describe('panelist profile drafts', () => {
  it('round-trips non-password account information in user-scoped storage', () => {
    const storage = memoryStorage();
    savePanelistProfileDraft(storage, 'panelist-1', draft);

    expect(storage.setItem).toHaveBeenCalledWith(
      `${PANELIST_PROFILE_DRAFT_STORAGE_PREFIX}panelist-1`,
      expect.not.stringContaining('password'),
    );
    expect(loadPanelistProfileDraft(storage, 'panelist-1')).toEqual(draft);
  });

  it('ignores corrupt or incompatible drafts', () => {
    expect(loadPanelistProfileDraft(memoryStorage('{bad json'), 'panelist-1')).toBeNull();
    expect(loadPanelistProfileDraft(memoryStorage(JSON.stringify({ version: 99, data: draft })), 'panelist-1')).toBeNull();
  });

  it('removes the user-scoped draft after activation', () => {
    const storage = memoryStorage();
    clearPanelistProfileDraft(storage, 'panelist-1');
    expect(storage.removeItem).toHaveBeenCalledWith(`${PANELIST_PROFILE_DRAFT_STORAGE_PREFIX}panelist-1`);
  });
});
