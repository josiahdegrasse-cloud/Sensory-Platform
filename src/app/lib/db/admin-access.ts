import { supabase } from '../supabase';
import { dbError } from './shared';

export type AdminAccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AdminAccessRequestRecord {
  id: string;
  orgId: string;
  requesterId: string;
  requesterEmail: string;
  requesterName: string;
  status: AdminAccessRequestStatus;
  requestedAt: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string;
}

function toAdminAccessRequest(row: Record<string, unknown>): AdminAccessRequestRecord {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    requesterId: row.requester_id as string,
    requesterEmail: row.requester_email as string,
    requesterName: (row.requester_name as string) ?? '',
    status: row.status as AdminAccessRequestStatus,
    requestedAt: row.requested_at as string,
    resolvedBy: (row.resolved_by as string) ?? null,
    resolvedAt: (row.resolved_at as string) ?? null,
    resolutionNote: (row.resolution_note as string) ?? '',
  };
}

export async function requestAdminAccess(): Promise<AdminAccessRequestRecord | null> {
  const { error } = await supabase.rpc('request_admin_access');
  if (error) throw dbError(error);
  return fetchMyAdminAccessRequest();
}

export async function fetchMyAdminAccessRequest(): Promise<AdminAccessRequestRecord | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('admin_access_requests')
    .select('*')
    .eq('requester_id', userId)
    .maybeSingle();
  if (error) {
    if (/admin_access_requests|schema cache|does not exist/i.test(error.message ?? '')) return null;
    throw dbError(error);
  }
  return data ? toAdminAccessRequest(data as Record<string, unknown>) : null;
}

export async function fetchAdminAccessRequests(): Promise<AdminAccessRequestRecord[]> {
  const { data, error } = await supabase
    .from('admin_access_requests')
    .select('*')
    .order('requested_at', { ascending: false });
  if (error) {
    if (/admin_access_requests|schema cache|does not exist/i.test(error.message ?? '')) return [];
    throw dbError(error);
  }
  return (data ?? []).map(row => toAdminAccessRequest(row as Record<string, unknown>));
}

export async function resolveAdminAccessRequest(input: {
  requestId: string;
  decision: 'approved' | 'rejected';
  note?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('resolve_admin_access_request', {
    target_request_id: input.requestId,
    decision: input.decision,
    note: input.note ?? '',
  });
  if (error) throw dbError(error);
}
