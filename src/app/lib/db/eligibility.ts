import { supabase } from '../supabase';
import type { AllergenCode } from '../allergen-eligibility';
import { dbError } from './shared';

export interface SampleAllergenDeclaration {
  id: string;
  productId: string | null;
  formulationVersionId: string | null;
  version: number;
  status: 'draft' | 'verified' | 'superseded';
  containsAllergens: AllergenCode[];
  mayContainAllergens: AllergenCode[];
  otherAllergens: string[];
  ingredientStatement: string | null;
  verifiedAt: string | null;
}

export interface EligiblePanelist {
  id: string;
  name: string;
  email: string | null;
  panelistId: string | null;
  completedCount: number;
  ageYears: number;
  ageBand: string;
  gender: string | null;
  genderSelfDescription: string | null;
  nationalityCode: string | null;
  ethnicity: string | null;
  region: string | null;
  householdSize: number | null;
  householdSizePreferNotToSay: boolean;
  childrenInHousehold: boolean | null;
  dietaryPattern: string | null;
  dietaryOther: string | null;
  groceryRole: string | null;
  categoryUsageFrequency: string | null;
  smokerStatus: string | null;
  weeklyFoodSpend: string | null;
  occupationGroup: string | null;
  annualIncomeRange: string | null;
}

export interface SampleEligibilityTarget {
  productId?: string | null;
  formulationVersionId?: string | null;
}

export interface PanelistSafetyDeclaration {
  panelistId: string;
  allergenAvoidances: AllergenCode[];
  otherAvoidances: string[];
  declarationConfirmedAt: string;
  declarationExpiresAt: string;
  healthConsentAt: string;
  healthConsentVersion: string;
  adultConfirmedAt: string;
  ageBand: string;
  updatedAt: string;
}

export async function fetchPanelistSafetyDeclaration(panelistId: string): Promise<PanelistSafetyDeclaration | null> {
  const { data, error } = await supabase.rpc('get_panelist_safety_declaration', {
    target_panelist_id: panelistId,
  });
  if (error) throw dbError(error);
  const row = data?.[0];
  if (!row) return null;
  return {
    panelistId: row.panelist_id,
    allergenAvoidances: row.allergen_avoidances as AllergenCode[],
    otherAvoidances: row.other_avoidances,
    declarationConfirmedAt: row.declaration_confirmed_at,
    declarationExpiresAt: row.declaration_expires_at,
    healthConsentAt: row.health_consent_at,
    healthConsentVersion: row.health_consent_version,
    adultConfirmedAt: row.adult_confirmed_at,
    ageBand: row.age_band,
    updatedAt: row.updated_at,
  };
}

function targetArgs(target: SampleEligibilityTarget) {
  return {
    ...(target.productId ? { p_product_id: target.productId } : {}),
    ...(target.formulationVersionId ? { p_formulation_version_id: target.formulationVersionId } : {}),
  };
}

export async function fetchSampleAllergenDeclaration(
  target: SampleEligibilityTarget,
): Promise<SampleAllergenDeclaration | null> {
  let query = supabase
    .from('sample_allergen_declarations')
    .select('id, product_id, formulation_version_id, version, status, contains_allergens, may_contain_allergens, other_allergens, ingredient_statement, verified_at')
    .eq('is_current', true);
  query = target.productId
    ? query.eq('product_id', target.productId)
    : query.eq('formulation_version_id', target.formulationVersionId ?? '');
  const { data, error } = await query.maybeSingle();
  if (error) throw dbError(error);
  return data ? mapSampleAllergenDeclaration(data) : null;
}

function mapSampleAllergenDeclaration(data: {
  id: string;
  product_id: string | null;
  formulation_version_id: string | null;
  version: number;
  status: string;
  contains_allergens: string[];
  may_contain_allergens: string[];
  other_allergens: string[];
  ingredient_statement: string | null;
  verified_at: string | null;
}): SampleAllergenDeclaration {
  return {
    id: data.id,
    productId: data.product_id,
    formulationVersionId: data.formulation_version_id,
    version: data.version,
    status: data.status as SampleAllergenDeclaration['status'],
    containsAllergens: data.contains_allergens as AllergenCode[],
    mayContainAllergens: data.may_contain_allergens as AllergenCode[],
    otherAllergens: data.other_allergens,
    ingredientStatement: data.ingredient_statement,
    verifiedAt: data.verified_at,
  };
}

