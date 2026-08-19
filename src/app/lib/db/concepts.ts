import { supabase } from '../supabase';
import { ragFetch } from '../rag-client';
import { asJson, dbError, fromJson } from './shared';
import { nextMonthStartIso } from '../concept-credits';
import type { Database } from './database.types';

type Tables = Database['public']['Tables'];

export interface ConceptQuestion {
  id: string;
  text: string;
  type: 'scale' | 'multiple_choice' | 'open_text' | 'ranking' | 'image_choice';
  options?: string[];
  /** Zero-based index of the concept visual shown with this question. */
  imageIndex?: number;
  required: boolean;
  category: string;
}

export type ConceptImageReviewStatus = 'draft' | 'selected' | 'approved' | 'rejected';

/** Admin-facing metadata for a generated concept image (never sent to panelists). */
export interface ConceptImageMeta {
  id: string;
  mode: string;
  promptStyle: string;
  model: string;
  quality: string;
  reviewStatus: ConceptImageReviewStatus;
  review?: ConceptImageReviewRecord;
  createdAt: string;
}

export interface ConceptTest {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrls: string[];
  imageIds?: string[];
  /** Populated only on admin fetch paths; aligned by index with imageUrls. */
  imageMeta?: ConceptImageMeta[];
  targetMarket: string;
  pricePoint: string;
  keyBenefits: string;
  questions: ConceptQuestion[];
  panelSize: number;
  assignedPanelistIds: string[];
  projectName?: string;
  foodTypeSlug?: string;
  approvalNotes?: string;
  status: 'draft' | 'review' | 'approved' | 'active' | 'completed' | 'archived';
  createdAt: string;
  launchedAt?: string | null;
  archivedAt?: string | null;
  /** Structured positioning dimensions for causal analysis across concepts. */
  variantDimensions?: Record<string, string | null>;
  /** The concept image locked as this concept's product design, if any. */
  brandReferenceImageId?: string | null;
  projectId?: string | null;
  formulationVersionId?: string | null;
  decisionRecordId?: string | null;
  evidenceBundleId?: string | null;
}

export interface ConceptResponse {
  id: string;
  userId: string;
  conceptTestId: string;
  answers: Record<string, string | number | string[]>;
  createdAt: string;
}

function toConceptResponse(row: Tables['concept_responses']['Row']): ConceptResponse {
  return {
    id: row.id,
    userId: row.user_id as string,
    conceptTestId: row.concept_test_id as string,
    answers: fromJson<Record<string, string | number | string[]>>(row.answers) ?? {},
    createdAt: row.created_at as string,
  };
}

export interface CommercializationReportRecord {
  id: string;
  decisionRecordId: string;
  conceptTestId: string;
  packagingImageId: string | null;
  evidenceBundleId?: string | null;
  status: 'draft' | 'review' | 'approved' | 'archived';
  version: number;
  title: string;
  reportSnapshot: Record<string, unknown>;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  formulationVersionId?: string | null;
  canonicalProjectId?: string | null;
}

export interface EvidenceBundleRecord {
  id: string;
  projectId: string;
  version: number;
  schemaVersion: string;
  sourceDataVersion: string;
  payload: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  canonicalProjectId?: string | null;
  instrumentalSampleId?: string | null;
  decisionRecordId?: string | null;
  formulationVersionId?: string | null;
  isCurrentProduct?: boolean;
}

export interface ConceptGenerationSettings {
  id: string;
  defaultImageCount: number;
  maxImagesPerConcept: number;
  defaultQuality: 'low' | 'medium' | 'high' | 'auto';
  defaultModel: string;
  estimatedCostPerImage: number;
  monthlyBudget: number;
  /** Canonical or legacy prompt style id; normalize via normalizePromptStyle before use. */
  promptStyle: string;
}

export interface ConceptImageGeneration {
  id: string;
  conceptTestId: string | null;
  projectName: string;
  foodTypeSlug: string;
  conceptName: string;
  mode: string;
  prompt: string;
  promptStyle: string;
  model: string;
  quality: string;
  requestedCount: number;
  status: 'queued' | 'generating' | 'completed' | 'failed';
  errorMessage: string | null;
  estimatedCost: number;
  createdAt: string;
  images: ConceptGeneratedImage[];
}

