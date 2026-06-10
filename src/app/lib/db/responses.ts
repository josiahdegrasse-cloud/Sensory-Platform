import { supabase } from '../supabase';
import type { QuestionnaireResponse } from '../../data/mock-users';
import { dbError } from './shared';

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
