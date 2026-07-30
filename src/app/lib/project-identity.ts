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

export interface ProjectScopeProject {
  id: string;
  name: string;
  foodTypeSlug?: string;
}

export interface ProjectScopeBatch {
  id: string;
  projectId?: string | null;
  projectName?: string | null;
  foodTypeSlug: string;
  status: 'active' | 'archived' | 'deleted';
}

export interface ResolvedProjectRouteScope<
  TProject extends ProjectScopeProject = ProjectScopeProject,
  TBatch extends ProjectScopeBatch = ProjectScopeBatch,
> {
  routeId: string;
  project: TProject | null;
  projectId: string;
  projectName: string;
  foodTypeSlug: string;
  activeBatches: TBatch[];
  selectedBatch: TBatch | null;
}

/**
 * Resolve a route from schema-backed project identity. For real project routes,
 * the projects row owns the category and every active assigned batch belongs
 * to the scope. Batch IDs remain supported only for legacy/unassigned routes.
 */
export function resolveProjectRouteScope<
  TProject extends ProjectScopeProject,
  TBatch extends ProjectScopeBatch,
>(
  routeId: string | undefined,
  projects: TProject[],
  batches: TBatch[],
): ResolvedProjectRouteScope<TProject, TBatch> | null {
  if (!routeId) return null;
  const project = projects.find(item => item.id === routeId) ?? null;

  if (project) {
    const activeBatches = batches.filter(batch => batch.projectId === project.id && batch.status === 'active');
    const selectedBatch = activeBatches[0] ?? null;
    const foodTypeSlug = project.foodTypeSlug ?? selectedBatch?.foodTypeSlug ?? '';
    return {
      routeId,
      project,
      projectId: project.id,
      projectName: project.name,
      foodTypeSlug,
      activeBatches,
      selectedBatch,
    };
  }

  const legacyBatch = batches.find(batch => batch.id === routeId && batch.status === 'active') ?? null;
  if (!legacyBatch) return null;
  return {
    routeId,
    project: null,
    projectId: legacyBatch.projectId ?? legacyBatch.id,
    projectName: legacyBatch.projectName ?? 'Unassigned import',
    foodTypeSlug: legacyBatch.foodTypeSlug,
    activeBatches: [legacyBatch],
    selectedBatch: legacyBatch,
  };
}

export function selectionMatchesProjectScope(
  foodType: string,
  subCategory: string | null | undefined,
  scope: ResolvedProjectRouteScope,
) {
  return foodType === scope.foodTypeSlug
    && parseBatchSelection(subCategory) === scope.selectedBatch?.id;
}

export interface ProjectRouteIdentity {
  id: string;
  projectId?: string | null;
}

export function projectRoutePath(project: ProjectRouteIdentity): string {
  return `/project/${project.projectId ?? project.id}`;
}
