import { supabase } from '../supabase';
import { dbError } from './shared';
import type { Database } from './database.types';

type Tables = Database['public']['Tables'];

export interface ProjectRecord {
  id: string;
  name: string;
  foodTypeId: string;
  foodTypeSlug?: string;
  foodTypeLabel?: string;
  status: 'active' | 'archived' | 'deleted';
  startedAt: string;
  createdAt: string;
}

function toProject(row: Tables['projects']['Row'] & {
  food_types?: { slug?: string; label?: string } | null;
}): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    foodTypeId: row.food_type_id,
    foodTypeSlug: row.food_types?.slug,
    foodTypeLabel: row.food_types?.label,
    status: row.status as ProjectRecord['status'],
    startedAt: row.started_at as string,
    createdAt: row.created_at as string,
  };
}

/** Live (non-deleted) projects, newest first. Returns [] if the table is absent. */
export async function fetchProjects(): Promise<ProjectRecord[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, food_types(slug, label)')
    .neq('status', 'deleted')
    .order('started_at', { ascending: false });
  if (error && /projects|schema cache|does not exist/i.test(error.message ?? '')) return [];
  if (error) throw dbError(error);
  return (data ?? []).map(row => toProject(row as Tables['projects']['Row'] & {
    food_types?: { slug?: string; label?: string } | null;
  }));
}

/** Create a project. org_id is stamped server-side by the set_org_id trigger. */
export async function createProject(name: string, foodTypeId: string): Promise<ProjectRecord> {
  const { data, error } = await supabase
    .from('projects')
    .insert({ name: name.trim(), food_type_id: foodTypeId })
    .select()
    .single();
  if (error) throw dbError(error);
  return toProject(data);
}

export async function renameProject(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw dbError(error);
}

/**
 * Removes a project from the active workspace using the schema's existing
 * deleted state. Every import batch linked to the real project is retired so a
 * multi-round project cannot leave duplicate cards behind. Legacy cards that
 * predate project identity retire only their backing import batch.
 */
export async function deleteProject(input: {
  projectId?: string | null;
  fallbackBatchId: string;
}): Promise<void> {
  let batchIds = [input.fallbackBatchId];

  if (input.projectId) {
    const { data, error } = await supabase
      .from('import_batches')
      .select('id')
      .eq('project_id', input.projectId)
      .neq('status', 'deleted');
    if (error) throw dbError(error);
    batchIds = [...new Set((data ?? []).map(batch => batch.id))];
  }

  for (const batchId of batchIds) {
    const { error } = await supabase.rpc('set_import_batch_status', {
      target_batch_id: batchId,
      next_status: 'deleted',
    });
    if (error) throw dbError(error);
  }

  if (input.projectId) {
    const { error } = await supabase
      .from('projects')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', input.projectId);
    if (error) throw dbError(error);
  }
}

/** Link (or unlink, with null) an import batch to a project. */
export async function assignBatchToProject(batchId: string, projectId: string | null): Promise<void> {
  const { error } = await supabase
    .from('import_batches')
    .update({ project_id: projectId })
    .eq('id', batchId);
  if (error) throw dbError(error);
}
