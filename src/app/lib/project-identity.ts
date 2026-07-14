/**
 * The single parser/encoder for the FoodTypeContext `subCategory` selection
 * string (`batch:<id>`). Replaces the previously-duplicated inline
 * `subCategory.startsWith('batch:')` logic across the main layout and
 * stage4-enhanced, admin-config, stage1-instrumental, etc.
 */
export function parseBatchSelection(subCategory: string | null | undefined): string | null {
  if (!subCategory?.startsWith('batch:')) return null;
  return subCategory.slice('batch:'.length) || null;
}

export function encodeBatchSelection(batchId: string): string {
  return `batch:${batchId}`;
}

export interface ProjectRouteIdentity {
  id: string;
  projectId?: string | null;
}

export function projectRoutePath(project: ProjectRouteIdentity): string {
  return `/project/${project.projectId ?? project.id}`;
}
