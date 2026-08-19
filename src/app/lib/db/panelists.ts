import { supabase } from '../supabase';
import type { TrainingLevel } from '../../utils/panelist-metrics';
import type { AllergenCode } from '../allergen-eligibility';
import { dbError, edgeFunctionErrorMessage, insertAuditEvent } from './shared';

export interface PanelistInfo {
  id: string;
  name: string;
  email: string | null;
  panelistId: string | null;
  status: 'active' | 'inactive' | 'archived';
  consentAcceptedAt: string | null;
  consentVersion: string | null;
  completedCount: number;
  trainingLevel: TrainingLevel;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  profileCompletedAt: string | null;
  eligibilityCompletedAt: string | null;
  ageYears: number | null;
  ageBand: string | null;
  gender: string | null;
  genderSelfDescription: string | null;
  nationalityCode: string | null;
  ethnicity: string | null;
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
  declarationConfirmedAt: string | null;
  declarationExpiresAt: string | null;
  researchProfileUpdatedAt: string | null;
  lastActivityAt: string | null;
}

export function panelistShippingAddress(panelist: Pick<PanelistInfo, 'addressLine1' | 'addressLine2' | 'city' | 'region' | 'postalCode' | 'country'>): string {
  return [
    panelist.addressLine1,
    panelist.addressLine2,
    [panelist.city, panelist.region].filter(Boolean).join(', '),
    panelist.postalCode,
    panelist.country,
  ].filter(Boolean).join('\n');
}

export async function fetchPanelists(): Promise<PanelistInfo[]> {
  const { data, error } = await supabase.rpc('list_panelist_directory');
  if (error) throw dbError(error);

  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name ?? 'Unknown',
    email: row.email ?? null,
    panelistId: row.panelist_id ?? null,
    status: (row.status as PanelistInfo['status']) ?? 'active',
    consentAcceptedAt: row.consent_accepted_at ?? null,
    consentVersion: row.consent_version ?? null,
    completedCount: Number(row.completed_count ?? 0),
    trainingLevel: (row.training_level as TrainingLevel) ?? 'screened',
    phone: row.phone ?? null,
    addressLine1: row.address_line_1 ?? null,
    addressLine2: row.address_line_2 ?? null,
    city: row.city ?? null,
    region: row.region ?? null,
    postalCode: row.postal_code ?? null,
    country: row.country ?? null,
    profileCompletedAt: row.profile_completed_at ?? null,
    eligibilityCompletedAt: row.eligibility_completed_at ?? null,
    ageYears: row.age_years ?? null,
    ageBand: row.age_band ?? null,
    gender: row.gender ?? null,
    genderSelfDescription: row.gender_self_description ?? null,
    nationalityCode: row.nationality_code ?? null,
    ethnicity: row.ethnicity ?? null,
    householdSize: row.household_size ?? null,
    householdSizePreferNotToSay: row.household_size_prefer_not_to_say ?? false,
    childrenInHousehold: row.children_in_household ?? null,
    dietaryPattern: row.dietary_pattern ?? null,
    dietaryOther: row.dietary_other ?? null,
    groceryRole: row.grocery_role ?? null,
    categoryUsageFrequency: row.category_usage_frequency ?? null,
    smokerStatus: row.smoker_status ?? null,
    weeklyFoodSpend: row.weekly_food_spend ?? null,
    occupationGroup: row.occupation_group ?? null,
    annualIncomeRange: row.annual_income_range ?? null,
    declarationConfirmedAt: row.declaration_confirmed_at ?? null,
    declarationExpiresAt: row.declaration_expires_at ?? null,
    researchProfileUpdatedAt: row.research_profile_updated_at ?? null,
    lastActivityAt: row.last_activity_at ?? null,
  }));
}

export async function invitePanelistAccount(email: string, redirectTo: string): Promise<void> {
  const { error } = await supabase.functions.invoke('invite-panelist', {
    body: { email: email.trim().toLowerCase(), redirectTo },
  });
  if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Unable to send the panelist invitation.'));
}

