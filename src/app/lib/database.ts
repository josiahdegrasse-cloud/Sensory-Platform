import { supabase } from './supabase';
import type { Product, QuestionnaireResponse, HedonicReferenceScores } from '../data/mock-users';
import type { TrainingLevel } from '../utils/panelist-metrics';
import type { FoodTypeDetection } from './food-intelligence';
import { formatFoodTypeLabel, getDefaultCataAttributesForFoodType, slugifyFoodType } from './food-intelligence';

export const CURRENT_CONSENT_VERSION = '2026-06-05-v1';

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function toProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    createdDate: row.created_at as string,
    status: row.status as Product['status'],
    customAttributes: (row.custom_attributes as string[]) ?? undefined,
    isMultiSample: (row.is_multi_sample as boolean) ?? false,
    samples: (row.samples as Product['samples']) ?? undefined,
    isCalibration: (row.is_calibration as boolean) ?? false,
    referenceScores: (row.reference_scores as HedonicReferenceScores) ?? null,
    assignedPanelistIds: (row.assigned_panelist_ids as string[]) ?? [],
    sourceImportBatchId: (row.source_import_batch_id as string) ?? null,
    sourceSampleId: (row.source_sample_id as string) ?? null,
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
    assigned_panelist_ids: p.assignedPanelistIds ?? [],
    source_import_batch_id: p.sourceImportBatchId ?? null,
    source_sample_id: p.sourceSampleId ?? null,
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

export function isMissingFoodImportSchema(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /food_types|instrumental_samples|import_batches|e_tongue_measurements|gcms_compounds|composition_profiles/i.test(message) &&
    /schema cache|could not find|does not exist|PGRST205/i.test(message)
  );
}