export interface ConceptGeneratedImage {
  id: string;
  generationId: string;
  conceptTestId: string | null;
  imageUrl: string;
  storagePath: string | null;
  selectedForPanelists: boolean;
  sortOrder: number;
  mode: string;
  promptStyle: string;
  reviewStatus: ConceptImageReviewStatus;
  model: string;
  quality: string;
  performanceSummary: Record<string, unknown>;
  review?: ConceptImageReviewRecord;
  createdAt: string;
}

export interface ConceptImageReviewRecord {
  status?: ConceptImageReviewStatus;
  notes?: string;
  qaSummary?: Record<string, unknown>;
  reviewedBy?: string | null;
  reviewedAt?: string;
}

export interface ConceptProjectSummary {
  key: string;
  label: string;
  conceptCount: number;
  imageCount: number;
  estimatedSpend: number;
}

export interface ConceptLabDiagnostics {
  settingsTableReady: boolean;
  imageHistoryReady: boolean;
  storageBucketReady: boolean;
  messages: string[];
}

function toConceptTest(row: Tables['concept_tests']['Row']): ConceptTest {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? '',
    description: row.description ?? '',
    imageUrls: row.image_urls ?? [],
    imageIds: row.generated_image_ids ?? [],
    targetMarket: row.target_market ?? '',
    pricePoint: row.price_point ?? '',
    keyBenefits: row.key_benefits ?? '',
    questions: fromJson<ConceptQuestion[]>(row.questions) ?? [],
    panelSize: row.panel_size ?? 50,
    assignedPanelistIds: row.assigned_panelist_ids ?? [],
    projectName: row.concept_folder_name ?? 'Project 1',
    foodTypeSlug: row.food_type_slug ?? '',
    approvalNotes: row.approval_notes ?? '',
    status: (row.status as ConceptTest['status']) ?? 'active',
    createdAt: row.created_at as string,
    launchedAt: row.launched_at ?? null,
    archivedAt: row.archived_at ?? null,
    variantDimensions: fromJson<Record<string, string | null>>(row.variant_dimensions) ?? {},
    // Cast: column may predate regenerated database.types.ts.
    brandReferenceImageId: ((row as Record<string, unknown>).brand_reference_image_id as string | null) ?? null,
    projectId: row.project_id ?? null,
    formulationVersionId: row.formulation_version_id ?? null,
    decisionRecordId: row.decision_record_id ?? null,
    evidenceBundleId: row.evidence_bundle_id ?? null,
  };
}

export async function createConceptImageSignedUrl(storagePath: string | null, fallback: string): Promise<string> {
  if (!storagePath) return fallback;
  const { data, error } = await supabase.storage
    .from('concept-images')
    .createSignedUrl(storagePath, 60 * 60);
  if (error) return fallback.startsWith('https://') ? fallback : '';
  return data.signedUrl;
}

async function hydrateConceptTestImages(test: ConceptTest, includeMeta = false): Promise<ConceptTest> {
  if (!test.imageIds?.length) return test;
  const { data, error } = await supabase
    .from('concept_images')
    .select('*')
    .in('id', test.imageIds)
    .order('sort_order', { ascending: true });
  if (error) throw dbError(error);
  const rows = data ?? [];
  const signed = await Promise.all(rows.map(async row => ({
    row,
    url: await createConceptImageSignedUrl(
      row.storage_path,
      row.image_url ?? '',
    ),
  })));
  const visible = signed.filter(entry => entry.url);
  const imageUrls = visible.map(entry => entry.url);
  if (!includeMeta) return { ...test, imageUrls };
  // Metadata stays on admin fetch paths only; panelists get bare image URLs.
  const imageMeta: ConceptImageMeta[] = visible.map(({ row }) => ({
    id: row.id,
    mode: row.mode ?? 'packaging',
    promptStyle: row.prompt_style ?? '',
    model: row.model ?? '',
    quality: row.quality ?? '',
    reviewStatus: toReviewStatus(row),
    review: (() => {
      const performanceSummary = fromJson<Record<string, unknown>>(row.performance_summary) ?? {};
      return typeof performanceSummary.review === 'object' && performanceSummary.review !== null
        ? performanceSummary.review as ConceptImageReviewRecord
        : undefined;
    })(),
    createdAt: row.created_at ?? '',
  }));
  return { ...test, imageUrls, imageMeta };
}

