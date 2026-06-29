import { supabase } from '../supabase';
import { dbError } from './shared';

export interface GeneratedPanelistKit {
  id: string;
  token: string;
  kitCode: string;
  manualCode: string | null;
  sampleCode: string | null;
  productId: string;
  assignedProductIds: string[];
  status: PanelistKitStatus;
  expiresAt: string | null;
  responseDeadline: string | null;
  handlingInstructions: string;
  recipientName: string | null;
  recipientEmail: string | null;
  createdAt: string;
}

export type PanelistKitStatus = 'generated' | 'printed' | 'packed' | 'shipped' | 'claimed' | 'started' | 'submitted' | 'expired' | 'void';

export interface PanelistKitRecord {
  id: string;
  kitCode: string;
  manualCode: string | null;
  sampleCode: string | null;
  productId: string;
  assignedProductIds: string[];
  assignedProductCount: number;
  completedProductCount: number;
  productName: string;
  calculatedStatus: PanelistKitStatus;
  storedStatus: PanelistKitStatus;
  expiresAt: string | null;
  responseDeadline: string | null;
  handlingInstructions: string;
  recipientName: string | null;
  recipientEmail: string | null;
  printedAt: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  trackingNumber: string | null;
  issueType: string | null;
  issueNote: string | null;
  issueStatus: 'none' | 'open' | 'reviewed' | 'resolved';
  issueReportedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  replacementForKitId: string | null;
  claimedBy: string | null;
  claimedPanelistName: string | null;
  claimedAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  reminderCount: number;
  createdAt: string;
}

export interface PanelistKitInvite {
  id: string;
  orgId: string;
  productId: string;
  assignedProductIds: string[];
  assignedProductCount: number;
  productName: string;
  productCategory: string;
  isMultiSample: boolean;
  sampleCode: string | null;
  kitCode: string;
  manualCode: string | null;
  calculatedStatus: PanelistKitStatus;
  expiresAt: string | null;
  responseDeadline: string | null;
  handlingInstructions: string;
  issueType: string | null;
  issueNote: string | null;
  issueStatus: 'none' | 'open' | 'reviewed' | 'resolved';
  claimedBy: string | null;
}

