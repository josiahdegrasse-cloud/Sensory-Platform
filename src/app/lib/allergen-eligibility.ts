export const ALLERGEN_OPTIONS = [
  { code: 'celery', label: 'Celery' },
  { code: 'cereals_containing_gluten', label: 'Cereals containing gluten', detail: 'Wheat, rye, barley and oats' },
  { code: 'crustaceans', label: 'Crustaceans', detail: 'Such as prawns, crab and lobster' },
  { code: 'eggs', label: 'Eggs' },
  { code: 'fish', label: 'Fish' },
  { code: 'lupin', label: 'Lupin' },
  { code: 'milk', label: 'Milk' },
  { code: 'molluscs', label: 'Molluscs', detail: 'Such as mussels, oysters and squid' },
  { code: 'mustard', label: 'Mustard' },
  { code: 'peanuts', label: 'Peanuts' },
  { code: 'sesame', label: 'Sesame' },
  { code: 'soybeans', label: 'Soya' },
  { code: 'sulphites', label: 'Sulphur dioxide and sulphites' },
  { code: 'tree_nuts', label: 'Tree nuts', detail: 'Almonds, hazelnuts, walnuts, cashews, pecans, Brazil nuts, pistachios and macadamias' },
] as const;

export type AllergenCode = typeof ALLERGEN_OPTIONS[number]['code'];

export const ALLERGEN_LABELS = Object.fromEntries(
  ALLERGEN_OPTIONS.map(option => [option.code, option.label]),
) as Record<AllergenCode, string>;

export const HEALTH_CONSENT_VERSION = 'panelist-allergen-safety-v1.1';

export const GENDER_OPTIONS = [
  ['female', 'Female'],
  ['male', 'Male'],
  ['non_binary', 'Non-binary'],
  ['self_describe', 'Prefer to self-describe'],
  ['prefer_not_to_say', 'Prefer not to say'],
] as const;

export const DIETARY_PATTERN_OPTIONS = [
  ['omnivore', 'Omnivore'],
  ['flexitarian', 'Flexitarian'],
  ['pescatarian', 'Pescatarian'],
  ['vegetarian', 'Vegetarian'],
  ['vegan', 'Vegan'],
  ['halal', 'Halal'],
  ['kosher', 'Kosher'],
  ['other', 'Other'],
  ['prefer_not_to_say', 'Prefer not to say'],
] as const;

export const GROCERY_ROLE_OPTIONS = [
  ['main_shopper', 'Main grocery shopper'],
  ['shared_shopper', 'Share grocery shopping'],
  ['occasional_shopper', 'Occasional grocery shopper'],
  ['not_involved', 'Not involved in grocery shopping'],
  ['prefer_not_to_say', 'Prefer not to say'],
] as const;

export function splitOtherAvoidances(value: string): string[] {
  return Array.from(new Set(value.split(/[,\n]/).map(item => item.trim().toLowerCase()).filter(Boolean)));
}
