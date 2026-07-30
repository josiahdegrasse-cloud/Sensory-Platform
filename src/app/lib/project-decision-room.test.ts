import { describe, expect, it } from 'vitest';
import type { DecisionRecord, InstrumentalDataset } from './database';
import type { FormulationVersion } from './formulation-profile';
import {
  buildDecisionRoomPrototypes,
  decisionRoomEligibility,
  decisionRoomNextAction,
} from './project-decision-room';

const dataset: InstrumentalDataset = {
  eTongueData: [
    { sampleId: 'S1', sampleName: 'Prototype one', sourness: 1, bitterness: 1, saltiness: 1, umami: 1, sweetness: 1, importBatchId: 'B1' },
    { sampleId: 'S2', sampleName: 'Prototype two', sourness: 1, bitterness: 1, saltiness: 1, umami: 1, sweetness: 1, importBatchId: 'B1' },
  ],
  gcmsData: { S1: [{ name: 'Hexanal', concentration: 1, aroma: 'green', threshold: 2 }] },
  compositionData: { S1: { protein: 1, fat: 1, moisture: 1, pH: 6, saltContent: 1, calciumMg: 1 } },
};

function decision(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: 'D1', timestamp: '2026-07-01T12:00:00Z', sampleId: 'S1', sampleName: 'Prototype one',
    decision: 'TWEAK', issfScore: 72, confidence: 90, user: 'R&D lead', note: '', methodVersion: 'v1',
    decisionFingerprint: 'fp', projectId: 'P1', evidenceBundleId: 'E1', formulationVersionId: 'F1',
    ...overrides,
  };
}

const formulation: FormulationVersion = {
  id: 'F1', instrumentalSampleId: 'IS1', projectId: 'P1', importBatchId: 'B1', sampleId: 'S1',
  sampleName: 'Prototype one', versionNumber: 2, exactStatement: 'Water, coconut oil', statementSource: 'manual',
  fingerprint: 'form-fp', isCurrent: true, reviewStatus: 'reviewed', changeSummary: null,
  createdAt: '2026-06-01T12:00:00Z', reviewedAt: '2026-06-02T12:00:00Z', ingredients: [],
};

describe('project decision room model', () => {
  it('uses the latest project-scoped decision and preserves its formulation snapshot', () => {
    const older = decision({ id: 'D0', timestamp: '2026-06-01T12:00:00Z', decision: 'STOP' });
    const otherProject = decision({ id: 'DX', timestamp: '2026-08-01T12:00:00Z', projectId: 'P2' });
    const [prototype] = buildDecisionRoomPrototypes({
      samples: dataset.eTongueData,
      decisions: [older, decision(), otherProject],
      formulations: [formulation],
      experiments: [],
      projectId: 'P1',
      dataset,
    });

    expect(prototype.decision?.id).toBe('D1');
    expect(prototype.supersededDecision?.id).toBe('D0');
    expect(prototype.decisionFormulation?.id).toBe('F1');
    expect(prototype.instrumentSourceCount).toBe(3);
  });

  it('blocks experiment setup when a TWEAK decision lacks immutable linkage', () => {
    const [prototype] = buildDecisionRoomPrototypes({
      samples: dataset.eTongueData.slice(0, 1),
      decisions: [decision({ formulationVersionId: null, evidenceBundleId: null })],
      formulations: [formulation],
      experiments: [],
      projectId: 'P1',
      dataset,
    });

    const eligibility = decisionRoomEligibility(prototype);
    expect(eligibility.label).toBe('Experiment setup blocked');
    expect(eligibility.blockers).toHaveLength(2);
    expect(decisionRoomNextAction({ prototype, workflow: { nextAction: {} } as never, routes: { data: '/data', decision: '/decision', experiments: '/experiments' } }).route).toBe('/data');
  });

  it('unlocks concept and report work only from a confirmed GO', () => {
    const [prototype] = buildDecisionRoomPrototypes({
      samples: dataset.eTongueData.slice(0, 1),
      decisions: [decision({ decision: 'GO' })],
      formulations: [formulation],
      experiments: [],
      projectId: 'P1',
      dataset,
    });

    expect(decisionRoomEligibility(prototype).label).toBe('Eligible for concept and report work');
  });

  it('keeps duplicate sample labels separate through canonical prototype ids', () => {
    const samples: InstrumentalDataset['eTongueData'] = [
      { ...dataset.eTongueData[0], instrumentalSampleId: 'IS1', importBatchId: 'B1' },
      { ...dataset.eTongueData[0], instrumentalSampleId: 'IS2', importBatchId: 'B2', sampleName: 'Prototype one retest' },
    ];
    const prototypes = buildDecisionRoomPrototypes({
      samples,
      decisions: [
        decision({ id: 'D1', instrumentalSampleId: 'IS1', decision: 'TWEAK' }),
        decision({ id: 'D2', instrumentalSampleId: 'IS2', decision: 'GO', timestamp: '2026-07-02T12:00:00Z' }),
      ],
      formulations: [],
      experiments: [],
      products: [
        { id: 'P2', name: 'Retest study', category: 'cheese', createdDate: '2026-07-01', status: 'active', instrumentalSampleId: 'IS2' },
      ],
      responses: [
        { id: 'R1', userId: 'U1', productId: 'P2', timestamp: '2026-07-02', runNumber: 1, cataAttributes: [], intensityRatings: {}, hedonicScores: { overall: 7, appearance: 7, aroma: 7, flavor: 7, texture: 7 }, emotionalProfile: {} },
      ],
      concepts: [
        { id: 'C1', name: 'Concept', category: 'cheese', description: '', imageUrls: [], targetMarket: '', pricePoint: '', keyBenefits: '', questions: [], panelSize: 12, assignedPanelistIds: [], status: 'draft', createdAt: '2026-07-02', decisionRecordId: 'D2' },
      ],
      reports: [
        { id: 'RP1', decisionRecordId: 'D2', conceptTestId: 'C1', packagingImageId: null, status: 'draft', version: 1, title: 'Report', reportSnapshot: {}, createdBy: 'U1', approvedBy: null, approvedAt: null, createdAt: '2026-07-02', updatedAt: '2026-07-02' },
      ],
      projectId: 'P1',
      dataset: { ...dataset, eTongueData: samples },
    });

    expect(prototypes[0].decision?.id).toBe('D1');
    expect(prototypes[0].responseCount).toBe(0);
    expect(prototypes[1].decision?.id).toBe('D2');
    expect(prototypes[1].studyCount).toBe(1);
    expect(prototypes[1].responseCount).toBe(1);
    expect(prototypes[1].conceptCount).toBe(1);
    expect(prototypes[1].reportCount).toBe(1);
  });

  it('does not attach an unscoped legacy decision to a project by sample text', () => {
    const [prototype] = buildDecisionRoomPrototypes({
      samples: dataset.eTongueData.slice(0, 1),
      decisions: [decision({ projectId: null, instrumentalSampleId: null })],
      formulations: [],
      experiments: [],
      projectId: 'P1',
      dataset,
    });

    expect(prototype.decision).toBeNull();
  });
});
