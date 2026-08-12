import { describe, expect, it } from 'vitest';
import type { DecisionRecord, ProjectRecord } from './database';
import { getLatestDecisionByProject, groupProjectsForSwitcher } from './project-switcher';

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
