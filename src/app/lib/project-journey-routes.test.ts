import { describe, expect, it } from 'vitest';
import {
  isProjectJourneyStep,
  currentPathToJourneyStep,
  legacyPathForProject,
  legacyWorkflowPathToStep,
  projectPath,
  projectScopedPathToStep,
  projectStatusStagePath,
  projectStepToLegacyPath,
  workflowStagePath,
} from './project-journey-routes';

describe('project journey routes', () => {
  it('builds canonical project-scoped step paths', () => {
    expect(projectPath('project-1')).toBe('/project/project-1');
    expect(projectPath('project-1', 'data')).toBe('/project/project-1/data');
    expect(projectPath('project-1', 'report', '?report=report-1')).toBe('/project/project-1/report?report=report-1');
  });

  it('maps legacy workflow routes to journey steps', () => {
    expect(legacyWorkflowPathToStep('/stage1')).toBe('data');
    expect(legacyWorkflowPathToStep('/admin')).toBe('studies');
    expect(legacyWorkflowPathToStep('/responses')).toBe('studies');
    expect(legacyWorkflowPathToStep('/survey-analysis')).toBe('insights');
    expect(legacyWorkflowPathToStep('/decision')).toBe('decision');
    expect(legacyWorkflowPathToStep('/concept-testing')).toBe('concept');
    expect(legacyWorkflowPathToStep('/report')).toBe('report');
    expect(legacyWorkflowPathToStep('/commercialization-report')).toBe('report');
  });

  it('maps project-scoped paths to the active journey step', () => {
    expect(projectScopedPathToStep('/project/project-1')).toBe('overview');
    expect(projectScopedPathToStep('/project/project-1/data')).toBe('data');
    expect(projectScopedPathToStep('/project/project-1/decision')).toBe('decision');
    expect(projectScopedPathToStep('/project/project-1/nope')).toBeNull();
    expect(currentPathToJourneyStep('/survey-analysis')).toBe('insights');
    expect(currentPathToJourneyStep('/project/project-1/concept')).toBe('concept');
  });

  it('keeps fallback legacy paths available', () => {
    expect(projectStepToLegacyPath('data')).toBe('/stage1');
    expect(projectStepToLegacyPath('report')).toBe('/reports');
    expect(workflowStagePath('decision')).toBe('/decision');
    expect(projectStatusStagePath('testing')).toBe('/admin');
  });

  it('scopes workflow and status stages when a project is known', () => {
    expect(workflowStagePath('responses', 'project-1')).toBe('/project/project-1/studies');
    expect(workflowStagePath('report', 'project-1', '?report=report-1')).toBe('/project/project-1/report?report=report-1');
    expect(projectStatusStagePath('concept', 'project-1')).toBe('/project/project-1/concept');
  });

  it('builds redirect targets from old routes', () => {
    expect(legacyPathForProject('/decision', 'project-1')).toBe('/project/project-1/decision');
    expect(legacyPathForProject('/report', 'project-1', '?report=report-1')).toBe('/project/project-1/report?report=report-1');
    expect(legacyPathForProject('/settings', 'project-1')).toBeNull();
  });

  it('validates step params', () => {
    expect(isProjectJourneyStep('data')).toBe(true);
    expect(isProjectJourneyStep('nope')).toBe(false);
  });
});
