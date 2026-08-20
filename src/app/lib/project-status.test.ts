import { describe, expect, it } from 'vitest';
import { computeProjectStatus } from './project-status';
import type { DecisionRecord } from './db/workspace';
import type { Product } from '../data/survey-domain';
import type { CommercializationReportRecord, ConceptTest } from './database';

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
  projectId: 'project-1',
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

  it('counts project-linked surveys even without batch or sample links', () => {
    const status = computeProjectStatus({
      ...baseInput,
      importBatchId: 'batch-1',
      importBatches: [{
        id: 'batch-1',
        projectId: 'project-1',
        foodTypeSlug: 'cheese',
        foodTypeLabel: 'Cheese',
        fileName: 'Cheese.csv',
        rowCount: 1,
        recognizedColumns: [],
        ignoredColumns: [],
        detectionConfidence: 1,
        status: 'active',
        importedBy: null,
        importedByName: null,
        createdAt: '2026-06-06',
        sampleCount: 1,
      }],
      products: [product({ sourceImportBatchId: null, sourceSampleId: null })],
    });

    expect(status.stages.find(stage => stage.id === 'testing')?.detail).toMatch(/0\/12 responses collected/i);
    expect(status.statusLabel).toBe('Survey running');
  });

  it('does not show a launched concept from another same-category project', () => {
    const status = computeProjectStatus({
      ...baseInput,
      importBatchId: 'batch-1',
      importBatches: [{
        id: 'batch-1',
        projectId: 'mozza-project',
        foodTypeSlug: 'cheese',
        foodTypeLabel: 'Cheese',
        fileName: 'Mozza Ref.csv',
        rowCount: 1,
        recognizedColumns: [],
        ignoredColumns: [],
        detectionConfidence: 1,
        status: 'active',
        importedBy: null,
        importedByName: null,
        createdAt: '2026-06-06',
        sampleCount: 1,
      }],
      decisionRecords: [{ ...goDecision, projectId: 'mozza-project' }],
      conceptTests: [{
        id: 'cashew-cheddar',
        name: 'Cashew Cheddar',
        projectId: 'cashew-project',
        foodTypeSlug: 'cheese',
        status: 'active',
        launchedAt: '2026-06-07',
      } as ConceptTest],
    });

    expect(status.conceptName).toBeNull();
    expect(status.stages.find(stage => stage.id === 'concept')?.detail).toMatch(/ready to build a concept/i);
  });

  it('does not show a report owned by another project even when its decision id matches', () => {
    const foreignReport = {
      id: 'cashew-report',
      canonicalProjectId: 'cashew-project',
      decisionRecordId: goDecision.id,
      conceptTestId: 'cashew-concept',
      status: 'approved',
      updatedAt: '2026-06-08',
    } as CommercializationReportRecord;
    const status = computeProjectStatus({
      ...baseInput,
      importBatchId: 'batch-1',
      importBatches: [{
        id: 'batch-1',
        projectId: 'mozza-project',
        foodTypeSlug: 'cheese',
        foodTypeLabel: 'Cheese',
        fileName: 'Mozza Ref.csv',
        rowCount: 1,
        recognizedColumns: [],
        ignoredColumns: [],
        detectionConfidence: 1,
        status: 'active',
        importedBy: null,
        importedByName: null,
        createdAt: '2026-06-06',
        sampleCount: 1,
      }],
      decisionRecords: [{ ...goDecision, projectId: 'mozza-project' }],
      commercializationReports: [foreignReport],
    });

    expect(status.latestReport).toBeNull();
    expect(status.reportStatus).toBe('not-ready');
  });
});