export async function fetchSampleAllergenDeclarationsForProducts(productIds: string[]): Promise<SampleAllergenDeclaration[]> {
  if (productIds.length === 0) return [];
  const { data, error } = await supabase
    .from('sample_allergen_declarations')
    .select('id, product_id, formulation_version_id, version, status, contains_allergens, may_contain_allergens, other_allergens, ingredient_statement, verified_at')
    .eq('is_current', true)
    .in('product_id', productIds);
  if (error) throw dbError(error);
  return (data ?? []).map(mapSampleAllergenDeclaration);
}

export async function saveSampleAllergenDeclaration(input: SampleEligibilityTarget & {
  containsAllergens: AllergenCode[];
  mayContainAllergens: AllergenCode[];
  otherAllergens: string[];
  ingredientStatement?: string | null;
  verify: boolean;
}): Promise<string> {
  const { data, error } = await supabase.rpc('save_sample_allergen_declaration', {
    ...targetArgs(input),
    p_contains_allergens: input.containsAllergens,
    p_may_contain_allergens: input.mayContainAllergens,
    p_other_allergens: input.otherAllergens,
    ...(input.ingredientStatement ? { p_ingredient_statement: input.ingredientStatement } : {}),
    p_verify: input.verify,
  });
  if (error) throw dbError(error);
  return data;
}

export async function saveSampleAllergenDeclarationsForProducts(input: {
  productIds: string[];
  containsAllergens: AllergenCode[];
  mayContainAllergens: AllergenCode[];
  otherAllergens: string[];
  ingredientStatement?: string | null;
  verify: boolean;
}): Promise<string[]> {
  const productIds = [...new Set(input.productIds)].filter(Boolean);
  if (productIds.length === 0) return [];

  return Promise.all(productIds.map(productId => saveSampleAllergenDeclaration({
    productId,
    containsAllergens: input.containsAllergens,
    mayContainAllergens: input.mayContainAllergens,
    otherAllergens: input.otherAllergens,
    ingredientStatement: input.ingredientStatement,
    verify: input.verify,
  })));
}

export async function fetchEligiblePanelists(target: SampleEligibilityTarget): Promise<EligiblePanelist[]> {
  const { data, error } = await supabase.rpc('list_eligible_panelists', targetArgs(target));
  if (error) throw dbError(error);
  return mapEligiblePanelists(data ?? []);
}

export async function fetchEligiblePanelistsForProducts(productIds: string[]): Promise<EligiblePanelist[]> {
  if (!productIds.length) return [];
  const { data, error } = await supabase.rpc('list_eligible_panelists_for_products', { p_product_ids: productIds });
  if (error) throw dbError(error);
  return mapEligiblePanelists(data ?? []);
}

function mapEligiblePanelists(data: Array<{
  id: string; name: string | null; email: string | null; panelist_id: string | null;
  completed_count: number | null; age_years: number; age_band: string; gender: string | null;
  gender_self_description: string | null; nationality_code: string | null; ethnicity: string | null;
  region: string | null; household_size: number | null; household_size_prefer_not_to_say: boolean;
  children_in_household: boolean | null; dietary_pattern: string | null; dietary_other: string | null;
  grocery_role: string | null; category_usage_frequency: string | null; smoker_status: string | null;
  weekly_food_spend: string | null; occupation_group: string | null; annual_income_range: string | null;
}>): EligiblePanelist[] {
  return data.map(row => ({
    id: row.id,
    name: row.name ?? 'Panelist',
    email: row.email,
    panelistId: row.panelist_id,
    completedCount: Number(row.completed_count ?? 0),
    ageYears: row.age_years,
    ageBand: row.age_band,
    gender: row.gender,
    genderSelfDescription: row.gender_self_description,
    nationalityCode: row.nationality_code,
    ethnicity: row.ethnicity,
    region: row.region,
    householdSize: row.household_size,
    householdSizePreferNotToSay: row.household_size_prefer_not_to_say,
    childrenInHousehold: row.children_in_household,
    dietaryPattern: row.dietary_pattern,
    dietaryOther: row.dietary_other,
    groceryRole: row.grocery_role,
    categoryUsageFrequency: row.category_usage_frequency,
    smokerStatus: row.smoker_status,
    weeklyFoodSpend: row.weekly_food_spend,
    occupationGroup: row.occupation_group,
    annualIncomeRange: row.annual_income_range,
  }));
}
