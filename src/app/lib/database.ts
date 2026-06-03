import { supabase } from './supabase';
import type { Product, QuestionnaireResponse, HedonicReferenceScores } from '../data/mock-users';
import type { TrainingLevel } from '../utils/panelist-metrics';

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function toProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    createdDate: row.created_at as string,
    status: row.status as 'active' | 'completed',
    customAttributes: (row.custom_attributes as string[]) ?? undefined,
    isMultiSample: (row.is_multi_sample as boolean) ?? false,
    samples: (row.samples as Product['samples']) ?? undefined,
    isCalibration: (row.is_calibration as boolean) ?? false,
    referenceScores: (row.reference_scores as HedonicReferenceScores) ?? null,
  };
}

function fromProduct(p: Omit<Product, 'id' | 'createdDate'>) {
  return {
    name: p.name,
    category: p.category,
    status: p.status,
    custom_attributes: p.customAttributes ?? null,
    is_multi_sample: p.isMultiSample ?? false,
    samples: p.samples ?? null,
    is_calibration: p.isCalibration ?? false,
    reference_scores: p.referenceScores ?? null,
  };
}

function toResponse(row: Record<string, unknown>): QuestionnaireResponse {
  const rawComments = (row.comments as string) ?? '';

  // Prefer dedicated columns (migration 004); fall back to JSON-in-comments for
  // rows written before that migration ran.
  let sessionType = (row.session_type as string | undefined) ?? undefined;
  let sampleCode = (row.sample_code as string | undefined) ?? undefined;
  let differentSample = (row.different_sample as string | undefined) ?? undefined;
  let ranking = Array.isArray(row.ranking) ? (row.ranking as string[]) : undefined;
  let comments = rawComments;

  if (!sessionType && rawComments) {
    try {
      const meta = JSON.parse(rawComments);
      if (meta && typeof meta === 'object' && meta.sessionType) {
        sessionType = meta.sessionType as string;
        sampleCode = meta.sampleCode as string | undefined;
        differentSample = meta.differentSample as string | undefined;
        ranking = Array.isArray(meta.ranking) ? (meta.ranking as string[]) : undefined;
        comments = meta.comments ?? '';
      }
    } catch { /* plain-text comment, not JSON */ }
  }

  return {
    id: row.id as string,
    userId: row.user_id as string,
    productId: row.product_id as string,
    timestamp: row.created_at as string,
    runNumber: (row.run_number as number) ?? 1,
    cataAttributes: (row.cata_attributes as string[]) || [],
    intensityRatings: (row.intensity_ratings as Record<string, number>) || {},
    hedonicScores: (row.hedonic_scores as QuestionnaireResponse['hedonicScores']) || {
      overall: 5, appearance: 5, aroma: 5, flavor: 5, texture: 5,
    },
    emotionalProfile: (row.emotional_profile as Record<string, number>) || {},
    comments,
    sessionType,
    sampleCode,
    differentSample,
    ranking,
  };
}

// ─── Products ─────────────────────────────────────────────────────────────────

function dbError(error: { message?: string; code?: string }): Error {
  return new Error(error.message || `Database error (code: ${error.code ?? 'unknown'})`);
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw dbError(error);
  return (data ?? []).map(toProduct);
}

export async function fetchActiveProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw dbError(error);
  return (data ?? []).map(toProduct);
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw dbError(error);
  return data ? toProduct(data) : null;
}

export async function insertProduct(p: Omit<Product, 'id' | 'createdDate'>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(fromProduct(p))
    .select()
    .single();
  if (error) throw dbError(error);
  return toProduct(data);
}

export async function updateProduct(
  id: string,
  updates: Partial<Omit<Product, 'id' | 'createdDate'>>,
): Promise<Product> {
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.category !== undefined) patch.category = updates.category;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.customAttributes !== undefined) patch.custom_attributes = updates.customAttributes;
  if (updates.isMultiSample !== undefined) patch.is_multi_sample = updates.isMultiSample;
  if (updates.samples !== undefined) patch.samples = updates.samples;
  if (updates.isCalibration !== undefined) patch.is_calibration = updates.isCalibration;
  if (updates.referenceScores !== undefined) patch.reference_scores = updates.referenceScores;

  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw dbError(error);
  return toProduct(data);
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw dbError(error);
}

// ─── Responses ────────────────────────────────────────────────────────────────

