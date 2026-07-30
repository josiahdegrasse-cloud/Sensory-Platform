import { describe, expect, it } from 'vitest';
import type { DecisionRecord, ImportBatchRecord } from './database';
import { buildProductTimeline } from './product-history';

const batches: ImportBatchRecord[] = [
  {
    id: 'B1',
    foodTypeSlug: 'cheese',
    foodTypeLabel: 'Cheese',
    fileName: 'project-one.csv',
    rowCount: 1,
    recognizedColumns: [],
    ignoredColumns: [],
    detectionConfidence: 1,
    status: 'active',
    importedBy: null,
    importedByName: null,
    createdAt: '2026-07-01T00:00:00Z',
    sampleCount: 1,
    reformulationNotes: null,
    foodTypeId: null,
    projectId: 'P1',
    projectName: 'Project one',
  },
  {
    id: 'B2',
    foodTypeSlug: 'cheese',
    foodTypeLabel: 'Cheese',
    fileName: 'S1-other-project.csv',
    rowCount: 1,
    recognizedColumns: [],
    ignoredColumns: [],
    detectionConfidence: 1,
    status: 'active',
    importedBy: null,
    importedByName: null,
    createdAt: '2026-07-02T00:00:00Z',
    sampleCount: 1,
    reformulationNotes: null,
    foodTypeId: null,
    projectId: 'P2',
    projectName: 'Project two',
  },
];

function decision(overrides: Partial<DecisionRecord>): DecisionRecord {
  return {
    id: 'D1',
    timestamp: '2026-07-03T00:00:00Z',
    sampleId: 'S1',
    sampleName: 'Prototype',
    decision: 'GO',
    issfScore: 80,
    confidence: 90,
    user: 'R&D lead',
    note: '',
    methodVersion: 'v1',
    decisionFingerprint: 'fp',
    ...overrides,
  };
}

describe('product history lineage', () => {
  it('uses the canonical batch and excludes unscoped text-only decisions', () => {
    const timeline = buildProductTimeline(
      'S1',
      'Prototype',
      batches,
      [
        decision({ id: 'canonical', projectId: 'P1', instrumentalSampleId: 'IS1' }),
        decision({ id: 'legacy-other', projectId: null, instrumentalSampleId: null }),
      ],
      [],
      [],
      { instrumentalSampleId: 'IS1', importBatchId: 'B1', projectId: 'P1' },
    );

    expect(timeline.events.map(event => event.id)).toEqual([
      'import-B1',
      'decision-canonical',
    ]);
  });
});
