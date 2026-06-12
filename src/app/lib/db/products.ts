import { supabase } from '../supabase';
import type { Product, HedonicReferenceScores } from '../../data/mock-users';
import { dbError } from './shared';

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