export async function fetchAllResponses(options?: {
  limit?: number;
  offset?: number;
}): Promise<QuestionnaireResponse[]> {
  const limit = options?.limit ?? 500;
  const offset = options?.offset ?? 0;
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw dbError(error);
  return (data ?? []).map(toResponse);
}

export async function fetchUserResponses(userId: string): Promise<QuestionnaireResponse[]> {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .eq('user_id', userId);
  if (error) throw dbError(error);
  return (data ?? []).map(toResponse);
}

export async function fetchLatestUserResponse(
  userId: string,
  productId: string,
): Promise<QuestionnaireResponse | null> {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .order('run_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw dbError(error);
  return data ? toResponse(data) : null;
}

export async function fetchUserResponseAtRun(
  userId: string,
  productId: string,
  runNumber: number,
): Promise<QuestionnaireResponse | null> {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .eq('run_number', runNumber)
    .maybeSingle();
  if (error) throw dbError(error);
  return data ? toResponse(data) : null;
}

export async function insertResponse(
  response: Omit<QuestionnaireResponse, 'id' | 'timestamp' | 'runNumber'>,
): Promise<QuestionnaireResponse> {
  // Retry loop handles the race condition where two concurrent submissions
  // read the same max run_number and both try to insert it.
  // The unique constraint on (user_id, product_id, run_number) will reject
  // the second insert (error code 23505) and we retry with a fresh read.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase
      .from('responses')
      .select('run_number')
      .eq('user_id', response.userId)
      .eq('product_id', response.productId)
      .order('run_number', { ascending: false })
      .limit(1);

    const runNumber =
      existing && existing.length > 0 ? (existing[0].run_number as number) + 1 : 1;

    const { data, error } = await supabase
      .from('responses')
      .insert({
        user_id: response.userId,
        product_id: response.productId,
        run_number: runNumber,
        cata_attributes: response.cataAttributes,
        intensity_ratings: response.intensityRatings,
        hedonic_scores: response.hedonicScores,
        emotional_profile: response.emotionalProfile,
        comments: response.comments ?? null,
        session_type: response.sessionType ?? null,
        sample_code: response.sampleCode ?? null,
        different_sample: response.differentSample ?? null,
        ranking: response.ranking ?? null,
      })
      .select()
      .single();

    if (!error) return toResponse(data);
    if (error.code !== '23505') throw dbError(error);
    // Unique constraint violation — another insert raced us, retry with next run_number
  }
  throw new Error('Failed to insert response: too many concurrent submissions for the same user/product');
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  attributes: string[];
  createdDate: string;
}

function toTemplate(row: Record<string, unknown>): Template {
  return {
    id: row.id as string,
    name: row.name as string,
    attributes: (row.attributes as string[]) || [],
    createdDate: row.created_at as string,
  };
}

export async function fetchTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw dbError(error);
  return (data ?? []).map(toTemplate);
}

export async function insertTemplate(name: string, attributes: string[]): Promise<Template> {
  const { data, error } = await supabase
    .from('templates')
    .insert({ name, attributes })
    .select()
    .single();
  if (error) throw dbError(error);
  return toTemplate(data);
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) throw dbError(error);
}

// ─── Panelists (admin view) ───────────────────────────────────────────────────

export interface PanelistInfo {
  id: string;
  name: string;
  panelistId: string | null;
  completedCount: number;
  trainingLevel: TrainingLevel;
}

export async function fetchPanelists(): Promise<PanelistInfo[]> {
  const [profilesResult, { data: responses }] = await Promise.all([
    supabase.from('profiles').select('id, name, panelist_id, training_level').eq('role', 'panelist'),
    supabase.from('responses').select('user_id'),
  ]);

  // Graceful fallback if training_level column hasn't been migrated yet
  let profiles = profilesResult.data as Record<string, unknown>[] | null;
  if (profilesResult.error) {
    const { data } = await supabase.from('profiles').select('id, name, panelist_id').eq('role', 'panelist');
    profiles = data as Record<string, unknown>[] | null;
  }

  const counts: Record<string, number> = {};
  (responses ?? []).forEach((r: Record<string, unknown>) => {
    const uid = r.user_id as string;
    counts[uid] = (counts[uid] || 0) + 1;
  });

  return (profiles ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    name: (p.name as string) ?? 'Unknown',
    panelistId: (p.panelist_id as string) ?? null,
    completedCount: counts[p.id as string] ?? 0,
    trainingLevel: ((p.training_level as TrainingLevel) ?? 'screened'),
  }));
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

