import { ALLERGEN_OPTIONS, type AllergenCode } from './allergen-eligibility';

export const PANELIST_PROFILE_DRAFT_STORAGE_PREFIX = 'panelist_profile_draft_';

const DRAFT_VERSION = 1;

export interface PanelistProfileDraft {
  name: string;
  birthMonth: string;
  birthYear: string;
  noKnownAllergies: boolean;
  allergenAvoidances: AllergenCode[];
  lactoseIntolerance: boolean;
  otherAvoidances: string;
  healthConsent: boolean;
  gender: string;
  genderSelfDescription: string;
  nationalityCode: string;
  ethnicity: string;
  householdSize: string;
  dietaryPattern: string;
  dietaryOther: string;
  smokerStatus: string;
  weeklyFoodSpend: string;
  occupationGroup: string;
  annualIncomeRange: string;
  groceryRole: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  consent: boolean;
}

interface StoredPanelistProfileDraft {
  version: number;
  data: PanelistProfileDraft;
}

const stringFields = [
  'name', 'birthMonth', 'birthYear', 'otherAvoidances', 'gender',
  'genderSelfDescription', 'nationalityCode', 'ethnicity', 'householdSize',
  'dietaryPattern', 'dietaryOther', 'smokerStatus', 'weeklyFoodSpend',
  'occupationGroup', 'annualIncomeRange', 'groceryRole', 'phone',
  'addressLine1', 'addressLine2', 'city', 'region', 'postalCode', 'country',
] as const satisfies readonly (keyof PanelistProfileDraft)[];

const booleanFields = [
  'noKnownAllergies', 'lactoseIntolerance', 'healthConsent', 'consent',
] as const satisfies readonly (keyof PanelistProfileDraft)[];

const allergenCodes = new Set<AllergenCode>(ALLERGEN_OPTIONS.map(option => option.code));

function storageKey(userId: string): string {
  return `${PANELIST_PROFILE_DRAFT_STORAGE_PREFIX}${userId}`;
}

function isPanelistProfileDraft(value: unknown): value is PanelistProfileDraft {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return stringFields.every(field => typeof candidate[field] === 'string')
    && booleanFields.every(field => typeof candidate[field] === 'boolean')
    && Array.isArray(candidate.allergenAvoidances)
    && candidate.allergenAvoidances.every(item => allergenCodes.has(item as AllergenCode));
}

export function loadPanelistProfileDraft(
  storage: Pick<Storage, 'getItem'>,
  userId: string,
): PanelistProfileDraft | null {
  try {
    const raw = storage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPanelistProfileDraft>;
    return parsed.version === DRAFT_VERSION && isPanelistProfileDraft(parsed.data)
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}

export function savePanelistProfileDraft(
  storage: Pick<Storage, 'setItem'>,
  userId: string,
  data: PanelistProfileDraft,
): void {
  try {
    const stored: StoredPanelistProfileDraft = { version: DRAFT_VERSION, data };
    storage.setItem(storageKey(userId), JSON.stringify(stored));
  } catch {
    // Account setup must remain usable when browser storage is unavailable.
  }
}

export function clearPanelistProfileDraft(
  storage: Pick<Storage, 'removeItem'>,
  userId: string,
): void {
  try {
    storage.removeItem(storageKey(userId));
  } catch {
    // A completed profile must not be blocked by browser storage cleanup.
  }
}
