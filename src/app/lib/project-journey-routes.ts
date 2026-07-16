import type { WorkflowStageId as ProjectStatusStageId } from './project-status';
import type { WorkflowStageId } from './workflow/workflow-types';

export const PROJECT_JOURNEY_STEPS = [
  'overview',
  'data',
  'studies',
  'responses',
  'insights',
  'decision',
  'concept',
  'report',
] as const;

export type ProjectJourneyStep = typeof PROJECT_JOURNEY_STEPS[number];

const STEP_TO_LEGACY_PATH: Record<ProjectJourneyStep, string> = {
  overview: '/project',
  data: '/stage1',
  studies: '/admin',
  responses: '/admin',
  insights: '/survey-analysis',
  decision: '/decision',
  concept: '/concept-testing',
  report: '/reports',
};

const LEGACY_PATH_TO_STEP: Record<string, ProjectJourneyStep> = {
  '/project': 'overview',
  '/stage1': 'data',
  '/admin': 'studies',
  '/responses': 'studies',
  '/survey-analysis': 'insights',
  '/decision': 'decision',
  '/concept-testing': 'concept',
  '/reports': 'report',
  '/report': 'report',
  '/commercialization-report': 'report',
};

const WORKFLOW_STAGE_TO_STEP: Record<WorkflowStageId, ProjectJourneyStep> = {
  data: 'data',
  studies: 'studies',
  responses: 'studies',
  insights: 'insights',
  decision: 'decision',
  concept: 'concept',
  report: 'report',
};

const PROJECT_STATUS_STAGE_TO_STEP: Record<ProjectStatusStageId, ProjectJourneyStep> = {
  data: 'data',
  studies: 'studies',
  responses: 'studies',
  testing: 'studies',
  insights: 'insights',
  decision: 'decision',
  concept: 'concept',
  report: 'report',
};

export function isProjectJourneyStep(value: string | undefined): value is ProjectJourneyStep {
  return PROJECT_JOURNEY_STEPS.includes(value as ProjectJourneyStep);
}

export function projectPath(projectId: string, step: ProjectJourneyStep = 'overview', search = ''): string {
  const base = step === 'overview'
    ? `/project/${projectId}`
    : `/project/${projectId}/${step}`;
  return search ? `${base}${search.startsWith('?') ? search : `?${search}`}` : base;
}

export function projectStudiesPath(projectId: string, view: 'studies' | 'ship-outs' = 'studies', search = ''): string {
  const base = projectPath(projectId, 'studies');
  const path = view === 'studies' ? base : `${base}/${view}`;
  return search ? `${path}${search.startsWith('?') ? search : `?${search}`}` : path;
}

export function projectDecisionExperimentsPath(projectId: string, search = ''): string {
  const path = `${projectPath(projectId, 'decision')}/experiments`;
  return search ? `${path}${search.startsWith('?') ? search : `?${search}`}` : path;
}

export function legacyWorkflowPathToStep(pathname: string): ProjectJourneyStep | null {
  return LEGACY_PATH_TO_STEP[pathname.replace(/\/+$/, '') || '/'] ?? null;
}

export function projectScopedPathToStep(pathname: string): ProjectJourneyStep | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const match = normalized.match(/^\/project\/[^/]+(?:\/([^/]+))?(?:\/[^/]+)?$/);
  if (!match) return null;
  const step = match[1] ?? 'overview';
  return isProjectJourneyStep(step) ? step : null;
}

export function currentPathToJourneyStep(pathname: string): ProjectJourneyStep | null {
  return projectScopedPathToStep(pathname) ?? legacyWorkflowPathToStep(pathname);
}

export function projectStepToLegacyPath(step: ProjectJourneyStep): string {
  return STEP_TO_LEGACY_PATH[step];
}

export function workflowStagePath(stageId: WorkflowStageId, projectId?: string | null, search = ''): string {
  const step = WORKFLOW_STAGE_TO_STEP[stageId];
  return projectId ? projectPath(projectId, step, search) : projectStepToLegacyPath(step);
}

export function projectStatusStagePath(stageId: ProjectStatusStageId, projectId?: string | null): string {
  const step = PROJECT_STATUS_STAGE_TO_STEP[stageId];
  return projectId ? projectPath(projectId, step) : projectStepToLegacyPath(step);
}

export function legacyPathForProject(pathname: string, projectId: string, search = ''): string | null {
  const step = legacyWorkflowPathToStep(pathname);
  return step ? projectPath(projectId, step, search) : null;
}
