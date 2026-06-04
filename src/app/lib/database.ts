import { supabase } from './supabase';
import type { Product, QuestionnaireResponse, HedonicReferenceScores } from '../data/mock-users';
import type { TrainingLevel } from '../utils/panelist-metrics';
import type { FoodTypeDetection } from './food-intelligence';
import { formatFoodTypeLabel, slugifyFoodType } from './food-intelligence';

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

// ─── Food Intelligence / Instrumental Imports ───────────────────────────────

export interface FoodTypeRecord {
  id: string;
  slug: string;
  label: string;
  status: 'active' | 'archived';
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
    status: row.status as 'active' | 'archived',
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
  const { error } = await supabase
    .from('food_types')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('slug', slug);
  if (error) throw dbError(error);
}

export async function restoreFoodTypeRecord(slug: string): Promise<void> {
  const { error } = await supabase
    .from('food_types')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('slug', slug);
  if (error) throw dbError(error);
}

export async function deleteFoodTypeRecord(slug: string): Promise<void> {
  const { error } = await supabase
    .from('food_types')
    .delete()
    .eq('slug', slug)
    .neq('source', 'system');
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
      import_batches!inner(status),
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
    const eTongue = ((row.e_tongue_measurements as Record<string, unknown>[] | null) ?? [])[0];
    if (eTongue) {
      eTongueData.push({
        sampleId,
        sampleName: (row.sample_name as string) ?? undefined,
        category: (row.category as string) ?? undefined,
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
  const foodType = await upsertFoodType(input.detection, 'import', input.importedBy);

  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({
      food_type_id: foodType.id,
      file_name: input.fileName,
      row_count: input.rowCount,
      recognized_columns: input.recognizedColumns,
      ignored_columns: input.ignoredColumns,
      detection_confidence: input.detection.confidence,
      imported_by: input.importedBy ?? null,
    })
    .select()
    .single();
  if (batchError) throw dbError(batchError);

  const samplesById = new Map<string, ETongueMeasurementRecord>();
  input.eTongueData.forEach(sample => samplesById.set(sample.sampleId, sample));
  Object.keys(input.gcmsData).forEach(sampleId => {
    if (!samplesById.has(sampleId)) samplesById.set(sampleId, { sampleId, type: foodType.slug, sourness: 0, bitterness: 0, saltiness: 0, umami: 0, sweetness: 0 });
  });
  Object.keys(input.compositionData).forEach(sampleId => {
    if (!samplesById.has(sampleId)) samplesById.set(sampleId, { sampleId, type: foodType.slug, sourness: 0, bitterness: 0, saltiness: 0, umami: 0, sweetness: 0 });
  });

  const sampleRows = [...samplesById.values()].map(sample => ({
    import_batch_id: batch.id,
    food_type_id: foodType.id,
    sample_id: sample.sampleId,
    sample_name: sample.sampleName ?? null,
    category: sample.category ?? foodType.label,
  }));

  const { data: insertedSamples, error: sampleError } = await supabase
    .from('instrumental_samples')
    .insert(sampleRows)
    .select('id, sample_id');
  if (sampleError) throw dbError(sampleError);

  const sampleRowIds = new Map((insertedSamples ?? []).map(row => [row.sample_id as string, row.id as string]));
  const eTongueRows = input.eTongueData.map(sample => ({
    sample_id: sampleRowIds.get(sample.sampleId),
    sourness: sample.sourness,
    bitterness: sample.bitterness,
    saltiness: sample.saltiness,
    umami: sample.umami,
    sweetness: sample.sweetness,
  })).filter(row => row.sample_id);
  if (eTongueRows.length > 0) {
    const { error } = await supabase.from('e_tongue_measurements').insert(eTongueRows);
    if (error) throw dbError(error);
  }

  const gcmsRows = Object.entries(input.gcmsData).flatMap(([sampleId, compounds]) =>
    compounds.map(compound => ({
      sample_id: sampleRowIds.get(sampleId),
      name: compound.name,
      concentration: compound.concentration,
      aroma: compound.aroma,
      threshold: compound.threshold,
    }))
  ).filter(row => row.sample_id);
  if (gcmsRows.length > 0) {
    const { error } = await supabase.from('gcms_compounds').insert(gcmsRows);
    if (error) throw dbError(error);
  }

  const compositionRows = Object.entries(input.compositionData).map(([sampleId, composition]) => ({
    sample_id: sampleRowIds.get(sampleId),
    protein: composition.protein,
    fat: composition.fat,
    moisture: composition.moisture,
    ph: composition.pH,
    salt_content: composition.saltContent,
    calcium_mg: composition.calciumMg,
  })).filter(row => row.sample_id);
  if (compositionRows.length > 0) {
    const { error } = await supabase.from('composition_profiles').insert(compositionRows);
    if (error) throw dbError(error);
  }

  await supabase.from('audit_events').insert({
    actor_id: input.importedBy ?? null,
    event_type: 'instrumental_import_created',
    entity_type: 'import_batches',
    entity_id: batch.id,
    metadata: {
      foodType: foodType.slug,
      fileName: input.fileName,
      rowCount: input.rowCount,
      sampleCount: sampleRows.length,
    },
  });

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
