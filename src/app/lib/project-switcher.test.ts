import { describe, expect, it } from 'vitest';
import type { DecisionRecord, ImportBatchRecord, ProjectRecord } from './database';
import {
  getFirstActiveProjectId,
  getLatestDecisionByProject,
  groupProjectsForSwitcher,
  resolveAdminWorkflowProjectId,
} from './project-switcher';

function project(id: string, status: ProjectRecord['status'] = 'active'): ProjectRecord {
  return {
    id,
    name: `Project ${id}`,
    foodTypeId: `food-${id}`,
    status,
    startedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
  };
}

function decision(
  id: string,
  projectId: string | null,
  value: DecisionRecord['decision'],
): DecisionRecord {
  return {
    id,
    projectId,
    timestamp: '2026-08-01T00:00:00.000Z',
    sampleId: id,
    sampleName: id,
    decision: value,
    issfScore: 75,
    confidence: 0.9,
    user: 'Admin',
    note: '',
    methodVersion: '1',
    decisionFingerprint: id,
  };
}

function batch(
  id: string,
  status: ImportBatchRecord['status'] = 'active',
  projectId: string | null = null,
): ImportBatchRecord {
  return {
    id,
    projectId,
    foodTypeSlug: 'cheese',
    foodTypeLabel: 'Cheese',
    fileName: `${id}.csv`,
    rowCount: 1,
    recognizedColumns: [],
    ignoredColumns: [],
    detectionConfidence: 1,
    status,
    importedBy: null,
    importedByName: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    sampleCount: 1,
  };
}

describe('groupProjectsForSwitcher', () => {
  it('keeps recent, remaining, and archived projects separate', () => {
    const result = groupProjectsForSwitcher([
      project('1'),
      project('2'),
      project('3'),
      project('4'),
      project('5', 'archived'),
      project('6', 'deleted'),
    ]);

    expect(result.recent.map(item => item.id)).toEqual(['1', '2', '3', '4']);
    expect(result.remaining.map(item => item.id)).toEqual([]);
    expect(result.archived.map(item => item.id)).toEqual(['5']);
  });
});

describe('getFirstActiveProjectId', () => {
  it('uses the first live project from the newest-first project list', () => {
    expect(getFirstActiveProjectId([
      project('archived-newest', 'archived'),
      project('first-live'),
      project('second-live'),
    ])).toBe('first-live');
  });

  it('returns null when there is no live project', () => {
    expect(getFirstActiveProjectId([
      project('archived', 'archived'),
      project('deleted', 'deleted'),
    ])).toBeNull();
  });
});

describe('resolveAdminWorkflowProjectId', () => {
  it('preserves the current canonical project route', () => {
    expect(resolveAdminWorkflowProjectId({
      routeProjectId: 'route-project',
      selectedBatchId: 'selected-batch',
      projects: [project('first-live')],
      batches: [batch('selected-batch', 'active', 'selected-project')],
    })).toBe('route-project');
  });

  it('uses an active selected batch before the default project', () => {
    expect(resolveAdminWorkflowProjectId({
      selectedBatchId: 'selected-batch',
      projects: [project('first-live')],
      batches: [batch('selected-batch', 'active', 'selected-project')],
    })).toBe('selected-project');
  });

  it('ignores stale selected batches and uses the first active project', () => {
    expect(resolveAdminWorkflowProjectId({
      selectedBatchId: 'stale-batch',
      projects: [project('first-live'), project('second-live')],
      batches: [batch('stale-batch', 'archived', 'stale-project')],
    })).toBe('first-live');
  });

  it('falls back to an active legacy batch when no canonical project exists', () => {
    expect(resolveAdminWorkflowProjectId({
      projects: [project('archived', 'archived')],
      batches: [
        batch('archived-batch', 'archived'),
        batch('legacy-live'),
      ],
    })).toBe('legacy-live');
  });
});

describe('getLatestDecisionByProject', () => {
  it('uses the first newest-first decision and ignores unlinked records', () => {
    const result = getLatestDecisionByProject([
      decision('new', 'project-1', 'GO'),
      decision('old', 'project-1', 'TWEAK'),
      decision('unlinked', null, 'STOP'),
    ]);

    expect(result.get('project-1')).toBe('GO');
    expect(result.size).toBe(1);
  });
});
