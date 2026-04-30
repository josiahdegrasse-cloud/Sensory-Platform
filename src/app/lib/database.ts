import { supabase } from './supabase';
import type { Product, QuestionnaireResponse } from '../data/mock-users';

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
  };
}

function toResponse(row: Record<string, unknown>): QuestionnaireResponse {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    productId: row.product_id as string,
    timestamp: row.created_at as string,
    cataAttributes: (row.cata_attributes as string[]) || [],
    intensityRatings: (row.intensity_ratings as Record<string, number>) || {},
    hedonicScores: (row.hedonic_scores as QuestionnaireResponse['hedonicScores']) || {
      overall: 5, appearance: 5, aroma: 5, flavor: 5, texture: 5,
    },
    emotionalProfile: (row.emotional_profile as Record<string, number>) || {},
  };
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toProduct);
}

export async function fetchActiveProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toProduct);
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toProduct(data) : null;
}

export async function insertProduct(p: Omit<Product, 'id' | 'createdDate'>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(fromProduct(p))
    .select()
    .single();
  if (error) throw error;
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

  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return toProduct(data);
}

// ─── Responses ────────────────────────────────────────────────────────────────

export async function fetchAllResponses(): Promise<QuestionnaireResponse[]> {
  const { data, error } = await supabase.from('responses').select('*');
  if (error) throw error;
  return (data ?? []).map(toResponse);
}

export async function fetchUserResponses(userId: string): Promise<QuestionnaireResponse[]> {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map(toResponse);
}

export async function fetchUserResponse(
  userId: string,
  productId: string,
): Promise<QuestionnaireResponse | null> {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();
  if (error) throw error;
  return data ? toResponse(data) : null;
}

export async function upsertResponse(
  response: Omit<QuestionnaireResponse, 'id' | 'timestamp'>,
): Promise<QuestionnaireResponse> {
  const { data, error } = await supabase
    .from('responses')
    .upsert(
      {
        user_id: response.userId,
        product_id: response.productId,
        cata_attributes: response.cataAttributes,
        intensity_ratings: response.intensityRatings,
        hedonic_scores: response.hedonicScores,
        emotional_profile: response.emotionalProfile,
      },
      { onConflict: 'user_id,product_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return toResponse(data);
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
  if (error) throw error;
  return (data ?? []).map(toTemplate);
}

export async function insertTemplate(name: string, attributes: string[]): Promise<Template> {
  const { data, error } = await supabase
    .from('templates')
    .insert({ name, attributes })
    .select()
    .single();
  if (error) throw error;
  return toTemplate(data);
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) throw error;
}

// ─── Panelists (admin view) ───────────────────────────────────────────────────

export interface PanelistInfo {
  id: string;
  name: string;
  panelistId: string | null;
  completedCount: number;
}

export async function fetchPanelists(): Promise<PanelistInfo[]> {
  const [{ data: profiles }, { data: responses }] = await Promise.all([
    supabase.from('profiles').select('id, name, panelist_id').eq('role', 'panelist'),
    supabase.from('responses').select('user_id'),
  ]);

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
  }));
}

export async function updatePanelistId(userId: string, panelistId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ panelist_id: panelistId })
    .eq('id', userId);
  if (error) throw error;
}