export async function insertConceptTest(
  test: Omit<ConceptTest, 'id' | 'createdAt'>,
): Promise<ConceptTest> {
  const basePayload = {
    name: test.name,
    category: test.category,
    description: test.description,
    image_urls: test.imageIds?.length ? [] : test.imageUrls,
    generated_image_ids: test.imageIds ?? [],
    target_market: test.targetMarket,
    price_point: test.pricePoint,
    key_benefits: test.keyBenefits,
    questions: asJson(test.questions),
    panel_size: test.panelSize,
    assigned_panelist_ids: test.assignedPanelistIds,
    concept_folder_name: test.projectName ?? 'Project 1',
    food_type_slug: test.foodTypeSlug ?? '',
    approval_notes: test.approvalNotes ?? '',
    status: test.status,
    launched_at: test.status === 'active' ? new Date().toISOString() : null,
    variant_dimensions: test.variantDimensions ?? {},
    project_id: test.projectId ?? null,
    formulation_version_id: test.formulationVersionId ?? null,
    decision_record_id: test.decisionRecordId ?? null,
    evidence_bundle_id: test.evidenceBundleId ?? null,
  };
  // brand_reference_image_id lands with the concept_brand_kit migration;
  // retry without it on databases that have not applied it yet.
  let { data, error } = test.brandReferenceImageId
    ? await supabase
        .from('concept_tests')
        .insert({ ...basePayload, brand_reference_image_id: test.brandReferenceImageId } as never)
        .select()
        .single()
    : await supabase.from('concept_tests').insert(basePayload).select().single();
  if (error && test.brandReferenceImageId && error.message?.includes('brand_reference_image_id')) {
    ({ data, error } = await supabase.from('concept_tests').insert(basePayload).select().single());
  }
  if (error) throw dbError(error);
  if (!data) throw new Error('Concept insert returned no row.');
  const concept = toConceptTest(data);
  if (test.imageIds?.length) {
    await linkConceptImagesToConcept(concept.id, test.imageIds);
  }
  return hydrateConceptTestImages(concept);
}

export async function updateConceptTestStatus(
  id: string,
  status: ConceptTest['status'],
): Promise<ConceptTest> {
  const now = new Date().toISOString();
  const patch = {
    status,
    launched_at: status === 'active' ? now : undefined,
    archived_at: status === 'archived' ? now : null,
  };
  const { data, error } = await supabase
    .from('concept_tests')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw dbError(error);
  return hydrateConceptTestImages(toConceptTest(data), true);
}

