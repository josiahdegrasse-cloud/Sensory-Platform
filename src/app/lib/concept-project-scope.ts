import type { ConceptTest } from './database';

/**
 * Project routes are strict tenant-internal boundaries: a concept with a
 * different or missing canonical project id must never appear in that project.
 * Legacy, projectless screens may continue to show the tenant-wide collection.
 */
export function conceptBelongsToProject(
  concept: Pick<ConceptTest, 'projectId'>,
  projectId: string | null | undefined,
) {
  return !projectId || concept.projectId === projectId;
}

export function conceptsForProject(
  concepts: readonly ConceptTest[],
  projectId: string | null | undefined,
) {
  return concepts.filter(concept => conceptBelongsToProject(concept, projectId));
}
