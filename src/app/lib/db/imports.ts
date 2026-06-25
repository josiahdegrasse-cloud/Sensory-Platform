import { supabase } from '../supabase';
import type { FoodTypeDetection } from '../food-intelligence';
import {
  formatFoodTypeLabel,
  getDefaultCataAttributesForFoodType,
  getDefaultIntensityAttributesForFoodType,
  slugifyFoodType,
} from '../food-intelligence';
import { dbError, isMissingFoodImportSchema } from './shared';

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
  /** Set when this import is a retest/reformulation; describes what changed. */
  reformulationNotes?: string | null;
}

const DEMO_RESPONSE_FOOD_TYPES = new Set(['bread', 'cheese']);

const POSITIVE_EMOTIONS = [
  'Happy', 'Satisfied', 'Pleasant', 'Delighted', 'Interested', 'Curious',
  'Enthusiastic', 'Calm', 'Comfortable', 'Good',
];

const NEGATIVE_EMOTIONS = ['Disgusted', 'Bored', 'Disappointed', 'Worried', 'Tame', 'Uninterested'];

function buildDemoResponsePayload(input: {
  userId: string;
  productId: string;
  foodType: string;
  index: number;
  runNumber: number;
  productName: string;
}) {
  const cataOptions = getDefaultCataAttributesForFoodType(input.foodType);
  const intensityOptions = getDefaultIntensityAttributesForFoodType(input.foodType);
  const selectedCata = cataOptions.filter((_, index) => index < 5 || (index + input.index) % 4 === 0).slice(0, 8);
  const variation = (input.index % 5) - 2;
  const baseScore = input.foodType === 'bread' ? 7.2 : 7.4;
  return {
    user_id: input.userId,
    product_id: input.productId,
    run_number: input.runNumber,
    cata_attributes: selectedCata,
    intensity_ratings: Object.fromEntries(
      intensityOptions.slice(0, 8).map((attribute, attrIndex) => [
        attribute,
        Math.max(1, Math.min(5, 3.7 + ((input.index + attrIndex) % 3) * 0.3 + variation * 0.08)),
      ]),
    ),
    hedonic_scores: {
      overall: baseScore + variation * 0.18,
      appearance: baseScore + 0.2 + variation * 0.14,
      aroma: baseScore - 0.1 + variation * 0.16,
      flavor: baseScore + variation * 0.2,
      texture: baseScore + 0.1 + variation * 0.16,
    },
    emotional_profile: {
      ...Object.fromEntries(POSITIVE_EMOTIONS.map(emotion => [emotion, 4])),
      ...Object.fromEntries(NEGATIVE_EMOTIONS.map(emotion => [emotion, 1])),
    },
    comments: [
      `${input.productName} has a strong first impression and clear category fit.`,
      'Panelists noted balanced flavor and a clean finish.',
      'Texture and aroma cues feel ready for the next review stage.',
      'A little refinement could improve differentiation, but the baseline is strong.',
    ][input.index % 4],
  };
}

async function seedDemoResponsesForImport(input: {
  batchId: string;
  foodType: string;
  userId?: string | null;
}) {
  if (!input.userId || !DEMO_RESPONSE_FOOD_TYPES.has(input.foodType)) return;

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name')
    .eq('source_import_batch_id', input.batchId)
    .eq('status', 'active');
  if (productsError) throw dbError(productsError);
  if (!products?.length) return;

  const productIds = products.map(product => product.id as string);
  const { data: existing, error: existingError } = await supabase
    .from('responses')
    .select('product_id, run_number')
    .eq('user_id', input.userId)
    .in('product_id', productIds);
  if (existingError) throw dbError(existingError);

  const existingRunsByProduct = new Map<string, number[]>();
  (existing ?? []).forEach(row => {
    const productId = row.product_id as string;
    const runs = existingRunsByProduct.get(productId) ?? [];
    runs.push(Number(row.run_number ?? 0));
    existingRunsByProduct.set(productId, runs);
  });

  const rows = products.flatMap(product => {
    const productId = product.id as string;
    const existingRuns = existingRunsByProduct.get(productId) ?? [];
    if (existingRuns.length >= 12) return [];
    const nextRun = Math.max(0, ...existingRuns) + 1;
    return Array.from({ length: 12 - existingRuns.length }, (_, index) =>
      buildDemoResponsePayload({
        userId: input.userId!,
        productId,
        foodType: input.foodType,
        index,
        runNumber: nextRun + index,
        productName: product.name as string,
      })
    );
  });

  if (rows.length === 0) return;
  const { error } = await supabase.from('responses').insert(rows);
  if (error) throw dbError(error);
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
  if (error && isMissingFoodTypeStatusTarget(error)) return;
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
  if (error && isMissingFoodTypeStatusTarget(error)) return;
  if (error) throw dbError(error);
}

