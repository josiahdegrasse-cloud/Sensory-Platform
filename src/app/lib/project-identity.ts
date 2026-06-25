import type { SupabaseClient } from '@supabase/supabase-js';
import { formatFoodTypeLabel } from './food-intelligence';

/**
 * Canonical "what project am I looking at" value. The single source of truth that
 * replaces the duplicated `subCategory.startsWith('batch:')` parsing scattered
 * across main-layout, project-header, and stage4-enhanced (see
 * PROJECT_IDENTITY_DISCOVERY.md §C2), reconciled with the /project/:batchId route.
 */
export type ProjectIdentity = {
  /** null = no real project yet (legacy/dead batch, or nothing selected). */
  projectId: string | null;
  /** Always populated — falls back to the computed batch/food-type label. */
  projectName: string;
  foodTypeId: string | null;
  foodTypeSlug: string;
  /** The batch currently in scope, if any. */
  activeBatchId: string | null;
  status: 'active' | 'archived' | 'deleted' | 'unassigned';
};

const NO_SELECTION_NAME = 'No project selected';
const UNASSIGNED_NAME = 'No project assigned';

/**
 * The one parser for the FoodTypeContext `subCategory` selection string. Replaces
 * every inline `subCategory?.startsWith('batch:') ? subCategory.replace('batch:','') : null`.
 */
export function parseBatchSelection(subCategory: string | null | undefined): string | null {
  if (!subCategory?.startsWith('batch:')) return null;
  return subCategory.slice('batch:'.length) || null;
}

export function encodeBatchSelection(batchId: string): string {
  return `batch:${batchId}`;
}

/**
 * Shared fallback name for a batch with no real project — identical to the legacy
 * pickProjectName() behaviour so unassigned batches read the same as they always
 * did: the batch file name (sans .csv), or "{FoodType} Project" when unknown.
 */
export function computeFallbackProjectName(
  fileName: string | null | undefined,
  foodTypeSlug: string | null | undefined,
): string {
  const trimmed = fileName?.trim();
  if (trimmed) return trimmed.replace(/\.csv$/i, '');
  if (foodTypeSlug) return `${formatFoodTypeLabel(foodTypeSlug)} Project`;
  return UNASSIGNED_NAME;
}

type ProjectRow = {
  id: string;
  name: string;
  status: ProjectIdentity['status'];
  food_type_id: string | null;
  food_types: { slug?: string } | { slug?: string }[] | null;
};

type BatchRow = {
  id: string;
  project_id: string | null;
  file_name: string | null;
  status: string | null;
  food_type_id: string | null;
  food_types: { slug?: string } | { slug?: string }[] | null;
};

/** PostgREST embeds can come back as an object or a single-element array. */
function embeddedSlug(food_types: ProjectRow['food_types']): string {
  if (!food_types) return '';
  const ft = Array.isArray(food_types) ? food_types[0] : food_types;
  return ft?.slug ?? '';
}

async function fetchProjectRow(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectRow | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, status, food_type_id, food_types(slug)')
    .eq('id', projectId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ProjectRow;
}

async function fetchMostRecentBatchId(
  supabase: SupabaseClient,
  projectId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('import_batches')
    .select('id')
    .eq('project_id', projectId)
    .order('imported_at', { ascending: false })
    .limit(1);
  if (error || !data) return null;
  const rows = data as { id: string }[];
  return rows[0]?.id ?? null;
}

async function fetchBatchRow(
  supabase: SupabaseClient,
  batchId: string,
): Promise<BatchRow | null> {
  const { data, error } = await supabase
    .from('import_batches')
    .select('id, project_id, file_name, status, food_type_id, food_types(slug)')
    .eq('id', batchId)
    .maybeSingle();
  if (error || !data) return null;
  return data as BatchRow;
}

function identityFromProject(project: ProjectRow, activeBatchId: string | null): ProjectIdentity {
  return {
    projectId: project.id,
    projectName: project.name,
    foodTypeId: project.food_type_id ?? null,
    foodTypeSlug: embeddedSlug(project.food_types),
    activeBatchId,
    status: project.status,
  };
}

function unassignedIdentity(batch: BatchRow | null): ProjectIdentity {
  const foodTypeSlug = embeddedSlug(batch?.food_types ?? null);
  return {
    projectId: null,
    projectName: batch
      ? computeFallbackProjectName(batch.file_name, foodTypeSlug)
      : NO_SELECTION_NAME,
    foodTypeId: batch?.food_type_id ?? null,
    foodTypeSlug,
    activeBatchId: batch?.id ?? null,
    status: 'unassigned',
  };
}

/**
 * Resolve one canonical ProjectIdentity from either a projectId or a batchId.
 *
 * - `projectId` given → load the project, embed its food type, and find its most
 *   recent linked batch for `activeBatchId`.
 * - only `batchId` given → load the batch; if it has a `project_id`, resolve that
 *   project (with this batch as the active one). If not, return an `unassigned`
 *   identity using the legacy pickProjectName fallback — this is the expected,
 *   non-error state for all legacy/dead batches that never became real projects.
 * - nothing resolvable (missing/invalid id, neither given) → a safe `unassigned`
 *   identity. Never throws; NULL/unassigned is a valid, displayable state.
 */
export async function resolveProjectIdentity(
  supabase: SupabaseClient,
  opts: { batchId?: string | null; projectId?: string | null },
): Promise<ProjectIdentity> {
  if (opts.projectId) {
    const project = await fetchProjectRow(supabase, opts.projectId);
    if (project) {
      const activeBatchId = await fetchMostRecentBatchId(supabase, project.id);
      return identityFromProject(project, activeBatchId);
    }
    // projectId given but not found — fall through to batch handling / unassigned.
  }

  if (opts.batchId) {
    const batch = await fetchBatchRow(supabase, opts.batchId);
    if (!batch) return unassignedIdentity(null);
    if (batch.project_id) {
      const project = await fetchProjectRow(supabase, batch.project_id);
      if (project) return identityFromProject(project, batch.id);
    }
    return unassignedIdentity(batch);
  }

  return unassignedIdentity(null);
}
