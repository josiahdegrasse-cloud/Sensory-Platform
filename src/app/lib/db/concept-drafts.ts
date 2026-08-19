import { supabase } from '../supabase';
import { asJson, dbError, fromJson } from './shared';
import { createConceptImageSignedUrl } from './concepts';
import type { Database, Json } from './database.types';

type DraftRow = Database['public']['Tables']['concept_workspace_drafts']['Row'];

export type ConceptDraftStep = 'concept' | 'survey' | 'panel' | 'review';

export interface ConceptWorkspaceDraftRecord<TPayload extends object = Record<string, unknown>> {
  id: string;
  projectId: string;
  decisionRecordId: string;
  evidenceBundleId: string;
  formulationVersionId: string | null;
  createdBy: string;
  currentStep: ConceptDraftStep;
  payload: TPayload;
  createdAt: string;
  updatedAt: string;
}

function toDraftRecord<TPayload extends object>(row: DraftRow): ConceptWorkspaceDraftRecord<TPayload> {
  return {
    id: row.id,
    projectId: row.project_id,
    decisionRecordId: row.decision_record_id,
    evidenceBundleId: row.evidence_bundle_id,
    formulationVersionId: row.formulation_version_id,
    createdBy: row.created_by,
    currentStep: row.current_step as ConceptDraftStep,
    payload: (fromJson<TPayload>(row.draft_payload) ?? {}) as TPayload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchConceptWorkspaceDraft<TPayload extends object>(input: {
  projectId: string;
  decisionRecordId?: string | null;
}): Promise<ConceptWorkspaceDraftRecord<TPayload> | null> {
  let query = supabase
    .from('concept_workspace_drafts')
    .select('*')
    .eq('project_id', input.projectId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (input.decisionRecordId) query = query.eq('decision_record_id', input.decisionRecordId);
  const { data, error } = await query.maybeSingle();
  if (error) throw dbError(error);
  return data ? toDraftRecord<TPayload>(data) : null;
}

export async function listConceptWorkspaceDrafts<TPayload extends object>(
  projectId: string,
): Promise<ConceptWorkspaceDraftRecord<TPayload>[]> {
  const { data, error } = await supabase
    .from('concept_workspace_drafts')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false });
  if (error) throw dbError(error);
  return (data ?? []).map(row => toDraftRecord<TPayload>(row));
}

export async function saveConceptWorkspaceDraft<TPayload extends object>(input: {
  orgId: string;
  projectId: string;
  decisionRecordId: string;
  evidenceBundleId: string;
  formulationVersionId?: string | null;
  createdBy: string;
  currentStep: ConceptDraftStep;
  payload: TPayload;
}): Promise<ConceptWorkspaceDraftRecord<TPayload>> {
  const { data, error } = await supabase
    .from('concept_workspace_drafts')
    .upsert({
      org_id: input.orgId,
      project_id: input.projectId,
      decision_record_id: input.decisionRecordId,
      evidence_bundle_id: input.evidenceBundleId,
      formulation_version_id: input.formulationVersionId ?? null,
      created_by: input.createdBy,
      current_step: input.currentStep,
      draft_payload: asJson(input.payload) as Json,
    }, { onConflict: 'org_id,project_id,decision_record_id' })
    .select()
    .single();
  if (error) throw dbError(error);
  return toDraftRecord<TPayload>(data);
}

export async function deleteConceptWorkspaceDraft(id: string): Promise<void> {
  const { error } = await supabase.from('concept_workspace_drafts').delete().eq('id', id);
  if (error) throw dbError(error);
}

/** Refreshes expiring signed URLs from authoritative concept image ids. */
export async function hydrateConceptWorkspaceImageUrls(
  imageIds: string[],
  fallbackUrls: string[],
): Promise<string[]> {
  if (imageIds.length === 0) return fallbackUrls;
  const { data, error } = await supabase
    .from('concept_images')
    .select('id, storage_path, image_url, sort_order')
    .in('id', imageIds);
  if (error) throw dbError(error);
  const byId = new Map((data ?? []).map(row => [row.id, row]));
  return Promise.all(imageIds.map(async (id, index) => {
    const row = byId.get(id);
    if (!row) return fallbackUrls[index] ?? '';
    return createConceptImageSignedUrl(row.storage_path, row.image_url ?? fallbackUrls[index] ?? '');
  }));
}