export async function completePanelistProfile(input: {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string;
  consentVersion: string;
  consentUserAgent?: string | null;
  birthMonth: number;
  birthYear: number;
  allergenAvoidances: AllergenCode[];
  otherAvoidances: string[];
  healthConsentVersion: string;
  gender?: string | null;
  genderSelfDescription?: string | null;
  nationalityCode?: string | null;
  ethnicity?: string | null;
  householdSize?: number | null;
  householdSizePreferNotToSay?: boolean;
  dietaryPattern?: string | null;
  dietaryOther?: string | null;
  groceryRole?: string | null;
  smokerStatus?: string | null;
  weeklyFoodSpend?: string | null;
  occupationGroup?: string | null;
  annualIncomeRange?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('complete_panelist_eligibility_profile', {
    p_name: input.name,
    p_phone: input.phone,
    p_address_line_1: input.addressLine1,
    p_address_line_2: input.addressLine2 ?? '',
    p_city: input.city,
    p_region: input.region ?? '',
    p_postal_code: input.postalCode,
    p_country: input.country,
    p_consent_version: input.consentVersion,
    p_consent_user_agent: input.consentUserAgent ?? '',
    p_birth_month: input.birthMonth,
    p_birth_year: input.birthYear,
    p_allergen_avoidances: input.allergenAvoidances,
    p_other_avoidances: input.otherAvoidances,
    p_health_consent_version: input.healthConsentVersion,
    ...(input.gender ? { p_gender: input.gender } : {}),
    ...(input.genderSelfDescription ? { p_gender_self_description: input.genderSelfDescription } : {}),
    ...(input.nationalityCode ? { p_nationality_code: input.nationalityCode } : {}),
    ...(input.ethnicity ? { p_ethnicity: input.ethnicity } : {}),
    ...(input.householdSize != null ? { p_household_size: input.householdSize } : {}),
    p_household_size_prefer_not_to_say: input.householdSizePreferNotToSay ?? false,
    ...(input.dietaryPattern ? { p_dietary_pattern: input.dietaryPattern } : {}),
    ...(input.dietaryOther ? { p_dietary_other: input.dietaryOther } : {}),
    ...(input.groceryRole ? { p_grocery_role: input.groceryRole } : {}),
    ...(input.smokerStatus ? { p_smoker_status: input.smokerStatus } : {}),
    ...(input.weeklyFoodSpend ? { p_weekly_food_spend: input.weeklyFoodSpend } : {}),
    ...(input.occupationGroup ? { p_occupation_group: input.occupationGroup } : {}),
    ...(input.annualIncomeRange ? { p_annual_income_range: input.annualIncomeRange } : {}),
  });
  if (error) throw dbError(error);
}

export interface OwnPanelistProfileSetup {
  name: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  birthMonth: number | null;
  birthYear: number | null;
  allergenAvoidances: AllergenCode[];
  otherAvoidances: string[];
  gender: string | null;
  genderSelfDescription: string | null;
  nationalityCode: string | null;
  ethnicity: string | null;
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

export async function fetchOwnPanelistProfileSetup(): Promise<OwnPanelistProfileSetup | null> {
  const { data, error } = await supabase.rpc('get_own_panelist_profile_setup');
  if (error) throw dbError(error);
  const row = data?.[0];
  if (!row) return null;
  return {
    name: row.name ?? null,
    phone: row.phone ?? null,
    addressLine1: row.address_line_1 ?? null,
    addressLine2: row.address_line_2 ?? null,
    city: row.city ?? null,
    region: row.region ?? null,
    postalCode: row.postal_code ?? null,
    country: row.country ?? null,
    birthMonth: row.birth_month ?? null,
    birthYear: row.birth_year ?? null,
    allergenAvoidances: (row.allergen_avoidances ?? []) as AllergenCode[],
    otherAvoidances: row.other_avoidances ?? [],
    gender: row.gender ?? null,
    genderSelfDescription: row.gender_self_description ?? null,
    nationalityCode: row.nationality_code ?? null,
    ethnicity: row.ethnicity ?? null,
    householdSize: row.household_size ?? null,
    householdSizePreferNotToSay: row.household_size_prefer_not_to_say ?? false,
    childrenInHousehold: row.children_in_household ?? null,
    dietaryPattern: row.dietary_pattern ?? null,
    dietaryOther: row.dietary_other ?? null,
    groceryRole: row.grocery_role ?? null,
    categoryUsageFrequency: row.category_usage_frequency ?? null,
    smokerStatus: row.smoker_status ?? null,
    weeklyFoodSpend: row.weekly_food_spend ?? null,
    occupationGroup: row.occupation_group ?? null,
    annualIncomeRange: row.annual_income_range ?? null,
  };
}

export async function updatePanelistId(userId: string, panelistId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ panelist_id: panelistId })
    .eq('id', userId);
  if (error) throw dbError(error);
}

