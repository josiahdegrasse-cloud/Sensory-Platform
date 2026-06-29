import type { SemanticTone } from '../project-status';
import type { WorkflowStageStatus, WorkflowTone } from './workflow-types';

export const WORKFLOW_STAGE_ROUTES = {
  data: '/stage1',
  studies: '/admin',
  responses: '/admin',
  insights: '/survey-analysis',
  decision: '/decision',
  concept: '/concept-testing',
  report: '/reports',
} as const;

export const WORKFLOW_STAGE_LABELS = {
  data: 'Data',
  studies: 'Studies',
  responses: 'Responses',
  insights: 'Insights',
  decision: 'Decision',
  concept: 'Concept',
  report: 'Report',
} as const;

export function workflowTone(status: WorkflowStageStatus): WorkflowTone {
  switch (status) {
    case 'complete':
      return 'success';
    case 'ready':
      return 'info';
    case 'in_progress':
      return 'info';
    case 'needs_review':
      return 'warning';
    case 'blocked':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function workflowToneToSemanticTone(tone: WorkflowTone): SemanticTone {
  return tone;
}

export function workflowStatusLabel(status: WorkflowStageStatus): string {
  switch (status) {
    case 'not_started': return 'Not started';
    case 'in_progress': return 'In progress';
    case 'needs_review': return 'Needs review';
    case 'blocked': return 'Pending';
    case 'ready': return 'Ready';
    case 'complete': return 'Complete';
  }
}
