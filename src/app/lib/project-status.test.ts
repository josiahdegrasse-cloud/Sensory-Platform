import { describe, expect, it } from 'vitest';
import { computeProjectStatus } from './project-status';
import type { DecisionRecord } from './db/workspace';
import type { Product } from '../data/mock-users';

const cheeseSample = {
  sampleId: 'S1',
  sampleName: 'Cheddar V1',
  type: 'cheese',
  sourness: 1,
  bitterness: 2,
  saltiness: 3,
  umami: 4,
  sweetness: 1,
};

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'product-1',
  name: 'Cheddar V1',
  category: 'Cheese',
  status: 'active',
  customAttributes: [],
  assignedPanelistIds: ['panelist-1'],
  createdDate: '2026-06-06',
  sourceSampleId: 'S1',
  ...overrides,
});

const goDecision: DecisionRecord = {
  id: 'decision-1',
  timestamp: '2026-06-06T00:00:00.000Z',
  sampleId: 'S1',
  sampleName: 'Cheddar V1',
  decision: 'GO',
  issfScore: 77,
  confidence: 0.9,
  user: 'demo',
  note: '',
  methodVersion: 'v1',
  decisionFingerprint: 'fp',
};

const baseInput = {
  foodType: 'cheese',
  importBatchId: null,
  importBatches: [],
  instrumentalDataset: { eTongueData: [cheeseSample], gcmsData: {}, compositionData: {} } as never,
  products: [product()],
  responseCountsBySampleId: { S1: 12 },
  decisionRecords: [goDecision],
  conceptTests: [],
  commercializationReports: [],
  minimumResponses: 12,
};

describe('computeProjectStatus metric coherence', () => {
  it('counts responses for a reference decision surfaced by the food-type fallback', () => {
    // The decision references a sample (S1) that is NOT in this view's instrumental
    // set, so it only matches via the food-type fallback. Its responses must still
    // be counted, otherwise the card shows "0 responses" next to a GO / ISSF 77.
    const status = computeProjectStatus({
      ...baseInput,
      instrumentalDataset: { eTongueData: [], gcmsData: {}, compositionData: {} } as never,
    });

    expect(status.decisionStatus).toBe('GO');
    expect(status.issfScore).toBe(77);
    // Coherent: a GO can't co-exist with zero counted responses.
    expect(status.responseCompleted).toBe(12);
    expect(status.responseCompleted).toBeGreaterThan(0);
  });

  it('does not invent responses when a GO decision genuinely has none recorded', () => {
    const status = computeProjectStatus({
      ...baseInput,
      instrumentalDataset: { eTongueData: [], gcmsData: {}, compositionData: {} } as never,
      responseCountsBySampleId: {},
    });

    expect(status.decisionStatus).toBe('GO');
    expect(status.responseCompleted).toBe(0);
  });
});