export interface PanelistKitEvent {
  id: string;
  kitId: string;
  eventType: string;
  actorId: string | null;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface KitRow {
  id: string;
  token?: string;
  kit_code: string;
  manual_code?: string | null;
  sample_code: string | null;
  product_id: string;
  assigned_product_ids?: string[] | null;
  assigned_product_count?: number | string | null;
  completed_product_count?: number | string | null;
  product_name?: string;
  product_category?: string;
  is_multi_sample?: boolean;
  calculated_status?: string;
  stored_status?: string;
  status?: string;
  expires_at: string | null;
  response_deadline: string | null;
  handling_instructions: string | null;
  recipient_name?: string | null;
  recipient_email?: string | null;
  printed_at?: string | null;
  packed_at?: string | null;
  shipped_at?: string | null;
  tracking_number?: string | null;
  issue_type?: string | null;
  issue_note?: string | null;
  issue_status?: string | null;
  issue_reported_at?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  replacement_for_kit_id?: string | null;
  claimed_by?: string | null;
  claimed_panelist_name?: string | null;
  claimed_at?: string | null;
  started_at?: string | null;
  submitted_at?: string | null;
  reminder_count?: number | string | null;
  created_at?: string;
  org_id?: string;
}

interface KitEventRow {
  id: string;
  kit_id: string;
  event_type: string;
  actor_id: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

type RpcResult<T> = Promise<{ data: T | null; error: { message?: string; code?: string } | null }>;
type UntypedRpc = <T>(fn: string, args?: Record<string, unknown>) => RpcResult<T>;

function rpc<T>(fn: string, args?: Record<string, unknown>): RpcResult<T> {
  return (supabase.rpc as unknown as UntypedRpc)(fn, args);
}

function isMissingAssignedProductsRpc(error: { message?: string; code?: string } | null) {
  const message = error?.message ?? '';
  return /generate_panelist_kits|schema cache|could not find the function|p_assigned_product_ids/i.test(message)
    && /p_assigned_product_ids/i.test(message);
}

function toGeneratedKit(row: KitRow): GeneratedPanelistKit {
  return {
    id: row.id,
    token: row.token ?? '',
    kitCode: row.kit_code,
    manualCode: row.manual_code ?? null,
    sampleCode: row.sample_code,
    productId: row.product_id,
    assignedProductIds: row.assigned_product_ids ?? [row.product_id],
    status: (row.status ?? row.calculated_status ?? 'generated') as PanelistKitStatus,
    expiresAt: row.expires_at,
    responseDeadline: row.response_deadline,
    handlingInstructions: row.handling_instructions ?? '',
    recipientName: row.recipient_name ?? null,
    recipientEmail: row.recipient_email ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function toKitRecord(row: KitRow): PanelistKitRecord {
  return {
    id: row.id,
    kitCode: row.kit_code,
    manualCode: row.manual_code ?? null,
    sampleCode: row.sample_code,
    productId: row.product_id,
    assignedProductIds: row.assigned_product_ids ?? [row.product_id],
    assignedProductCount: Number(row.assigned_product_count ?? row.assigned_product_ids?.length ?? 1),
    completedProductCount: Number(row.completed_product_count ?? 0),
    productName: row.product_name ?? 'Unknown study',
    calculatedStatus: (row.calculated_status ?? row.status ?? 'generated') as PanelistKitStatus,
    storedStatus: (row.stored_status ?? row.status ?? 'generated') as PanelistKitStatus,
    expiresAt: row.expires_at,
    responseDeadline: row.response_deadline,
    handlingInstructions: row.handling_instructions ?? '',
    recipientName: row.recipient_name ?? null,
    recipientEmail: row.recipient_email ?? null,
    printedAt: row.printed_at ?? null,
    packedAt: row.packed_at ?? null,
    shippedAt: row.shipped_at ?? null,
    trackingNumber: row.tracking_number ?? null,
    issueType: row.issue_type ?? null,
    issueNote: row.issue_note ?? null,
    issueStatus: (row.issue_status ?? 'none') as PanelistKitRecord['issueStatus'],
    issueReportedAt: row.issue_reported_at ?? null,
    voidedAt: row.voided_at ?? null,
    voidReason: row.void_reason ?? null,
    replacementForKitId: row.replacement_for_kit_id ?? null,
    claimedBy: row.claimed_by ?? null,
    claimedPanelistName: row.claimed_panelist_name ?? null,
    claimedAt: row.claimed_at ?? null,
    startedAt: row.started_at ?? null,
    submittedAt: row.submitted_at ?? null,
    reminderCount: Number(row.reminder_count ?? 0),
    createdAt: row.created_at ?? '',
  };
}

function toInvite(row: KitRow): PanelistKitInvite {
  return {
    id: row.id,
    orgId: row.org_id ?? '',
    productId: row.product_id,
    productName: row.product_name ?? 'Tasting study',
    productCategory: row.product_category ?? '',
    isMultiSample: Boolean(row.is_multi_sample),
    sampleCode: row.sample_code,
    kitCode: row.kit_code,
    manualCode: row.manual_code ?? null,
    assignedProductIds: row.assigned_product_ids ?? [row.product_id],
    assignedProductCount: Number(row.assigned_product_count ?? row.assigned_product_ids?.length ?? 1),
    calculatedStatus: (row.calculated_status ?? row.status ?? 'generated') as PanelistKitStatus,
    expiresAt: row.expires_at,
    responseDeadline: row.response_deadline,
    handlingInstructions: row.handling_instructions ?? '',
    issueType: row.issue_type ?? null,
    issueNote: row.issue_note ?? null,
    issueStatus: (row.issue_status ?? 'none') as PanelistKitInvite['issueStatus'],
    claimedBy: row.claimed_by ?? null,
  };
}

function toKitEvent(row: KitEventRow): PanelistKitEvent {
  return {
    id: row.id,
    kitId: row.kit_id,
    eventType: row.event_type,
    actorId: row.actor_id,
    actorName: row.actor_name,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export async function generatePanelistKits(input: {
  productId: string;
  kitCount: number;
  expiresAt?: string | null;
  responseDeadline?: string | null;
  handlingInstructions?: string;
  recipients?: Array<{ name: string; email?: string }>;
  assignedProductIds?: string[];
}): Promise<GeneratedPanelistKit[]> {
  const assignedProductIds = input.assignedProductIds?.length ? input.assignedProductIds : [input.productId];
  const baseArgs = {
    target_product_id: input.productId,
    kit_count: input.kitCount,
    p_expires_at: input.expiresAt ?? null,
    p_response_deadline: input.responseDeadline ?? null,
    p_handling_instructions: input.handlingInstructions ?? '',
    p_recipients: input.recipients ?? [],
  };
  const { data, error } = await rpc<KitRow[]>('generate_panelist_kits', {
    ...baseArgs,
    p_assigned_product_ids: assignedProductIds,
  });
  if (error && isMissingAssignedProductsRpc(error)) {
    if (assignedProductIds.length > 1) {
      throw new Error('The database is missing the box-pass migration needed for one QR to assign multiple tasting tasks. Apply the latest panelist box migration, then reload the Supabase API schema cache.');
    }
    const fallback = await rpc<KitRow[]>('generate_panelist_kits', baseArgs);
    if (fallback.error) throw dbError(fallback.error);
    return (fallback.data ?? []).map(toGeneratedKit);
  }
  if (error) throw dbError(error);
  return (data ?? []).map(toGeneratedKit);
}

export async function fetchPanelistKits(productId: string): Promise<PanelistKitRecord[]> {
  const { data, error } = await rpc<KitRow[]>('list_panelist_kits', {
    target_product_id: productId,
  });
  if (error) {
    if (/list_panelist_kits|schema cache|does not exist/i.test(error.message ?? '')) return [];
    throw dbError(error);
  }
  return (data ?? []).map(toKitRecord);
}

export async function fetchPanelistKitInvite(token: string): Promise<PanelistKitInvite | null> {
  const { data, error } = await rpc<KitRow[]>('get_panelist_kit_by_token', {
    p_token: token,
  });
  if (error) {
    if (/get_panelist_kit_by_token|schema cache|does not exist/i.test(error.message ?? '')) return null;
    throw dbError(error);
  }
  return data?.[0] ? toInvite(data[0]) : null;
}

export async function fetchPanelistKitInviteByManualCode(code: string): Promise<PanelistKitInvite | null> {
  const { data, error } = await rpc<KitRow[]>('get_panelist_kit_by_manual_code', {
    p_manual_code: code,
  });
  if (error) {
    if (/get_panelist_kit_by_manual_code|schema cache|does not exist/i.test(error.message ?? '')) return null;
    throw dbError(error);
  }
  return data?.[0] ? toInvite(data[0]) : null;
}

export async function claimPanelistKit(input: { token?: string | null; manualCode?: string | null }): Promise<PanelistKitInvite> {
  const { data, error } = await rpc<KitRow[]>('claim_panelist_kit', {
    p_token: input.token ?? null,
    p_manual_code: input.manualCode ?? null,
  });
  if (error) throw dbError(error);
  if (!data?.[0]) throw new Error('Unable to claim this kit.');
  return toInvite(data[0]);
}

export async function markPanelistKitStarted(input: { token?: string | null; manualCode?: string | null }): Promise<void> {
  const { error } = await rpc<null>('mark_panelist_kit_started', {
    p_token: input.token ?? null,
    p_manual_code: input.manualCode ?? null,
  });
  if (error) throw dbError(error);
}

export async function markPanelistKitSubmitted(input: { token?: string | null; manualCode?: string | null }): Promise<void> {
  const { error } = await rpc<null>('mark_panelist_kit_submitted', {
    p_token: input.token ?? null,
    p_manual_code: input.manualCode ?? null,
  });
  if (error) throw dbError(error);
}

export async function updatePanelistKitFulfillment(input: {
  kitId: string;
  status: 'printed' | 'packed' | 'shipped';
  trackingNumber?: string | null;
}): Promise<void> {
  const { error } = await rpc<null>('update_panelist_kit_fulfillment', {
    target_kit_id: input.kitId,
    p_status: input.status,
    p_tracking_number: input.trackingNumber ?? null,
  });
  if (error) throw dbError(error);
}

export async function reportPanelistKitIssue(input: {
  token?: string | null;
  manualCode?: string | null;
  issueType: string;
  issueNote?: string;
}): Promise<void> {
  const { error } = await rpc<null>('report_panelist_kit_issue', {
    p_token: input.token ?? null,
    p_manual_code: input.manualCode ?? null,
    p_issue_type: input.issueType,
    p_issue_note: input.issueNote ?? '',
  });
  if (error) throw dbError(error);
}

export async function recordPanelistKitReminder(input: {
  kitId: string;
  reason?: string;
}): Promise<void> {
  const { error } = await rpc<null>('record_panelist_kit_reminder', {
    target_kit_id: input.kitId,
    p_reason: input.reason ?? 'manual',
  });
  if (error) throw dbError(error);
}

export async function voidPanelistKit(input: {
  kitId: string;
  reason?: string;
}): Promise<void> {
  const { error } = await rpc<null>('void_panelist_kit', {
    target_kit_id: input.kitId,
    p_reason: input.reason ?? '',
  });
  if (error) throw dbError(error);
}

export async function createReplacementPanelistKit(input: {
  kitId: string;
  reason?: string;
}): Promise<GeneratedPanelistKit[]> {
  const { data, error } = await rpc<KitRow[]>('create_replacement_panelist_kit', {
    target_kit_id: input.kitId,
    p_reason: input.reason ?? '',
  });
  if (error) throw dbError(error);
  return (data ?? []).map(toGeneratedKit);
}

export async function fetchPanelistKitEvents(kitId: string): Promise<PanelistKitEvent[]> {
  const { data, error } = await rpc<KitEventRow[]>('fetch_panelist_kit_events', {
    target_kit_id: kitId,
  });
  if (error) {
    if (/fetch_panelist_kit_events|schema cache|does not exist/i.test(error.message ?? '')) return [];
    throw dbError(error);
  }
  return (data ?? []).map(toKitEvent);
}