export async function acceptPanelistConsent(userId: string): Promise<string> {
  const acceptedAt = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({
      consent_accepted_at: acceptedAt,
      consent_version: CURRENT_CONSENT_VERSION,
      consent_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
    .eq('id', userId);

  if (error) throw dbError(error);
  return acceptedAt;
}

// ─── Food Intelligence / Instrumental Imports ───────────────────────────────

export interface FoodTypeRecord {
  id: string;
  slug: string;
  label: string;
  status: 'active' | 'archived' | 'deleted';
  source: 'system' | 'import' | 'manual';
  aliases: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ETongueMeasurementRecord {
  sampleId: string;
  sampleName?: string;
  sourness: number;
  bitterness: number;
  saltiness: number;
  umami: number;
  sweetness: number;
  type?: string;
  category?: string;
  importBatchId?: string;
}

export interface GCMSCompoundRecord {
  name: string;
  concentration: number;
  aroma: string;
  threshold: number;
}

export interface ChemicalCompositionRecord {
  protein: number;
  fat: number;
  moisture: number;
  pH: number;
  saltContent: number;
  calciumMg: number;
}

export interface InstrumentalDataset {
  eTongueData: ETongueMeasurementRecord[];
  gcmsData: Record<string, GCMSCompoundRecord[]>;
  compositionData: Record<string, ChemicalCompositionRecord>;
}

export interface InstrumentalImportInput extends InstrumentalDataset {
  fileName: string;
  rowCount: number;
  recognizedColumns: string[];
  ignoredColumns: string[];
  detection: FoodTypeDetection;
  importedBy?: string | null;
}

function toFoodType(row: Record<string, unknown>): FoodTypeRecord {
  return {
    id: row.id as string,
    slug: row.slug as string,
    label: row.label as string,
    status: row.status as 'active' | 'archived' | 'deleted',
    source: row.source as 'system' | 'import' | 'manual',
    aliases: (row.aliases as string[]) ?? [],
    createdBy: (row.created_by as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function fetchFoodTypes(): Promise<FoodTypeRecord[]> {
  const { data, error } = await supabase
    .from('food_types')
    .select('*')
    .order('source', { ascending: false })
    .order('label', { ascending: true });
  if (error && isMissingFoodImportSchema(dbError(error))) return [];
  if (error) throw dbError(error);
  return (data ?? []).map(toFoodType);
}

export async function upsertFoodType(
  detection: FoodTypeDetection,
  source: 'import' | 'manual' = 'import',
  actorId?: string | null,
): Promise<FoodTypeRecord> {
  const slug = slugifyFoodType(detection.slug);
  const { data: existing, error: existingError } = await supabase
    .from('food_types')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (existingError) throw dbError(existingError);

  if (existing) {
    const existingRecord = toFoodType(existing);
    const aliases = Array.from(new Set([...existingRecord.aliases, ...(detection.aliases ?? [])]));
    const { data, error } = await supabase
      .from('food_types')
      .update({
        label: existingRecord.source === 'system' ? existingRecord.label : detection.label || formatFoodTypeLabel(slug),
        status: 'active',
        aliases,
        updated_at: new Date().toISOString(),
      })
      .eq('slug', slug)
      .select()
      .single();
    if (error) throw dbError(error);
    return toFoodType(data);
  }

  const { data, error } = await supabase
    .from('food_types')
    .insert({
      slug,
      label: detection.label || formatFoodTypeLabel(slug),
      status: 'active',
      source,
      aliases: detection.aliases ?? [],
      created_by: actorId ?? null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw dbError(error);
  return toFoodType(data);
}

export async function archiveFoodTypeRecord(slug: string): Promise<void> {
  const { error } = await supabase.rpc('set_food_type_status', {
    target_slug: slug,
    next_status: 'archived',
  });
  if (error) throw dbError(error);
}

export async function restoreFoodTypeRecord(slug: string): Promise<void> {
  const { error } = await supabase.rpc('set_food_type_status', {
    target_slug: slug,
    next_status: 'active',
  });
  if (error) throw dbError(error);
}

export async function deleteFoodTypeRecord(slug: string): Promise<void> {
  const { error } = await supabase.rpc('set_food_type_status', {
    target_slug: slug,
    next_status: 'deleted',
  });
  if (error) throw dbError(error);
}

export async function updateImportBatchStatus(
  id: string,
  status: 'active' | 'archived' | 'deleted',
): Promise<void> {
  const { error } = await supabase.rpc('set_import_batch_status', {
    target_batch_id: id,
    next_status: status,
  });
  if (error) throw dbError(error);
}

export interface ImportBatchRecord {
  id: string;
  foodTypeSlug: string;
  foodTypeLabel: string;
  fileName: string;
  rowCount: number;
  recognizedColumns: string[];
  ignoredColumns: string[];
  detectionConfidence: number;
  status: 'active' | 'archived' | 'deleted';
  importedBy: string | null;
  importedByName: string | null;
  createdAt: string;
  sampleCount: number;
}

export interface ImportMappingPreset {
  id: string;
  name: string;
  mappings: Array<{ source: string; target: string; conversion: string }>;
  createdAt: string;
  updatedAt: string;
}

export async function fetchImportMappingPresets(): Promise<ImportMappingPreset[]> {
  const { data, error } = await supabase
    .from('import_mapping_presets')
    .select('id, name, mappings, created_at, updated_at')
    .order('name');
  if (error && /import_mapping_presets|schema cache|does not exist/i.test(error.message ?? '')) return [];
  if (error) throw dbError(error);
  return (data ?? []).map(row => ({
    id: row.id as string,
    name: row.name as string,
    mappings: (row.mappings as ImportMappingPreset['mappings']) ?? [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

export async function upsertImportMappingPreset(input: {
  id?: string;
  name: string;
  mappings: ImportMappingPreset['mappings'];
  createdBy: string;
}): Promise<void> {
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    name: input.name.trim(),
    mappings: input.mappings,
    created_by: input.createdBy,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('import_mapping_presets').upsert(payload, { onConflict: 'name' });
  if (error) throw dbError(error);
}

export async function deleteImportMappingPreset(id: string): Promise<void> {
  const { error } = await supabase.from('import_mapping_presets').delete().eq('id', id);
  if (error) throw dbError(error);
}

export async function fetchImportBatches(): Promise<ImportBatchRecord[]> {
  const { data, error } = await supabase
    .from('import_batches')
    .select(`
      id, file_name, row_count, recognized_columns, ignored_columns,
      detection_confidence, status, imported_by, created_at,
      food_types(slug, label),
      profiles(name),
      instrumental_samples(count)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error && isMissingFoodImportSchema(dbError(error))) return [];
  if (error) throw dbError(error);

  return ((data ?? []) as Record<string, unknown>[]).map(row => {
    const ft = row.food_types as { slug?: string; label?: string } | null;
    const profile = row.profiles as { name?: string } | null;
    const countArr = row.instrumental_samples as { count?: number }[] | null;
    return {
      id: row.id as string,
      foodTypeSlug: ft?.slug ?? 'generic',
      foodTypeLabel: ft?.label ?? 'Generic',
      fileName: row.file_name as string,
      rowCount: row.row_count as number,
      recognizedColumns: (row.recognized_columns as string[]) ?? [],
      ignoredColumns: (row.ignored_columns as string[]) ?? [],
      detectionConfidence: Number(row.detection_confidence ?? 0),
      status: row.status as 'active' | 'archived' | 'deleted',
      importedBy: (row.imported_by as string) ?? null,
      importedByName: profile?.name ?? null,
      createdAt: row.created_at as string,
      sampleCount: countArr?.[0]?.count ?? 0,
    };
  });
}

export async function fetchInstrumentalDataset(): Promise<InstrumentalDataset> {
  const { data, error } = await supabase
    .from('instrumental_samples')
    .select(`
      sample_id,
      sample_name,
      category,
      food_types!inner(slug, status),
      import_batches!inner(id, status),
      e_tongue_measurements(sourness, bitterness, saltiness, umami, sweetness),
      gcms_compounds(name, concentration, aroma, threshold),
      composition_profiles(protein, fat, moisture, ph, salt_content, calcium_mg)
    `)
    .eq('food_types.status', 'active')
    .eq('import_batches.status', 'active')
    .order('created_at', { ascending: true });

  if (error && isMissingFoodImportSchema(dbError(error))) {
    return { eTongueData: [], gcmsData: {}, compositionData: {} };
  }
  if (error) throw dbError(error);

  const eTongueData: ETongueMeasurementRecord[] = [];
  const gcmsData: Record<string, GCMSCompoundRecord[]> = {};
  const compositionData: Record<string, ChemicalCompositionRecord> = {};

  ((data ?? []) as Record<string, unknown>[]).forEach(row => {
    const sampleId = row.sample_id as string;
    const foodType = row.food_types as { slug?: string } | null;
    const importBatch = row.import_batches as { id?: string } | null;
    const eTongue = ((row.e_tongue_measurements as Record<string, unknown>[] | null) ?? [])[0];
    if (eTongue) {
      eTongueData.push({
        sampleId,
        sampleName: (row.sample_name as string) ?? undefined,
        category: (row.category as string) ?? undefined,
        importBatchId: importBatch?.id,
        type: foodType?.slug,
        sourness: Number(eTongue.sourness ?? 0),
        bitterness: Number(eTongue.bitterness ?? 0),
        saltiness: Number(eTongue.saltiness ?? 0),
        umami: Number(eTongue.umami ?? 0),
        sweetness: Number(eTongue.sweetness ?? 0),
      });
    }

    const compounds = (row.gcms_compounds as Record<string, unknown>[] | null) ?? [];
    if (compounds.length > 0) {
      gcmsData[sampleId] = compounds.map(compound => ({
        name: compound.name as string,
        concentration: Number(compound.concentration ?? 0),
        aroma: (compound.aroma as string) ?? 'unknown',
        threshold: Number(compound.threshold ?? 0),
      }));
    }

    const composition = ((row.composition_profiles as Record<string, unknown>[] | null) ?? [])[0];
    if (composition) {
      compositionData[sampleId] = {
        protein: Number(composition.protein ?? 0),
        fat: Number(composition.fat ?? 0),
        moisture: Number(composition.moisture ?? 0),
        pH: Number(composition.ph ?? 0),
        saltContent: Number(composition.salt_content ?? 0),
        calciumMg: Number(composition.calcium_mg ?? 0),
      };
    }
  });

  return { eTongueData, gcmsData, compositionData };
}

export async function insertInstrumentalImport(input: InstrumentalImportInput): Promise<InstrumentalDataset> {
  const fingerprintSource = JSON.stringify({
    fileName: input.fileName,
    detection: input.detection.slug,
    eTongueData: input.eTongueData,
    gcmsData: input.gcmsData,
    compositionData: input.compositionData,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprintSource));
  const idempotencyKey = Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  const { error } = await supabase.rpc('create_instrumental_import', {
    payload: {
      idempotencyKey,
      fileName: input.fileName,
      rowCount: input.rowCount,
      recognizedColumns: input.recognizedColumns,
      ignoredColumns: input.ignoredColumns,
      detection: input.detection,
      eTongueData: input.eTongueData,
      gcmsData: input.gcmsData,
      compositionData: input.compositionData,
      customAttributes: getDefaultCataAttributesForFoodType(input.detection.slug),
    },
  });
  if (error) throw dbError(error);

  return fetchInstrumentalDataset();
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
  if (updates.assignedPanelistIds !== undefined) patch.assigned_panelist_ids = updates.assignedPanelistIds;
  if (updates.sourceImportBatchId !== undefined) patch.source_import_batch_id = updates.sourceImportBatchId;
  if (updates.sourceSampleId !== undefined) patch.source_sample_id = updates.sourceSampleId;

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
  email: string | null;
  panelistId: string | null;
  status: 'active' | 'inactive' | 'archived';
  consentAcceptedAt: string | null;
  consentVersion: string | null;
  completedCount: number;
  trainingLevel: TrainingLevel;
}

export async function fetchPanelists(): Promise<PanelistInfo[]> {
  const [profilesResult, { data: responses }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, panelist_id, training_level, status, consent_accepted_at, consent_version')
      .eq('role', 'panelist')
      .order('created_at', { ascending: false }),
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
    email: (p.email as string) ?? null,
    panelistId: (p.panelist_id as string) ?? null,
    status: ((p.status as PanelistInfo['status']) ?? 'active'),
    consentAcceptedAt: (p.consent_accepted_at as string) ?? null,
    consentVersion: (p.consent_version as string) ?? null,
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

// ─── Workspace Settings / Audit ──────────────────────────────────────────────

export interface WorkspaceSettings {
  workspaceName: string;
  organizationName: string;
  adminContactEmail: string;
  defaultTimezone: string;
  dataRetentionMonths: number;
  requirePanelistConsent: boolean;
  allowSelfSignup: boolean;
  defaultPanelSize: number;
  requireHedonicSection: boolean;
  requireIntensitySection: boolean;
  requireEmotionSection: boolean;
  allowPanelistComments: boolean;
  requireAllSamplesBeforeSubmit: boolean;
  autoCreateFoodTypes: boolean;
  autoCreateSurveysFromImports: boolean;
  requireImportReview: boolean;
  duplicateSamplePolicy: 'skip' | 'rename' | 'replace';
  requirePanelistId: boolean;
  allowPanelistsViewHistory: boolean;
  inactivePanelistDays: number;
  conceptMaxGenerationsPerConcept: number;
  conceptMonthlyBudgetCents: number;
  conceptRequireApproval: boolean;
  decisionGoThreshold: number;
  decisionStopThreshold: number;
  decisionMinResponses: number;
  decisionLockConfirmed: boolean;
  anonymizePanelistsInReports: boolean;
  exportFormat: 'xlsx' | 'csv' | 'pdf';
  reportFooter: string;
  notifyOnImport: boolean;
  notifyOnCompletionTarget: boolean;
  notifyOnGenerationFailure: boolean;
  updatedAt: string | null;
}

export interface PublicWorkspaceConfig {
  workspaceName: string;
  allowSelfSignup: boolean;
}

export interface AuditEventRecord {
  id: string;
  actorId: string | null;
  actorName: string | null;
  eventType: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DecisionRecord {
  id: string;
  timestamp: string;
  sampleId: string;
  sampleName: string;
  decision: 'GO' | 'TWEAK' | 'STOP';
  issfScore: number;
  confidence: number;
  user: string;
  note: string;
  methodVersion: string;
  decisionFingerprint: string;
}

function defaultWorkspaceSettings(): WorkspaceSettings {
  return {
    workspaceName: 'Sensory Analysis Workspace',
    organizationName: 'New Food Innovation',
    adminContactEmail: '',
    defaultTimezone: 'America/New_York',
    dataRetentionMonths: 24,
    requirePanelistConsent: true,
    allowSelfSignup: true,
    defaultPanelSize: 24,
    requireHedonicSection: true,
    requireIntensitySection: true,
    requireEmotionSection: true,
    allowPanelistComments: true,
    requireAllSamplesBeforeSubmit: true,
    autoCreateFoodTypes: true,
    autoCreateSurveysFromImports: true,
    requireImportReview: false,
    duplicateSamplePolicy: 'skip',
    requirePanelistId: false,
    allowPanelistsViewHistory: false,
    inactivePanelistDays: 90,
    conceptMaxGenerationsPerConcept: 12,
    conceptMonthlyBudgetCents: 2500,
    conceptRequireApproval: false,
    decisionGoThreshold: 75,
    decisionStopThreshold: 45,
    decisionMinResponses: 12,
    decisionLockConfirmed: true,
    anonymizePanelistsInReports: true,
    exportFormat: 'xlsx',
    reportFooter: '',
    notifyOnImport: true,
    notifyOnCompletionTarget: true,
    notifyOnGenerationFailure: true,
    updatedAt: null,
  };
}

function toWorkspaceSettings(row: Record<string, unknown>): WorkspaceSettings {
  return {
    workspaceName: (row.workspace_name as string) ?? 'Sensory Analysis Workspace',
    organizationName: (row.organization_name as string) ?? 'New Food Innovation',
    adminContactEmail: (row.admin_contact_email as string) ?? '',
    defaultTimezone: (row.default_timezone as string) ?? 'America/New_York',
    dataRetentionMonths: Number(row.data_retention_months ?? 24),
    requirePanelistConsent: Boolean(row.require_panelist_consent ?? true),
    allowSelfSignup: Boolean(row.allow_self_signup ?? true),
    defaultPanelSize: Number(row.default_panel_size ?? 24),
    requireHedonicSection: Boolean(row.require_hedonic_section ?? true),
    requireIntensitySection: Boolean(row.require_intensity_section ?? true),
    requireEmotionSection: Boolean(row.require_emotion_section ?? true),
    allowPanelistComments: Boolean(row.allow_panelist_comments ?? true),
    requireAllSamplesBeforeSubmit: Boolean(row.require_all_samples_before_submit ?? true),
    autoCreateFoodTypes: Boolean(row.auto_create_food_types ?? true),
    autoCreateSurveysFromImports: Boolean(row.auto_create_surveys_from_imports ?? true),
    requireImportReview: Boolean(row.require_import_review ?? false),
    duplicateSamplePolicy: ((row.duplicate_sample_policy as WorkspaceSettings['duplicateSamplePolicy']) ?? 'skip'),
    requirePanelistId: Boolean(row.require_panelist_id ?? false),
    allowPanelistsViewHistory: Boolean(row.allow_panelists_view_history ?? false),
    inactivePanelistDays: Number(row.inactive_panelist_days ?? 90),
    conceptMaxGenerationsPerConcept: Number(row.concept_max_generations_per_concept ?? 12),
    conceptMonthlyBudgetCents: Number(row.concept_monthly_budget_cents ?? 2500),
    conceptRequireApproval: Boolean(row.concept_require_approval ?? false),
    decisionGoThreshold: Number(row.decision_go_threshold ?? 75),
    decisionStopThreshold: Number(row.decision_stop_threshold ?? 45),
    decisionMinResponses: Number(row.decision_min_responses ?? 12),
    decisionLockConfirmed: Boolean(row.decision_lock_confirmed ?? true),
    anonymizePanelistsInReports: Boolean(row.anonymize_panelists_in_reports ?? true),
    exportFormat: ((row.export_format as WorkspaceSettings['exportFormat']) ?? 'xlsx'),
    reportFooter: (row.report_footer as string) ?? '',
    notifyOnImport: Boolean(row.notify_on_import ?? true),
    notifyOnCompletionTarget: Boolean(row.notify_on_completion_target ?? true),
    notifyOnGenerationFailure: Boolean(row.notify_on_generation_failure ?? true),
    updatedAt: (row.updated_at as string) ?? null,
  };
}

export async function fetchWorkspaceSettings(): Promise<WorkspaceSettings> {
  const { data, error } = await supabase
    .from('workspace_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle();

  if (error) {
    if (/workspace_settings|schema cache|does not exist/i.test(error.message ?? '')) return defaultWorkspaceSettings();
    throw dbError(error);
  }
  return data ? toWorkspaceSettings(data) : defaultWorkspaceSettings();
}

export async function fetchPublicWorkspaceConfig(): Promise<PublicWorkspaceConfig> {
  const { data, error } = await supabase.rpc('get_public_workspace_config');
  if (error) {
    if (/get_public_workspace_config|schema cache|does not exist/i.test(error.message ?? '')) {
      return { workspaceName: 'Sensory Analysis Workspace', allowSelfSignup: true };
    }
    throw dbError(error);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    workspaceName: (row?.workspace_name as string) ?? 'Sensory Analysis Workspace',
    allowSelfSignup: Boolean(row?.allow_self_signup ?? true),
  };
}

export async function updateWorkspaceSettings(
  updates: WorkspaceSettings,
  actorId?: string | null,
): Promise<WorkspaceSettings> {
  const decisionStopThreshold = Math.min(99, Math.max(0, Number(updates.decisionStopThreshold) || 45));
  const decisionGoThreshold = Math.min(100, Math.max(decisionStopThreshold + 1, Number(updates.decisionGoThreshold) || 75));
  const patch = {
    id: true,
    workspace_name: updates.workspaceName.trim() || 'Sensory Analysis Workspace',
    organization_name: updates.organizationName.trim() || 'New Food Innovation',
    admin_contact_email: updates.adminContactEmail.trim() || null,
    default_timezone: updates.defaultTimezone.trim() || 'America/New_York',
    data_retention_months: Math.min(120, Math.max(1, Number(updates.dataRetentionMonths) || 24)),
    require_panelist_consent: updates.requirePanelistConsent,
    allow_self_signup: updates.allowSelfSignup,
    default_panel_size: Math.min(500, Math.max(1, Number(updates.defaultPanelSize) || 24)),
    require_hedonic_section: updates.requireHedonicSection,
    require_intensity_section: updates.requireIntensitySection,
    require_emotion_section: updates.requireEmotionSection,
    allow_panelist_comments: updates.allowPanelistComments,
    require_all_samples_before_submit: updates.requireAllSamplesBeforeSubmit,
    auto_create_food_types: updates.autoCreateFoodTypes,
    auto_create_surveys_from_imports: updates.autoCreateSurveysFromImports,
    require_import_review: updates.requireImportReview,
    duplicate_sample_policy: updates.duplicateSamplePolicy,
    require_panelist_id: updates.requirePanelistId,
    allow_panelists_view_history: updates.allowPanelistsViewHistory,
    inactive_panelist_days: Math.min(730, Math.max(1, Number(updates.inactivePanelistDays) || 90)),
    concept_max_generations_per_concept: Math.min(100, Math.max(1, Number(updates.conceptMaxGenerationsPerConcept) || 12)),
    concept_monthly_budget_cents: Math.min(1000000, Math.max(0, Number(updates.conceptMonthlyBudgetCents) || 0)),
    concept_require_approval: updates.conceptRequireApproval,
    decision_go_threshold: decisionGoThreshold,
    decision_stop_threshold: decisionStopThreshold,
    decision_min_responses: Math.min(500, Math.max(1, Number(updates.decisionMinResponses) || 12)),
    decision_lock_confirmed: updates.decisionLockConfirmed,
    anonymize_panelists_in_reports: updates.anonymizePanelistsInReports,
    export_format: updates.exportFormat,
    report_footer: updates.reportFooter.trim(),
    notify_on_import: updates.notifyOnImport,
    notify_on_completion_target: updates.notifyOnCompletionTarget,
    notify_on_generation_failure: updates.notifyOnGenerationFailure,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('workspace_settings')
    .upsert(patch)
    .select()
    .single();
  if (error) throw dbError(error);

  await insertAuditEvent({
    actorId: actorId ?? null,
    eventType: 'workspace_settings_updated',
    entityType: 'workspace_settings',
    metadata: {
      workspaceName: patch.workspace_name,
      organizationName: patch.organization_name,
      dataRetentionMonths: patch.data_retention_months,
      requirePanelistConsent: patch.require_panelist_consent,
      allowSelfSignup: patch.allow_self_signup,
      defaultPanelSize: patch.default_panel_size,
      importAutomation: patch.auto_create_surveys_from_imports,
      decisionThresholds: `${patch.decision_stop_threshold}/${patch.decision_go_threshold}`,
      governance: {
        anonymizeReports: patch.anonymize_panelists_in_reports,
        exportFormat: patch.export_format,
      },
    },
  });

  return toWorkspaceSettings(data);
}

export async function insertAuditEvent(input: {
  actorId?: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('audit_events').insert({
    actor_id: input.actorId ?? null,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error && !/audit_events|schema cache|does not exist/i.test(error.message ?? '')) throw dbError(error);
}

export async function fetchAuditEvents(limit = 80): Promise<AuditEventRecord[]> {
  const { data, error } = await supabase
    .from('audit_events')
    .select('id, actor_id, event_type, entity_type, entity_id, metadata, created_at, profiles(name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (/audit_events|schema cache|does not exist/i.test(error.message ?? '')) return [];
    throw dbError(error);
  }

  return (data ?? []).map(row => {
    const profile = row.profiles as { name?: string } | null;
    return {
      id: row.id as string,
      actorId: (row.actor_id as string) ?? null,
      actorName: profile?.name ?? null,
      eventType: row.event_type as string,
      entityType: row.entity_type as string,
      entityId: (row.entity_id as string) ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at as string,
    };
  });
}

export async function fetchDecisionRecords(limit = 200): Promise<DecisionRecord[]> {
  const { data, error } = await supabase
    .from('decision_records')
    .select('*, profiles(name)')
    .order('created_at', { ascending: false })
    .limit(Math.min(500, Math.max(1, limit)));
  if (error) {
    if (/decision_records|schema cache|does not exist/i.test(error.message ?? '')) return [];
    throw dbError(error);
  }
  return (data ?? []).map(row => ({
    id: row.id as string,
    timestamp: row.created_at as string,
    sampleId: row.sample_id as string,
    sampleName: row.sample_name as string,
    decision: row.decision as DecisionRecord['decision'],
    issfScore: Number(row.issf_score),
    confidence: Number(row.confidence),
    user: ((row.profiles as { name?: string } | null)?.name) ?? 'Administrator',
    note: (row.note as string) ?? '',
    methodVersion: row.method_version as string,
    decisionFingerprint: row.decision_fingerprint as string,
  }));
}

export async function insertDecisionRecord(input: {
  sampleId: string;
  sampleName: string;
  decision: DecisionRecord['decision'];
  issfScore: number;
  confidence: number;
  note: string;
  methodVersion: string;
  decisionFingerprint: string;
  createdBy: string;
}): Promise<void> {
  const { error } = await supabase.from('decision_records').insert({
    sample_id: input.sampleId,
    sample_name: input.sampleName,
    decision: input.decision,
    issf_score: input.issfScore,
    confidence: input.confidence,
    note: input.note,
    method_version: input.methodVersion,
    decision_fingerprint: input.decisionFingerprint,
    created_by: input.createdBy,
  });
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
  imageIds?: string[];
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

export interface ConceptGenerationSettings {
  id: string;
  defaultImageCount: number;
  maxImagesPerConcept: number;
  defaultQuality: 'low' | 'medium' | 'high' | 'auto';
  defaultModel: string;
  estimatedCostPerImage: number;
  monthlyBudget: number;
  promptStyle: 'balanced' | 'premium' | 'natural' | 'family' | 'foodservice' | 'clean-label';
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
  };
}

async function createConceptImageSignedUrl(storagePath: string | null, fallback: string): Promise<string> {
  if (!storagePath) return fallback;
  const { data, error } = await supabase.storage
    .from('concept-images')
    .createSignedUrl(storagePath, 60 * 60);
  if (error) return fallback.startsWith('https://') ? fallback : '';
  return data.signedUrl;
}

async function hydrateConceptTestImages(test: ConceptTest): Promise<ConceptTest> {
  if (!test.imageIds?.length) return test;
  const { data, error } = await supabase
    .from('concept_images')
    .select('id, image_url, storage_path, sort_order')
    .in('id', test.imageIds)
    .order('sort_order', { ascending: true });
  if (error) throw dbError(error);
  const imageUrls = (await Promise.all((data ?? []).map(row =>
    createConceptImageSignedUrl(
      (row.storage_path as string) ?? null,
      (row.image_url as string) ?? '',
    )
  ))).filter(Boolean);
  return { ...test, imageUrls };
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
  return Promise.all(tests.map(hydrateConceptTestImages));
}

export async function fetchConceptTestsForAdmin(): Promise<ConceptTest[]> {
  const { data, error } = await supabase
    .from('concept_tests')
    .select('*')
    .in('status', ['active', 'completed', 'approved'])
    .order('created_at', { ascending: false });
  if (error) throw dbError(error);
  return Promise.all((data ?? []).map(row => hydrateConceptTestImages(toConceptTest(row))));
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
}): Promise<CommercializationReportRecord> {
  const { data, error } = await supabase.rpc('create_commercialization_report', {
    target_decision_record_id: input.decisionRecordId,
    target_concept_test_id: input.conceptTestId,
    target_packaging_image_id: input.packagingImageId,
    target_title: input.title,
    target_report_snapshot: input.reportSnapshot,
  });
  if (error) throw dbError(error);
  return toCommercializationReport(data as Record<string, unknown>);
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