function isMissingFoodTypeStatusTarget(error: { message?: string; code?: string }) {
  const message = error.message ?? '';
  return /food type not found/i.test(message);
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

export async function updateImportBatchName(id: string, fileName: string): Promise<void> {
  const trimmed = fileName.trim();
  if (!trimmed) throw new Error('Project name is required.');
  const { error } = await supabase
    .from('import_batches')
    .update({ file_name: trimmed })
    .eq('id', id);
  if (error) throw dbError(error);
}

// Permanently removes an import batch (and its products + samples). Unlike the
// 'deleted' status above (soft, restorable), this cannot be undone.
export async function deleteImportBatch(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_import_batch', { target_batch_id: id });
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
  /** What changed in this reformulation vs. the prior version (from TweakPrescription). */
  reformulationNotes?: string | null;
  /** The real project this batch belongs to, if any (null = legacy/unassigned batch). */
  projectId?: string | null;
  /** The real project's display name, when this batch is linked to one. */
  projectName?: string | null;
}

export async function fetchImportBatches(): Promise<ImportBatchRecord[]> {
  const richResult = await supabase
    .from('import_batches')
    .select(`
      id, file_name, row_count, recognized_columns, ignored_columns,
      detection_confidence, status, imported_by, imported_at, project_id,
      food_types(slug, label),
      projects(name),
      profiles(name),
      instrumental_samples(count)
    `)
    .order('imported_at', { ascending: false })
    .limit(100);

  let rows = richResult.data as Record<string, unknown>[] | null;
  if (richResult.error) {
    const fallbackResult = await supabase
      .from('import_batches')
      .select(`
        id, file_name, row_count, recognized_columns, ignored_columns,
        detection_confidence, status, imported_by, imported_at,
        food_types(slug, label)
      `)
      .order('imported_at', { ascending: false })
      .limit(100);

    if (fallbackResult.error && isMissingFoodImportSchema(dbError(fallbackResult.error))) return [];
    if (fallbackResult.error) throw dbError(fallbackResult.error);
    rows = fallbackResult.data as Record<string, unknown>[] | null;
  }

  return (rows ?? []).map(row => {
    const ft = row.food_types as { slug?: string; label?: string } | null;
    const profile = row.profiles as { name?: string } | null;
    const countArr = row.instrumental_samples as { count?: number }[] | null;
    const project = row.projects as { name?: string } | null;
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
      createdAt: row.imported_at as string,
      sampleCount: countArr?.[0]?.count ?? Number(row.row_count ?? 0),
      reformulationNotes: (row.reformulation_notes as string) ?? null,
      projectId: (row.project_id as string) ?? null,
      projectName: project?.name ?? null,
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

    const compositionRaw = row.composition_profiles as Record<string, unknown>[] | Record<string, unknown> | null;
    const composition = Array.isArray(compositionRaw) ? compositionRaw[0] : compositionRaw;
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
  const { data: batchId, error } = await supabase.rpc('create_instrumental_import', {
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
  if (typeof batchId === 'string') {
    if (input.reformulationNotes) {
      await supabase
        .from('import_batches')
        .update({ reformulation_notes: input.reformulationNotes })
        .eq('id', batchId);
    }
    await seedDemoResponsesForImport({
      batchId,
      foodType: slugifyFoodType(input.detection.slug),
      userId: input.importedBy,
    });
  }

  return fetchInstrumentalDataset();
}