export async function fetchConceptTest(id: string): Promise<ConceptTest | null> {
  const { data, error } = await supabase
    .from('concept_tests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw dbError(error);
  return data ? hydrateConceptTestImages(toConceptTest(data)) : null;
}

export async function fetchConceptTestsForPanelist(userId: string): Promise<ConceptTest[]> {
  // Sample-bearing concept tests are always explicitly assigned. The database
  // additionally rechecks the current safety declaration before returning rows.
  const assignedResult = await supabase
    .from('concept_tests')
    .select('*')
    .eq('status', 'active')
    .contains('assigned_panelist_ids', [userId])
    .order('created_at', { ascending: false });
  if (assignedResult.error) throw dbError(assignedResult.error);

  const tests = (assignedResult.data ?? []).map(toConceptTest);
  return Promise.all(tests.map(test => hydrateConceptTestImages(test)));
}

export async function fetchConceptTestsForAdmin(): Promise<ConceptTest[]> {
  const { data, error } = await supabase
    .from('concept_tests')
    .select('*')
    .in('status', ['active', 'completed', 'approved'])
    .order('created_at', { ascending: false });
  if (error) throw dbError(error);
  return Promise.all((data ?? []).map(row => hydrateConceptTestImages(toConceptTest(row), true)));
}

export async function fetchConceptTestsForStudyDashboard(): Promise<ConceptTest[]> {
  const { data, error } = await supabase
    .from('concept_tests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw dbError(error);
  return Promise.all((data ?? []).map(row => hydrateConceptTestImages(toConceptTest(row), true)));
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
  return (data ?? []).map(toConceptResponse);
}

export async function fetchConceptResponsesForTest(conceptTestId: string): Promise<ConceptResponse[]> {
  const { data, error } = await supabase
    .from('concept_responses')
    .select('*')
    .eq('concept_test_id', conceptTestId)
    .order('created_at', { ascending: true });
  if (error) throw dbError(error);
  return (data ?? []).map(toConceptResponse);
}

export async function fetchConceptResponsesForTests(conceptTestIds: readonly string[]): Promise<ConceptResponse[]> {
  if (conceptTestIds.length === 0) return [];

  const pageSize = 1000;
  const responses: ConceptResponse[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('concept_responses')
      .select('*')
      .in('concept_test_id', [...new Set(conceptTestIds)])
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw dbError(error);

    responses.push(...(data ?? []).map(toConceptResponse));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return responses;
}

export async function fetchConceptResponseCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('get_concept_response_counts');
  if (error) throw dbError(error);
  return Object.fromEntries(
    (data ?? []).map(row => [row.concept_test_id, Number(row.response_count)]),
  );
}

function toCommercializationReport(row: Tables['commercialization_reports']['Row']): CommercializationReportRecord {
  return {
    id: row.id,
    decisionRecordId: row.decision_record_id,
    conceptTestId: row.concept_test_id,
    packagingImageId: row.packaging_image_id ?? null,
    evidenceBundleId: row.evidence_bundle_id ?? null,
    status: row.status as CommercializationReportRecord['status'],
    version: Number(row.version),
    title: row.title,
    reportSnapshot: fromJson<Record<string, unknown>>(row.report_snapshot) ?? {},
    createdBy: row.created_by,
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    formulationVersionId: row.formulation_version_id ?? null,
    canonicalProjectId: row.project_id ?? null,
  };
}

function toEvidenceBundle(row: Tables['evidence_bundles']['Row']): EvidenceBundleRecord {
  return {
    id: row.id,
    projectId: row.sample_id,
    version: Number(row.version),
    schemaVersion: row.schema_version,
    sourceDataVersion: row.source_data_version,
    payload: fromJson<Record<string, unknown>>(row.payload) ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at as string,
    canonicalProjectId: row.project_id ?? null,
    instrumentalSampleId: row.instrumental_sample_id ?? null,
    decisionRecordId: row.decision_record_id ?? null,
    formulationVersionId: row.formulation_version_id ?? null,
    isCurrentProduct: row.is_current_product,
  };
}

export async function fetchCommercializationReports(): Promise<CommercializationReportRecord[]> {
  const { data, error } = await supabase
    .from('commercialization_reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error && /commercialization_reports|schema cache|does not exist/i.test(error.message ?? '')) return [];
  if (error) throw dbError(error);
  return (data ?? []).map(toCommercializationReport);
}

export async function createCommercializationReport(input: {
  decisionRecordId: string;
  conceptTestId: string;
  packagingImageId: string | null;
  title: string;
  reportSnapshot: Record<string, unknown>;
  evidenceBundleId?: string | null;
  formulationVersionId?: string | null;
}): Promise<CommercializationReportRecord> {
  const { data, error } = await supabase.rpc('create_commercialization_report', {
    target_decision_record_id: input.decisionRecordId,
    target_concept_test_id: input.conceptTestId,
    // The SQL function accepts NULL here (it handles a missing packaging image);
    // the generated arg type is non-null because the param has no default.
    target_packaging_image_id: input.packagingImageId as string,
    target_title: input.title,
    target_report_snapshot: asJson(input.reportSnapshot),
    target_evidence_bundle_id: input.evidenceBundleId ?? undefined,
    target_formulation_version_id: input.formulationVersionId ?? undefined,
  });
  if (error) throw dbError(error);
  return toCommercializationReport(data as Tables['commercialization_reports']['Row']);
}

export async function fetchEvidenceBundles(projectId?: string): Promise<EvidenceBundleRecord[]> {
  let query = supabase
    .from('evidence_bundles')
    .select('*')
    .order('version', { ascending: false });
  if (projectId) query = query.eq('sample_id', projectId);
  const { data, error } = await query;
  if (error && /evidence_bundles|schema cache|does not exist/i.test(error.message ?? '')) return [];
  if (error) throw dbError(error);
  return (data ?? []).map(toEvidenceBundle);
}

export async function saveEvidenceBundle(input: {
  projectId: string;
  canonicalProjectId?: string | null;
  decisionRecordId?: string | null;
  formulationVersionId?: string | null;
  schemaVersion: string;
  sourceDataVersion: string;
  payload: Record<string, unknown>;
}): Promise<EvidenceBundleRecord> {
  const { data, error } = await supabase.rpc('create_evidence_bundle', {
    target_sample_id: input.projectId,
    target_schema_version: input.schemaVersion,
    target_source_data_version: input.sourceDataVersion,
    target_payload: asJson(input.payload),
    target_project_id: input.canonicalProjectId ?? undefined,
    target_decision_record_id: input.decisionRecordId ?? undefined,
    target_formulation_version_id: input.formulationVersionId ?? undefined,
  });
  if (error) throw dbError(error);
  return toEvidenceBundle(data as Tables['evidence_bundles']['Row']);
}

export interface ReportNarrativeRequest {
  plan: {
    headline: string;
    candidateDecision: string;
    confidence: string;
    sections: {
      key: string;
      title: string;
      guidance: string;
      evidenceIds: string[];
      evidenceBacked: boolean;
      claimStatements?: string[];
    }[];
  };
  evidence: { id: string; title: string; description: string }[];
  revisionIssues?: string[];
}

// Calls the local Food RAG service. Report prose is local-first: Ollama when
// available, deterministic local fallback when the local writer is offline.
export async function generateReportNarrative(
  input: ReportNarrativeRequest,
): Promise<{ sections: Record<string, string>; model: string }> {
  const response = await ragFetch('/api/report-narrative', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Local narrative generation failed (${response.status}).`);
  const data = await response.json();
  const payload = data as { sections?: Record<string, string>; model?: string };
  return { sections: payload.sections ?? {}, model: payload.model ?? '' };
}

export async function updateCommercializationReportStatus(input: {
  id: string;
  status: CommercializationReportRecord['status'];
  actorId: string;
}): Promise<void> {
  const approval = input.status === 'approved'
    ? { approved_by: input.actorId, approved_at: new Date().toISOString() }
    : { approved_by: null, approved_at: null };
  const { error } = await supabase
    .from('commercialization_reports')
    .update({ status: input.status, ...approval, updated_at: new Date().toISOString() })
    .eq('id', input.id);
  if (error) throw dbError(error);
}

function toConceptSettings(row: Tables['concept_generation_settings']['Row']): ConceptGenerationSettings {
  return {
    id: row.id,
    defaultImageCount: row.default_image_count ?? 4,
    maxImagesPerConcept: row.max_images_per_concept ?? 4,
    defaultQuality: (row.default_quality as ConceptGenerationSettings['defaultQuality']) ?? 'medium',
    defaultModel: row.default_model ?? 'gpt-image-1.5',
    estimatedCostPerImage: Number(row.estimated_cost_per_image ?? 0.034),
    monthlyBudget: Number(row.monthly_budget ?? 50),
    promptStyle: (row.prompt_style as ConceptGenerationSettings['promptStyle']) ?? 'balanced',
  };
}

function defaultConceptSettings(): ConceptGenerationSettings {
  return {
    id: 'local-default',
    defaultImageCount: 4,
    maxImagesPerConcept: 4,
    defaultQuality: 'medium',
    defaultModel: 'gpt-image-1.5',
    estimatedCostPerImage: 0.034,
    monthlyBudget: 50,
    promptStyle: 'balanced',
  };
}

// Before the concept_image_metadata migration the review_status column does
// not exist, so derive a sensible status from the legacy columns.
function toReviewStatus(row: Tables['concept_images']['Row']): ConceptImageReviewStatus {
  const status = row.review_status as ConceptImageReviewStatus | undefined;
  if (status === 'draft' || status === 'selected' || status === 'approved' || status === 'rejected') return status;
  if (row.archived_at) return 'rejected';
  return row.selected_for_panelists ? 'selected' : 'draft';
}

function toConceptGeneratedImage(row: Tables['concept_images']['Row']): ConceptGeneratedImage {
  const performanceSummary = fromJson<Record<string, unknown>>(row.performance_summary) ?? {};
  const review = typeof performanceSummary.review === 'object' && performanceSummary.review !== null
    ? performanceSummary.review as ConceptImageReviewRecord
    : undefined;
  return {
    id: row.id,
    generationId: row.generation_id as string,
    conceptTestId: row.concept_test_id ?? null,
    imageUrl: row.image_url,
    storagePath: row.storage_path ?? null,
    selectedForPanelists: row.selected_for_panelists ?? false,
    sortOrder: row.sort_order ?? 0,
    mode: row.mode ?? 'packaging',
    promptStyle: row.prompt_style ?? '',
    reviewStatus: toReviewStatus(row),
    model: row.model ?? 'gpt-image-1.5',
    quality: row.quality ?? 'medium',
    performanceSummary,
    review,
    createdAt: row.created_at as string,
  };
}

function toConceptImageGeneration(
  row: Tables['concept_image_generations']['Row'] & { concept_images?: Tables['concept_images']['Row'][] },
): ConceptImageGeneration {
  return {
    id: row.id,
    conceptTestId: row.concept_test_id ?? null,
    projectName: row.concept_folder_name ?? 'Project 1',
    foodTypeSlug: row.food_type_slug ?? '',
    conceptName: row.concept_name ?? '',
    mode: row.mode,
    prompt: row.prompt,
    promptStyle: row.prompt_style,
    model: row.model,
    quality: row.quality,
    requestedCount: row.requested_count ?? 4,
    status: (row.status as ConceptImageGeneration['status']) ?? 'completed',
    errorMessage: row.error_message ?? null,
    estimatedCost: Number(row.estimated_cost ?? 0),
    createdAt: row.created_at as string,
    images: Array.isArray(row.concept_images)
      ? row.concept_images.map(toConceptGeneratedImage)
      : [],
  };
}

export async function fetchConceptGenerationSettings(): Promise<ConceptGenerationSettings> {
  const { data, error } = await supabase
    .from('concept_generation_settings')
    .select('*')
    .eq('active', true)
    .maybeSingle();
  if (error) {
    if (error.message?.includes('concept_generation_settings')) return defaultConceptSettings();
    throw dbError(error);
  }
  return data ? toConceptSettings(data) : defaultConceptSettings();
}

export interface ConceptImageUsage {
  /** This month's estimated spend across all concept-image generations. */
  spend: number;
  /** The effective monthly budget (min of the two configured caps, when both are set). */
  budget: number;
  /** spend / budget, 0 when there is no budget configured. Can exceed 1. */
  fraction: number;
  /** ISO instant the usage window resets (start of next month, UTC). */
  periodResetsAt: string;
}

/**
 * Client-side mirror of the edge function's own monthly-budget accounting
 * (generate-concept-images/index.ts), so the UI can show a live "credits used
 * this month" bar without exposing raw dollar figures. RLS scopes both
 * queries to the caller's org; only admins can read either table.
 */
export async function fetchConceptImageUsage(): Promise<ConceptImageUsage> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [settingsResult, workspaceResult, spendResult] = await Promise.all([
    supabase.from('concept_generation_settings').select('monthly_budget').eq('active', true).maybeSingle(),
    supabase.from('workspace_settings').select('concept_monthly_budget_cents').maybeSingle(),
    supabase
      .from('concept_image_generations')
      .select('estimated_cost')
      .gte('created_at', monthStart.toISOString())
      .in('status', ['generating', 'completed']),
  ]);

  const missingTable = (error: { message?: string } | null) =>
    Boolean(error?.message && /concept_generation_settings|concept_image_generations|workspace_settings|schema cache|does not exist/i.test(error.message));

  if (spendResult.error && !missingTable(spendResult.error)) throw dbError(spendResult.error);

  const settingsBudget = Math.max(0, Number(settingsResult.data?.monthly_budget) || 0);
  const workspaceBudget = Math.max(0, Number((workspaceResult.data as Record<string, unknown> | null)?.concept_monthly_budget_cents) || 0) / 100;
  const budget = settingsBudget > 0 && workspaceBudget > 0
    ? Math.min(settingsBudget, workspaceBudget)
    : Math.max(settingsBudget, workspaceBudget);
  const spend = (spendResult.data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost ?? 0), 0);

  return {
    spend,
    budget,
    fraction: budget > 0 ? spend / budget : 0,
    periodResetsAt: nextMonthStartIso(),
  };
}

export async function fetchConceptLabDiagnostics(): Promise<ConceptLabDiagnostics> {
  const messages: string[] = [];

  const settingsResult = await supabase
    .from('concept_generation_settings')
    .select('id')
    .eq('active', true)
    .limit(1);
  const settingsTableReady = !settingsResult.error;
  if (!settingsTableReady) {
    messages.push('Concept Lab SQL settings are not installed yet.');
  }

  const imagesResult = await supabase
    .from('concept_images')
    .select('id')
    .limit(1);
  const imageHistoryReady = !imagesResult.error;
  if (!imageHistoryReady) {
    messages.push('Generated image history tables are not installed yet.');
  }

  const storageResult = await supabase.storage
    .from('concept-images')
    .list('', { limit: 1 });
  const storageBucketReady = !storageResult.error;
  if (!storageBucketReady) {
    messages.push('Concept image storage bucket is not available yet.');
  }

  return {
    settingsTableReady,
    imageHistoryReady,
    storageBucketReady,
    messages,
  };
}

export async function updateConceptGenerationSettings(
  updates: Partial<Omit<ConceptGenerationSettings, 'id'>>,
): Promise<ConceptGenerationSettings> {
  const current = await fetchConceptGenerationSettings();
  if (current.id === 'local-default') {
    const { data, error } = await supabase
      .from('concept_generation_settings')
      .insert({
        active: true,
        default_image_count: updates.defaultImageCount ?? current.defaultImageCount,
        max_images_per_concept: updates.maxImagesPerConcept ?? current.maxImagesPerConcept,
        default_quality: updates.defaultQuality ?? current.defaultQuality,
        default_model: updates.defaultModel ?? current.defaultModel,
        estimated_cost_per_image: updates.estimatedCostPerImage ?? current.estimatedCostPerImage,
        monthly_budget: updates.monthlyBudget ?? current.monthlyBudget,
        prompt_style: updates.promptStyle ?? current.promptStyle,
      })
      .select()
      .single();
    if (error) throw dbError(error);
    return toConceptSettings(data);
  }

  const patch: Tables['concept_generation_settings']['Update'] = {
    updated_at: new Date().toISOString(),
  };
  if (updates.defaultImageCount !== undefined) patch.default_image_count = updates.defaultImageCount;
  if (updates.maxImagesPerConcept !== undefined) patch.max_images_per_concept = updates.maxImagesPerConcept;
  if (updates.defaultQuality !== undefined) patch.default_quality = updates.defaultQuality;
  if (updates.defaultModel !== undefined) patch.default_model = updates.defaultModel;
  if (updates.estimatedCostPerImage !== undefined) patch.estimated_cost_per_image = updates.estimatedCostPerImage;
  if (updates.monthlyBudget !== undefined) patch.monthly_budget = updates.monthlyBudget;
  if (updates.promptStyle !== undefined) patch.prompt_style = updates.promptStyle;

  const { data, error } = await supabase
    .from('concept_generation_settings')
    .update(patch)
    .eq('id', current.id)
    .select()
    .single();
  if (error) throw dbError(error);
  return toConceptSettings(data);
}

export async function fetchConceptImageGenerations(): Promise<ConceptImageGeneration[]> {
  const { data, error } = await supabase
    .from('concept_image_generations')
    .select('*, concept_images(*)')
    .order('created_at', { ascending: false })
    .limit(25);
  if (error) {
    if (error.message?.includes('concept_image_generations')) return [];
    throw dbError(error);
  }
  const generations = (data ?? []).map(toConceptImageGeneration);
  return Promise.all(generations.map(async generation => ({
    ...generation,
    images: await Promise.all(generation.images.map(async image => ({
      ...image,
      imageUrl: await createConceptImageSignedUrl(image.storagePath, image.imageUrl),
    }))),
  })));
}

export async function fetchConceptProjectSummaries(): Promise<ConceptProjectSummary[]> {
  const [conceptsResult, generationsResult] = await Promise.all([
    supabase.from('concept_tests').select('concept_folder_name, image_urls'),
    supabase.from('concept_image_generations').select('concept_folder_name, estimated_cost, requested_count'),
  ]);
  if (conceptsResult.error) {
    if (conceptsResult.error.message?.includes('concept_folder_name')) return [];
    throw dbError(conceptsResult.error);
  }
  if (generationsResult.error) {
    if (generationsResult.error.message?.includes('concept_image_generations')) return [];
    throw dbError(generationsResult.error);
  }

  const summaries = new Map<string, ConceptProjectSummary>();
  const ensure = (label: string) => {
    const key = label || 'Project 1';
    if (!summaries.has(key)) {
      summaries.set(key, { key, label: key, conceptCount: 0, imageCount: 0, estimatedSpend: 0 });
    }
    return summaries.get(key)!;
  };

  (conceptsResult.data ?? []).forEach(row => {
    const summary = ensure((row.concept_folder_name as string) ?? 'Project 1');
    summary.conceptCount += 1;
    summary.imageCount += ((row.image_urls as string[]) ?? []).length;
  });

  (generationsResult.data ?? []).forEach(row => {
    const summary = ensure((row.concept_folder_name as string) ?? 'Project 1');
    summary.estimatedSpend += Number(row.estimated_cost ?? 0);
    summary.imageCount += Number(row.requested_count ?? 0);
  });

  return Array.from(summaries.values()).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Moves images through the review lifecycle and keeps the legacy
 * panelist-visibility columns in sync. Tolerates databases that have not run
 * the concept_image_metadata migration yet by retrying without review_status.
 */
export async function updateConceptImageReviewStatus(
  imageIds: string[],
  status: ConceptImageReviewStatus,
  review?: Omit<ConceptImageReviewRecord, 'status'>,
): Promise<void> {
  if (!imageIds.length) return;
  const legacyPatch = {
    selected_for_panelists: status === 'selected' || status === 'approved',
    archived_at: status === 'rejected' ? new Date().toISOString() : null,
  };
  if (review) {
    const { data: rows, error: fetchError } = await supabase
      .from('concept_images')
      .select('id, performance_summary')
      .in('id', imageIds);
    if (fetchError) throw dbError(fetchError);

    await Promise.all((rows ?? []).map(async row => {
      const current = fromJson<Record<string, unknown>>(row.performance_summary) ?? {};
      const currentReview = typeof current.review === 'object' && current.review !== null
        ? current.review as Record<string, unknown>
        : {};
      const performanceSummary = asJson({
        ...current,
        review: {
          ...currentReview,
          ...review,
          status,
          reviewedAt: review.reviewedAt ?? new Date().toISOString(),
        },
      });
      const { error } = await supabase
        .from('concept_images')
        .update({ ...legacyPatch, review_status: status, performance_summary: performanceSummary })
        .eq('id', row.id);
      if (!error) return;
      if (error.message?.includes('review_status')) {
        const { error: fallbackError } = await supabase
          .from('concept_images')
          .update({ ...legacyPatch, performance_summary: performanceSummary })
          .eq('id', row.id);
        if (fallbackError) throw dbError(fallbackError);
        return;
      }
      throw dbError(error);
    }));
    return;
  }
  const { error } = await supabase
    .from('concept_images')
    .update({ ...legacyPatch, review_status: status })
    .in('id', imageIds);
  if (!error) return;
  if (error.message?.includes('review_status')) {
    const { error: fallbackError } = await supabase
      .from('concept_images')
      .update(legacyPatch)
      .in('id', imageIds);
    if (fallbackError) throw dbError(fallbackError);
    return;
  }
  throw dbError(error);
}

export async function linkConceptImagesToConcept(conceptTestId: string, imageIds: string[]): Promise<void> {
  const { data: images, error: fetchError } = await supabase
    .from('concept_images')
    .select('generation_id')
    .in('id', imageIds);
  if (fetchError) {
    if (fetchError.message?.includes('concept_images')) return;
    throw dbError(fetchError);
  }

  const { error } = await supabase
    .from('concept_images')
    .update({ concept_test_id: conceptTestId, selected_for_panelists: true })
    .in('id', imageIds);
  if (error) {
    if (error.message?.includes('concept_images')) return;
    throw dbError(error);
  }
  // Linking to a concept means the admin chose these for panelists; promote
  // their review status (already-approved images keep their stronger status).
  const { error: statusError } = await supabase
    .from('concept_images')
    .update({ review_status: 'selected' })
    .in('id', imageIds)
    .eq('review_status', 'draft');
  if (statusError && !statusError.message?.includes('review_status')) {
    throw dbError(statusError);
  }

  const generationIds = Array.from(new Set((images ?? []).map(row => row.generation_id as string).filter(Boolean)));
  if (generationIds.length) {
    const { error: generationError } = await supabase
      .from('concept_image_generations')
      .update({ concept_test_id: conceptTestId })
      .in('id', generationIds);
    if (generationError && !generationError.message?.includes('concept_image_generations')) {
      throw dbError(generationError);
    }
  }
}
