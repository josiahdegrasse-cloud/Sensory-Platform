import { supabase } from '../supabase';
import type { TrainingLevel } from '../../utils/panelist-metrics';
import { dbError, edgeFunctionErrorMessage, insertAuditEvent } from './shared';

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
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  profileCompletedAt: string | null;
}

export function panelistShippingAddress(panelist: Pick<PanelistInfo, 'addressLine1' | 'addressLine2' | 'city' | 'region' | 'postalCode' | 'country'>): string {
  return [
    panelist.addressLine1,
    panelist.addressLine2,
    [panelist.city, panelist.region].filter(Boolean).join(', '),
    panelist.postalCode,
    panelist.country,
  ].filter(Boolean).join('\n');
}

export async function fetchPanelists(): Promise<PanelistInfo[]> {
  const [profilesResult, { data: responses }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, panelist_id, training_level, status, consent_accepted_at, consent_version, phone, address_line_1, address_line_2, city, region, postal_code, country, profile_completed_at')
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
    phone: (p.phone as string) ?? null,
    addressLine1: (p.address_line_1 as string) ?? null,
    addressLine2: (p.address_line_2 as string) ?? null,
    city: (p.city as string) ?? null,
    region: (p.region as string) ?? null,
    postalCode: (p.postal_code as string) ?? null,
    country: (p.country as string) ?? null,
    profileCompletedAt: (p.profile_completed_at as string) ?? null,
  }));
}

export async function invitePanelistAccount(email: string, redirectTo: string): Promise<void> {
  const { error } = await supabase.functions.invoke('invite-panelist', {
    body: { email: email.trim().toLowerCase(), redirectTo },
  });
  if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Unable to send the panelist invitation.'));
}

export async function completePanelistProfile(input: {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string;
  consentVersion: string;
  consentUserAgent?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('complete_panelist_profile', {
    p_name: input.name,
    p_phone: input.phone,
    p_address_line_1: input.addressLine1,
    p_address_line_2: input.addressLine2 ?? '',
    p_city: input.city,
    p_region: input.region ?? '',
    p_postal_code: input.postalCode,
    p_country: input.country,
    p_consent_version: input.consentVersion,
    ...(input.consentUserAgent ? { p_consent_user_agent: input.consentUserAgent } : {}),
  });
  if (error) throw dbError(error);
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
