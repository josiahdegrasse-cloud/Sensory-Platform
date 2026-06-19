import { supabase } from '../supabase';
import { dbError, edgeFunctionErrorMessage } from './shared';

export interface ConceptQuestion {
  id: string;
  text: string;
  type: 'scale' | 'multiple_choice' | 'open_text' | 'ranking' | 'image_choice';
  options?: string[];
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
}

export interface ConceptResponse {
  id: string;
  userId: string;
  conceptTestId: string;
  answers: Record<string, string | number | string[]>;
  createdAt: string;
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
  createdAt: string;
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

function toConceptTest(row: Record<string, unknown>): ConceptTest {
  return {
    id: row.id as string,
    name: row.name as string,
    category: (row.category as string) ?? '',
    description: (row.description as string) ?? '',
    imageUrls: (row.image_urls as string[]) ?? [],
    imageIds: (row.generated_image_ids as string[]) ?? [],
    targetMarket: (row.target_market as string) ?? '',
    pricePoint: (row.price_point as string) ?? '',
    keyBenefits: (row.key_benefits as string) ?? '',
    questions: (row.questions as ConceptQuestion[]) ?? [],
    panelSize: (row.panel_size as number) ?? 50,
    assignedPanelistIds: (row.assigned_panelist_ids as string[]) ?? [],
    projectName: (row.project_name as string) ?? 'Project 1',
    foodTypeSlug: (row.food_type_slug as string) ?? '',
    approvalNotes: (row.approval_notes as string) ?? '',
    status: (row.status as ConceptTest['status']) ?? 'active',
    createdAt: row.created_at as string,
    launchedAt: (row.launched_at as string) ?? null,
    archivedAt: (row.archived_at as string) ?? null,
    variantDimensions: (row.variant_dimensions as Record<string, string | null>) ?? {},
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
  const rows = (data ?? []) as Record<string, unknown>[];
  const signed = await Promise.all(rows.map(async row => ({
    row,
    url: await createConceptImageSignedUrl(
      (row.storage_path as string) ?? null,
      (row.image_url as string) ?? '',
    ),
  })));
  const visible = signed.filter(entry => entry.url);
  const imageUrls = visible.map(entry => entry.url);
  if (!includeMeta) return { ...test, imageUrls };
  // Metadata stays on admin fetch paths only; panelists get bare image URLs.
  const imageMeta: ConceptImageMeta[] = visible.map(({ row }) => ({
    id: row.id as string,
    mode: (row.mode as string) ?? 'packaging',
    promptStyle: (row.prompt_style as string) ?? '',
    model: (row.model as string) ?? '',
    quality: (row.quality as string) ?? '',
    reviewStatus: toReviewStatus(row),
    createdAt: (row.created_at as string) ?? '',
  }));
  return { ...test, imageUrls, imageMeta };
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
      image_urls: test.imageIds?.length ? [] : test.imageUrls,
      generated_image_ids: test.imageIds ?? [],
      target_market: test.targetMarket,
      price_point: test.pricePoint,
      key_benefits: test.keyBenefits,
      questions: test.questions,
      panel_size: test.panelSize,
      assigned_panelist_ids: test.assignedPanelistIds,
      project_name: test.projectName ?? 'Project 1',
      food_type_slug: test.foodTypeSlug ?? '',
      approval_notes: test.approvalNotes ?? '',
      status: test.status,
      launched_at: test.status === 'active' ? new Date().toISOString() : null,
      variant_dimensions: test.variantDimensions ?? {},
    })
    .select()
    .single();
  if (error) throw dbError(error);
  const concept = toConceptTest(data);
  if (test.imageIds?.length) {
    await linkConceptImagesToConcept(concept.id, test.imageIds);
  }
  return hydrateConceptTestImages(concept);
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
  const tests = [...(globalResult.data ?? []), ...(assignedResult.data ?? [])]
    .filter(row => {
      const id = row.id as string;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(toConceptTest);
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

export async function fetchConceptResponsesForTest(conceptTestId: string): Promise<ConceptResponse[]> {
  const { data, error } = await supabase
    .from('concept_responses')
    .select('*')
    .eq('concept_test_id', conceptTestId)
    .order('created_at', { ascending: true });
  if (error) throw dbError(error);
  return (data ?? []).map(row => ({
    id: row.id as string,
    userId: row.user_id as string,
    conceptTestId: row.concept_test_id as string,
    answers: (row.answers as Record<string, string | number | string[]>) ?? {},
    createdAt: row.created_at as string,
  }));
}

function toCommercializationReport(row: Record<string, unknown>): CommercializationReportRecord {
  return {
    id: row.id as string,
    decisionRecordId: row.decision_record_id as string,
    conceptTestId: row.concept_test_id as string,
    packagingImageId: (row.packaging_image_id as string) ?? null,
    evidenceBundleId: (row.evidence_bundle_id as string) ?? null,
    status: row.status as CommercializationReportRecord['status'],
    version: Number(row.version),
    title: row.title as string,
    reportSnapshot: (row.report_snapshot as Record<string, unknown>) ?? {},
    createdBy: row.created_by as string,
    approvedBy: (row.approved_by as string) ?? null,
    approvedAt: (row.approved_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toEvidenceBundle(row: Record<string, unknown>): EvidenceBundleRecord {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    version: Number(row.version),
    schemaVersion: row.schema_version as string,
    sourceDataVersion: row.source_data_version as string,
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
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
}): Promise<CommercializationReportRecord> {
  const { data, error } = await supabase.rpc('create_commercialization_report', {
    target_decision_record_id: input.decisionRecordId,
    target_concept_test_id: input.conceptTestId,
    target_packaging_image_id: input.packagingImageId,
    target_title: input.title,
    target_report_snapshot: input.reportSnapshot,
  });
  if (error) throw dbError(error);
  const report = toCommercializationReport(data as Record<string, unknown>);

  // Link the evidence bundle backing this report. Done as a follow-up update
  // (rather than threading through the SECURITY DEFINER RPC) — RLS lets the
  // creator update a non-approved report. Non-fatal: the report is already saved.
  if (input.evidenceBundleId) {
    const { data: linked, error: linkError } = await supabase
      .from('commercialization_reports')
      .update({ evidence_bundle_id: input.evidenceBundleId })
      .eq('id', report.id)
      .select()
      .maybeSingle();
    if (!linkError && linked) return toCommercializationReport(linked as Record<string, unknown>);
  }
  return report;
}

export async function fetchEvidenceBundles(projectId?: string): Promise<EvidenceBundleRecord[]> {
  let query = supabase
    .from('evidence_bundles')
    .select('*')
    .order('version', { ascending: false });
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query;
  if (error && /evidence_bundles|schema cache|does not exist/i.test(error.message ?? '')) return [];
  if (error) throw dbError(error);
  return (data ?? []).map(toEvidenceBundle);
}

export async function saveEvidenceBundle(input: {
  projectId: string;
  schemaVersion: string;
  sourceDataVersion: string;
  payload: Record<string, unknown>;
}): Promise<EvidenceBundleRecord> {
  const { data, error } = await supabase.rpc('create_evidence_bundle', {
    target_project_id: input.projectId,
    target_schema_version: input.schemaVersion,
    target_source_data_version: input.sourceDataVersion,
    target_payload: input.payload,
  });
  if (error) throw dbError(error);
  return toEvidenceBundle(data as Record<string, unknown>);
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

// Calls the generate-report-narrative Edge Function (OpenAI, evidence-constrained).
export async function generateReportNarrative(
  input: ReportNarrativeRequest,
): Promise<{ sections: Record<string, string>; model: string }> {
  const { data, error } = await supabase.functions.invoke('generate-report-narrative', { body: input });
  if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Narrative generation failed.'));
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

function toConceptSettings(row: Record<string, unknown>): ConceptGenerationSettings {
  return {
    id: row.id as string,
    defaultImageCount: (row.default_image_count as number) ?? 4,
    maxImagesPerConcept: (row.max_images_per_concept as number) ?? 4,
    defaultQuality: (row.default_quality as ConceptGenerationSettings['defaultQuality']) ?? 'medium',
    defaultModel: (row.default_model as string) ?? 'gpt-image-1.5',
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
function toReviewStatus(row: Record<string, unknown>): ConceptImageReviewStatus {
  const status = row.review_status as ConceptImageReviewStatus | undefined;
  if (status === 'draft' || status === 'selected' || status === 'approved' || status === 'rejected') return status;
  if (row.archived_at) return 'rejected';
  return row.selected_for_panelists ? 'selected' : 'draft';
}

function toConceptGeneratedImage(row: Record<string, unknown>): ConceptGeneratedImage {
  return {
    id: row.id as string,
    generationId: row.generation_id as string,
    conceptTestId: (row.concept_test_id as string) ?? null,
    imageUrl: row.image_url as string,
    storagePath: (row.storage_path as string) ?? null,
    selectedForPanelists: (row.selected_for_panelists as boolean) ?? false,
    sortOrder: (row.sort_order as number) ?? 0,
    mode: (row.mode as string) ?? 'packaging',
    promptStyle: (row.prompt_style as string) ?? '',
    reviewStatus: toReviewStatus(row),
    model: (row.model as string) ?? 'gpt-image-1.5',
    quality: (row.quality as string) ?? 'medium',
    performanceSummary: (row.performance_summary as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  };
}

function toConceptImageGeneration(row: Record<string, unknown>): ConceptImageGeneration {
  return {
    id: row.id as string,
    conceptTestId: (row.concept_test_id as string) ?? null,
    projectName: (row.project_name as string) ?? 'Project 1',
    foodTypeSlug: (row.food_type_slug as string) ?? '',
    conceptName: (row.concept_name as string) ?? '',
    mode: (row.mode as string) ?? 'packaging',
    prompt: (row.prompt as string) ?? '',
    promptStyle: (row.prompt_style as string) ?? 'balanced',
    model: (row.model as string) ?? 'gpt-image-1.5',
    quality: (row.quality as string) ?? 'medium',
    requestedCount: (row.requested_count as number) ?? 4,
    status: (row.status as ConceptImageGeneration['status']) ?? 'completed',
    errorMessage: (row.error_message as string) ?? null,
    estimatedCost: Number(row.estimated_cost ?? 0),
    createdAt: row.created_at as string,
    images: Array.isArray(row.concept_images)
      ? (row.concept_images as Record<string, unknown>[]).map(toConceptGeneratedImage)
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

  const patch: Record<string, unknown> = {
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
    supabase.from('concept_tests').select('project_name, image_urls'),
    supabase.from('concept_image_generations').select('project_name, estimated_cost, requested_count'),
  ]);
  if (conceptsResult.error) {
    if (conceptsResult.error.message?.includes('project_name')) return [];
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
    const summary = ensure((row.project_name as string) ?? 'Project 1');
    summary.conceptCount += 1;
    summary.imageCount += ((row.image_urls as string[]) ?? []).length;
  });

  (generationsResult.data ?? []).forEach(row => {
    const summary = ensure((row.project_name as string) ?? 'Project 1');
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
): Promise<void> {
  if (!imageIds.length) return;
  const legacyPatch = {
    selected_for_panelists: status === 'selected' || status === 'approved',
    archived_at: status === 'rejected' ? new Date().toISOString() : null,
  };
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
