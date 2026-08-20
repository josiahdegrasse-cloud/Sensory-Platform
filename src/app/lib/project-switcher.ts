import type { DecisionRecord, ImportBatchRecord, ProjectRecord } from './database';

export interface ProjectSwitcherGroups {
  recent: ProjectRecord[];
  remaining: ProjectRecord[];
  archived: ProjectRecord[];
}

/** Projects are fetched newest-first, so the first active row is the default workspace. */
export function getFirstActiveProjectId(projects: readonly ProjectRecord[]): string | null {
  return projects.find(project => project.status === 'active')?.id ?? null;
}

export function resolveAdminWorkflowProjectId(input: {
  routeProjectId?: string | null;
  selectedBatchId?: string | null;
  projects: readonly ProjectRecord[];
  batches: readonly ImportBatchRecord[];
}): string | null {
  if (input.routeProjectId) return input.routeProjectId;

  const selectedBatch = input.selectedBatchId
    ? input.batches.find(batch => batch.id === input.selectedBatchId && batch.status === 'active')
    : null;
  if (selectedBatch) return selectedBatch.projectId ?? selectedBatch.id;

  const firstActiveProjectId = getFirstActiveProjectId(input.projects);
  if (firstActiveProjectId) return firstActiveProjectId;

  const firstActiveBatch = input.batches.find(batch => batch.status === 'active');
  return firstActiveBatch?.projectId ?? firstActiveBatch?.id ?? null;
}

/**
 * Projects arrive newest-first from the data layer. Keep the switcher grouping
 * deterministic without creating another source of project identity.
 */
export function groupProjectsForSwitcher(
  projects: ProjectRecord[],
  recentLimit = 5,
): ProjectSwitcherGroups {
  const active = projects.filter(project => project.status === 'active');
  return {
    recent: active.slice(0, recentLimit),
    remaining: active.slice(recentLimit),
    archived: projects.filter(project => project.status === 'archived'),
  };
}

/** Decision records are newest-first; the first project match is authoritative. */
export function getLatestDecisionByProject(
  decisions: DecisionRecord[],
): Map<string, DecisionRecord['decision']> {
  const latest = new Map<string, DecisionRecord['decision']>();
  decisions.forEach(decision => {
    if (decision.projectId && !latest.has(decision.projectId)) {
      latest.set(decision.projectId, decision.decision);
    }
  });
  return latest;
}
