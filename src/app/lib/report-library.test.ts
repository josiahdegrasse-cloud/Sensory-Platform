import { describe, expect, it } from 'vitest';
import { buildReportLibrary, filterReportLibrary } from './report-library';
import type { CommercializationReportRecord, ConceptTest, DecisionRecord } from './database';
import type { ReportReadiness } from './report-context-builder';

function report(overrides: Partial<CommercializationReportRecord>): CommercializationReportRecord {
  return {
    id: 'report-1',
    decisionRecordId: 'decision-1',
    conceptTestId: 'concept-1',
    packagingImageId: null,
    status: 'draft',
    version: 1,
    title: 'Sample A commercialization report',
    reportSnapshot: {
      product: { sampleId: 'sample-1', sampleName: 'Sample A', foodType: 'cheese' },
      decision: { recordId: 'decision-1', outcome: 'GO' },
      concept: { name: 'Everyday cheddar' },
    },
    createdBy: 'user-1',
    approvedBy: null,
    approvedAt: null,
    createdAt: '2026-06-10T10:00:00.000Z',
    updatedAt: '2026-06-10T10:00:00.000Z',
    ...overrides,
  };
}

const decisions = [{
  id: 'decision-1',
  timestamp: '2026-06-10T09:00:00.000Z',
  sampleId: 'sample-1',
  sampleName: 'Sample A',
  decision: 'GO',
  issfScore: 82,
  confidence: 84,
  user: 'Admin',
  note: '',
  methodVersion: '1.0',
  decisionFingerprint: 'fingerprint',
}] satisfies DecisionRecord[];

const concepts = [{
  id: 'concept-1',
  name: 'Everyday cheddar',
  category: 'Cheese',
  description: '',
  imageUrls: [],
  targetMarket: '',
  pricePoint: '',
  keyBenefits: '',
  questions: [],
  panelSize: 24,
  assignedPanelistIds: [],
  foodTypeSlug: 'cheese',
  status: 'active',
  createdAt: '2026-06-10T09:00:00.000Z',
}] satisfies ConceptTest[];

describe('report library', () => {
  it('groups versions and selects the latest active version', () => {
    const entries = buildReportLibrary([
      report({ id: 'v1', version: 1 }),
      report({ id: 'v2', version: 2, status: 'approved', updatedAt: '2026-06-11T10:00:00.000Z' }),
      report({ id: 'v3', version: 3, status: 'archived', updatedAt: '2026-06-12T10:00:00.000Z' }),
    ], decisions, concepts);

    expect(entries).toHaveLength(1);
    expect(entries[0].latest.id).toBe('v2');
    expect(entries[0].versions.map(version => version.id)).toEqual(['v3', 'v2', 'v1']);
    expect(entries[0]).toMatchObject({
      productName: 'Sample A',
      foodType: 'cheese',
      conceptName: 'Everyday cheddar',
      decision: 'GO',
    });
  });

  it('filters active reports by status and searchable metadata', () => {
    const entries = buildReportLibrary([
      report({ id: 'cheese', status: 'review' }),
      report({
        id: 'bread',
        decisionRecordId: 'decision-2',
        conceptTestId: 'concept-2',
        title: 'Bread launch report',
        reportSnapshot: {
          product: { sampleId: 'sample-2', sampleName: 'Seeded loaf', foodType: 'bread' },
          decision: { recordId: 'decision-2', outcome: 'GO' },
          concept: { name: 'Family loaf' },
        },
      }),
    ], decisions, concepts);

    expect(filterReportLibrary(entries, 'seeded', 'all')).toHaveLength(1);
    expect(filterReportLibrary(entries, '', 'review')).toHaveLength(1);
    expect(filterReportLibrary(entries, 'missing', 'all')).toHaveLength(0);
  });

  it('adds export readiness and evidence provenance to library entries', () => {
    const readiness = {
      exportReady: true,
      approvalReady: false,
      blockers: [],
      warnings: ['Claims review is still pending.'],
      evidenceProvenance: {
        sensory: 'live',
        instrumental: 'live',
        concept: 'none',
        purchaseIntent: 'none',
      },
      evidenceBundleStatus: 'linked',
      sensoryStatus: 'Live sensory evidence',
      instrumentalStatus: 'Instrumental evidence included',
      conceptStatus: 'Missing concept evidence',
      purchaseIntentStatus: 'Purchase intent not available',
      approvalBlockers: ['Concept evidence missing.'],
      exportBlockers: [],
      qcWarnings: ['Claims review is still pending.'],
      agentStatus: 'partial',
    } satisfies ReportReadiness;

    const entries = buildReportLibrary([
      report({ id: 'ready-report' }),
    ], decisions, concepts, { 'ready-report': readiness });

    expect(entries[0]).toMatchObject({
      exportReady: true,
      approvalReady: false,
      warnings: ['Claims review is still pending.'],
      evidenceProvenance: { sensory: 'live', concept: 'none' },
    });
  });
});
