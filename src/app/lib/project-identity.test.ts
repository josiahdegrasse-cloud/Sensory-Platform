import { describe, expect, it } from 'vitest';
import {
  encodeBatchSelection,
  resolveProjectRouteScope,
  selectionMatchesProjectScope,
} from './project-identity';

const projects = [{
  id: 'project-bread',
  name: 'Bread — June',
  foodTypeSlug: 'bread',
}];

const batches = [{
  id: 'batch-bread',
  projectId: 'project-bread',
  projectName: 'Bread — June',
  foodTypeSlug: 'bread',
  status: 'active' as const,
}];

describe('project route identity', () => {
  it('uses the project row as the canonical food type and name', () => {
    const scope = resolveProjectRouteScope('project-bread', projects, [{
      ...batches[0],
      foodTypeSlug: 'yogurt',
    }]);
    expect(scope).toMatchObject({
      projectId: 'project-bread',
      projectName: 'Bread — June',
      foodTypeSlug: 'bread',
    });
  });

  it('keeps every active batch assigned to the project in scope', () => {
    const scope = resolveProjectRouteScope('project-bread', projects, [
      ...batches,
      { ...batches[0], id: 'batch-bread-retest' },
      { ...batches[0], id: 'batch-archived', status: 'archived' as const },
    ]);
    expect(scope?.activeBatches.map(batch => batch.id)).toEqual([
      'batch-bread',
      'batch-bread-retest',
    ]);
  });

  it('rejects a stale food type even when the selected batch ID is correct', () => {
    const scope = resolveProjectRouteScope('project-bread', projects, batches)!;
    expect(selectionMatchesProjectScope(
      'yogurt',
      encodeBatchSelection('batch-bread'),
      scope,
    )).toBe(false);
    expect(selectionMatchesProjectScope(
      'bread',
      encodeBatchSelection('batch-bread'),
      scope,
    )).toBe(true);
  });
});