// ─── Panelist Reliability ─────────────────────────────────────────────────────

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

// ─── Concept Tests ────────────────────────────────────────────────────────────

export interface ConceptQuestion {
  id: string;
  text: string;
  type: 'scale' | 'multiple_choice' | 'open_text' | 'ranking';
  options?: string[];
  required: boolean;
  category: string;
}

export interface ConceptTest {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrls: string[];
  targetMarket: string;
  pricePoint: string;
  keyBenefits: string;
  questions: ConceptQuestion[];
  panelSize: number;
  assignedPanelistIds: string[];
  status: 'active' | 'completed';
  createdAt: string;
}

export interface ConceptResponse {
  id: string;
  userId: string;
  conceptTestId: string;
  answers: Record<string, string | number | string[]>;
  createdAt: string;
}

function toConceptTest(row: Record<string, unknown>): ConceptTest {
  return {
    id: row.id as string,
    name: row.name as string,
    category: (row.category as string) ?? '',
    description: (row.description as string) ?? '',
    imageUrls: (row.image_urls as string[]) ?? [],
    targetMarket: (row.target_market as string) ?? '',
    pricePoint: (row.price_point as string) ?? '',
    keyBenefits: (row.key_benefits as string) ?? '',
    questions: (row.questions as ConceptQuestion[]) ?? [],
    panelSize: (row.panel_size as number) ?? 50,
    assignedPanelistIds: (row.assigned_panelist_ids as string[]) ?? [],
    status: (row.status as 'active' | 'completed') ?? 'active',
    createdAt: row.created_at as string,
  };
}

export async function insertConceptTest(
  test: Omit<ConceptTest, 'id' | 'createdAt'>,
): Promise<ConceptTest> {
  const { data, error } = await supabase
    .from('concept_tests')
    .insert({
      name: test.name,
      category: test.category,
      description: test.description,
      image_urls: test.imageUrls,
      target_market: test.targetMarket,
      price_point: test.pricePoint,
      key_benefits: test.keyBenefits,
      questions: test.questions,
      panel_size: test.panelSize,
      assigned_panelist_ids: test.assignedPanelistIds,
      status: test.status,
    })
    .select()
    .single();
  if (error) throw dbError(error);
  return toConceptTest(data);
}

export async function fetchConceptTest(id: string): Promise<ConceptTest | null> {
  const { data, error } = await supabase
    .from('concept_tests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw dbError(error);
  return data ? toConceptTest(data) : null;
}

export async function fetchConceptTestsForPanelist(userId: string): Promise<ConceptTest[]> {
  // Two targeted queries are cheaper than fetching all active tests and
  // filtering client-side: one for tests with no assignment (global), one for
  // tests explicitly assigned to this user.
  const [globalResult, assignedResult] = await Promise.all([
    supabase
      .from('concept_tests')
      .select('*')
      .eq('status', 'active')
      .filter('assigned_panelist_ids', 'eq', '{}')
      .order('created_at', { ascending: false }),
    supabase
      .from('concept_tests')
      .select('*')
      .eq('status', 'active')
      .contains('assigned_panelist_ids', [userId])
      .order('created_at', { ascending: false }),
  ]);
  if (globalResult.error) throw dbError(globalResult.error);
  if (assignedResult.error) throw dbError(assignedResult.error);

  const seen = new Set<string>();
  return [...(globalResult.data ?? []), ...(assignedResult.data ?? [])]
    .filter(row => {
      const id = row.id as string;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(toConceptTest);
}

export async function insertConceptResponse(
  userId: string,
  conceptTestId: string,
  answers: Record<string, string | number | string[]>,
): Promise<void> {
  const { error } = await supabase
    .from('concept_responses')
    .upsert({ user_id: userId, concept_test_id: conceptTestId, answers });
  if (error) throw dbError(error);
}

export async function fetchUserConceptResponses(userId: string): Promise<ConceptResponse[]> {
  const { data, error } = await supabase
    .from('concept_responses')
    .select('*')
    .eq('user_id', userId);
  if (error) throw dbError(error);
  return (data ?? []).map(r => ({
    id: r.id as string,
    userId: r.user_id as string,
    conceptTestId: r.concept_test_id as string,
    answers: (r.answers as Record<string, string | number | string[]>) ?? {},
    createdAt: r.created_at as string,
  }));
}
