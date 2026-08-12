import type { DecisionRecord, ProjectRecord } from './database';

export interface ProjectSwitcherGroups {
  recent: ProjectRecord[];
  remaining: ProjectRecord[];
  archived: ProjectRecord[];
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