export async function updatePanelistTrainingLevel(userId: string, level: TrainingLevel): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ training_level: level })
    .eq('id', userId);
  if (error) throw dbError(error);
}

export async function updatePanelistStatus(
  userId: string,
  status: PanelistInfo['status'],
  actorId?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', userId);
  if (error) throw dbError(error);

  await insertAuditEvent({
    actorId: actorId ?? null,
    eventType: 'panelist_status_updated',
    entityType: 'profiles',
    entityId: userId,
    metadata: { status },
  });
}

export interface PanelistReliability {
  userId: string;
  name: string;
  panelistId: string | null;
  completedCount: number;
  meanDeviation: number | null;
}

export async function fetchPanelistReliability(): Promise<PanelistReliability[]> {
  const [{ data: profiles }, { data: responses }] = await Promise.all([
    supabase.from('profiles').select('id, name, panelist_id').eq('role', 'panelist'),
    supabase.from('responses').select('user_id, product_id, hedonic_scores'),
  ]);

  if (!profiles || !responses) return [];

  const productSums: Record<string, { sum: number; count: number }> = {};
  (responses as Record<string, unknown>[]).forEach(r => {
    const pid = r.product_id as string;
    const scores = r.hedonic_scores as Record<string, number> | null;
    const overall = scores?.overall ?? 0;
    if (!productSums[pid]) productSums[pid] = { sum: 0, count: 0 };
    productSums[pid].sum += overall;
    productSums[pid].count += 1;
  });

  const panelMeans: Record<string, number> = {};
  Object.entries(productSums).forEach(([pid, { sum, count }]) => {
    panelMeans[pid] = sum / count;
  });

  const panelistCounts: Record<string, number> = {};
  const panelistDeviations: Record<string, number[]> = {};
  (responses as Record<string, unknown>[]).forEach(r => {
    const uid = r.user_id as string;
    const pid = r.product_id as string;
    const scores = r.hedonic_scores as Record<string, number> | null;
    const overall = scores?.overall ?? 0;
    const mean = panelMeans[pid];
    if (mean === undefined) return;
    panelistCounts[uid] = (panelistCounts[uid] || 0) + 1;
    if (!panelistDeviations[uid]) panelistDeviations[uid] = [];
    panelistDeviations[uid].push(Math.abs(overall - mean));
  });

  return (profiles as Record<string, unknown>[]).map(p => {
    const uid = p.id as string;
    const devs = panelistDeviations[uid] || [];
    return {
      userId: uid,
      name: (p.name as string) ?? 'Unknown',
      panelistId: (p.panelist_id as string) ?? null,
      completedCount: panelistCounts[uid] || 0,
      meanDeviation: devs.length >= 3 ? devs.reduce((a, b) => a + b, 0) / devs.length : null,
    };
  });
}
