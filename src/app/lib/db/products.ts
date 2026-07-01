import { supabase } from '../supabase';
import type { Product, HedonicReferenceScores } from '../study-types';
import { asJson, dbError, fromJson } from './shared';
import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
type ProductRow = Tables['products']['Row'] & {
  blinded?: boolean | null;
  blind_code?: string | null;
};
type ProductInsert = Tables['products']['Insert'] & {
  blinded?: boolean;
  blind_code?: string | null;
};
type ProductUpdate = Tables['products']['Update'] & {
  blinded?: boolean;
  blind_code?: string | null;
};

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    createdDate: row.created_at as string,
    status: row.status as Product['status'],
    customAttributes: (row.custom_attributes as string[] | null) ?? undefined,
    isMultiSample: row.is_multi_sample ?? false,
    samples: fromJson<Product['samples']>(row.samples) ?? undefined,
    isCalibration: row.is_calibration ?? false,
    referenceScores: fromJson<HedonicReferenceScores>(row.reference_scores) ?? null,
    blinded: row.blinded ?? false,
    blindCode: row.blind_code ?? null,
    assignedPanelistIds: row.assigned_panelist_ids ?? [],
    projectId: row.project_id ?? null,
    sourceImportBatchId: row.source_import_batch_id ?? null,
    sourceSampleId: row.source_sample_id ?? null,
  };
}

function fromProduct(p: Omit<Product, 'id' | 'createdDate'>): ProductInsert {
  return {
    name: p.name,
    category: p.category,
    status: p.status,
    custom_attributes: p.customAttributes ?? null,
    is_multi_sample: p.isMultiSample ?? false,
    samples: asJson(p.samples ?? null),
    is_calibration: p.isCalibration ?? false,
    reference_scores: asJson(p.referenceScores ?? null),
    blinded: p.blinded ?? false,
    blind_code: p.blindCode ?? null,
    assigned_panelist_ids: p.assignedPanelistIds ?? [],
    project_id: p.projectId ?? null,
    source_import_batch_id: p.sourceImportBatchId ?? null,
    source_sample_id: p.sourceSampleId ?? null,
  };
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
    .insert(fromProduct(p) as Tables['products']['Insert'])
    .select()
    .single();
  if (error) throw dbError(error);
  return toProduct(data);
}

export async function updateProduct(
  id: string,
  updates: Partial<Omit<Product, 'id' | 'createdDate'>>,
): Promise<Product> {
  const patch: ProductUpdate = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.category !== undefined) patch.category = updates.category;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.customAttributes !== undefined) patch.custom_attributes = updates.customAttributes;
  if (updates.isMultiSample !== undefined) patch.is_multi_sample = updates.isMultiSample;
  if (updates.samples !== undefined) patch.samples = asJson(updates.samples);
  if (updates.isCalibration !== undefined) patch.is_calibration = updates.isCalibration;
  if (updates.referenceScores !== undefined) patch.reference_scores = asJson(updates.referenceScores);
  if (updates.blinded !== undefined) patch.blinded = updates.blinded;
  if (updates.blindCode !== undefined) patch.blind_code = updates.blindCode;
  if (updates.assignedPanelistIds !== undefined) patch.assigned_panelist_ids = updates.assignedPanelistIds;
  if (updates.projectId !== undefined) patch.project_id = updates.projectId;
  if (updates.sourceImportBatchId !== undefined) patch.source_import_batch_id = updates.sourceImportBatchId;
  if (updates.sourceSampleId !== undefined) patch.source_sample_id = updates.sourceSampleId;

  const { data, error } = await supabase
    .from('products')
    .update(patch as Tables['products']['Update'])
    .eq('id', id)
    .select()
    .single();
  if (error) throw dbError(error);
  return toProduct(data);
}

export async function updateProductAssignments(
  productIds: string[],
  assignedPanelistIds: string[],
): Promise<Product[]> {
  if (productIds.length === 0) return [];
  const { data, error } = await supabase
    .from('products')
    .update({ assigned_panelist_ids: assignedPanelistIds })
    .in('id', productIds)
    .select();
  if (error) throw dbError(error);
  return (data ?? []).map(toProduct);
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw dbError(error);
}
