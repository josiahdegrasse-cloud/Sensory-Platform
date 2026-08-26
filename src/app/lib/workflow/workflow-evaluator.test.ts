import { describe, expect, it } from 'vitest';
import { evaluateProjectWorkflow } from './workflow-evaluator';
import type {
  CommercializationReportRecord,
  ConceptTest,
  DecisionRecord,
  ImportBatchRecord,
  InstrumentalDataset,
} from '../database';
import type { Product } from '../../data/survey-domain';
import type { ReportReadiness } from '../report-context-builder';

const batch: ImportBatchRecord = {
  id: 'batch-1',
  foodTypeSlug: 'cheese',
  foodTypeLabel: 'Cheese',
  fileName: 'Cashew Cream Cheese.csv',
  rowCount: 3,
  recognizedColumns: ['sample_id', 'sourness'],
  ignoredColumns: [],
  detectionConfidence: 0.96,
  status: 'active',
  importedBy: 'user-1',
  importedByName: 'Admin',
  createdAt: '2026-06-20T12:00:00.000Z',
  sampleCount: 1,
};

const dataset: InstrumentalDataset = {
  eTongueData: [{
    sampleId: 'S1',
    sampleName: 'Cashew Cream Cheese',
    type: 'cheese',
    importBatchId: 'batch-1',
    sourness: 2,
    bitterness: 2,
    saltiness: 4,
    umami: 3,
    sweetness: 1,
  }],
  gcmsData: { S1: [{ compound: 'diacetyl', concentration: 3, odor: 'buttery' }] as never },
  compositionData: { S1: { salt: 1.5, fat: 18 } as never },
};

const product: Product = {
  id: 'product-1',
  projectId: 'project-1',
  name: 'Cashew Cream Cheese Sensory',
  category: 'Cheese',
  createdDate: '2026-06-20',
  status: 'active',
  customAttributes: ['Creamy', 'Tangy'],
  assignedPanelistIds: ['panelist-1'],
  sourceImportBatchId: 'batch-1',
  sourceSampleId: 'S1',
};

const decision: DecisionRecord = {
  id: 'decision-1',
  timestamp: '2026-06-21T12:00:00.000Z',
  sampleId: 'S1',
  sampleName: 'Cashew Cream Cheese',
  decision: 'GO',
  issfScore: 82,
  confidence: 88,
  user: 'Admin',
  note: '',
  methodVersion: 'NFI-GST-1.1',
  decisionFingerprint: 'fingerprint-1',
};

const concept: ConceptTest = {
  id: 'concept-1',
  name: 'Everyday Cashew Spread',
  category: 'Cheese',
  description: 'A dairy-free spread concept.',
  imageUrls: [],
  targetMarket: 'Flexitarian shoppers',
  pricePoint: 'Validate $5.99',
  keyBenefits: 'Creamy plant-based spread',
  questions: [],
  panelSize: 24,
  assignedPanelistIds: ['panelist-1'],
  foodTypeSlug: 'cheese',
  status: 'active',
  createdAt: '2026-06-21T12:00:00.000Z',
  launchedAt: '2026-06-21T13:00:00.000Z',
};

const report: CommercializationReportRecord = {
  id: 'report-1',
  decisionRecordId: 'decision-1',
  conceptTestId: 'concept-1',
  packagingImageId: null,
  evidenceBundleId: 'bundle-1',
  status: 'approved',
  version: 1,
  title: 'Cashew Cream Cheese commercialization report',
  reportSnapshot: {},
  createdBy: 'user-1',
  approvedBy: 'user-1',
  approvedAt: '2026-06-22T12:00:00.000Z',
  createdAt: '2026-06-22T12:00:00.000Z',
  updatedAt: '2026-06-22T12:00:00.000Z',
};

const readyReport = {
  exportReady: true,
  approvalReady: true,
  blockers: [],
  warnings: [],
  evidenceProvenance: { sensory: 'live', instrumental: 'live', concept: 'live', purchaseIntent: 'live' },
  evidenceBundleStatus: 'linked',
  sensoryStatus: 'Live sensory evidence',
  instrumentalStatus: 'Instrumental evidence included',
  conceptStatus: '12 concept responses',
  purchaseIntentStatus: '7.1/9 purchase intent',
  approvalBlockers: [],
  exportBlockers: [],
  qcWarnings: [],
  agentStatus: 'passed',
} satisfies ReportReadiness;

const blockedReport = {
  ...readyReport,
  exportReady: false,
  approvalReady: false,
  blockers: ['Report context is incomplete. Open the report workspace and rebuild evidence before export.'],
  exportBlockers: ['Report context is incomplete. Open the report workspace and rebuild evidence before export.'],
  approvalBlockers: ['Report context is incomplete. Open the report workspace and rebuild evidence before approval.'],
  agentStatus: 'blocked',
} satisfies ReportReadiness;

const staleApprovedReport = {
  ...readyReport,
  agentStatus: 'stale',
  warnings: ['Report context changed after approval.'],
} satisfies ReportReadiness;

const referenceReport = {
  ...readyReport,
  exportReady: false,
  approvalReady: false,
  evidenceProvenance: { sensory: 'reference', instrumental: 'live', concept: 'live', purchaseIntent: 'live' },
  blockers: ['Reference/demo evidence must be replaced before approval.'],
  approvalBlockers: ['Reference/demo evidence must be replaced before approval.'],
  exportBlockers: [],
  agentStatus: 'partial',
} satisfies ReportReadiness;

function workflow(overrides: Partial<Parameters<typeof evaluateProjectWorkflow>[0]> = {}) {
  return evaluateProjectWorkflow({
    foodType: 'cheese',
    importBatchId: 'batch-1',
    importBatches: [],
    pendingImportCount: 0,
    products: [],
    responseCountsBySampleId: {},
    decisionRecords: [],
    conceptTests: [],
    conceptResponseCounts: {},
    commercializationReports: [],
    minimumResponses: 12,
    ...overrides,
  });
}

function stage(id: ReturnType<typeof workflow>['stages'][number]['id'], summary = workflow()) {
  return summary.stages.find(item => item.id === id)!;
}

function decisionWith(outcome: DecisionRecord['decision']): DecisionRecord {
  return {
    ...decision,
    id: `decision-${outcome.toLowerCase()}`,
    decision: outcome,
    issfScore: outcome === 'GO' ? 82 : outcome === 'TWEAK' ? 61 : 38,
  };
}

describe('project workflow evaluator', () => {
  it('marks no data imported as not started with import as next action', () => {
    const summary = workflow();

    expect(stage('data', summary).status).toBe('not_started');
    expect(summary.nextAction.route).toBe('/stage1');
  });

  it('marks data imported but no survey as studies not started', () => {
    const summary = workflow({ importBatches: [batch], instrumentalDataset: dataset });

    expect(stage('data', summary).status).toBe('complete');
    expect(stage('studies', summary).status).toBe('not_started');
    expect(stage('studies', summary).nextActionLabel).toMatch(/create sensory study/i);
  });

  it('marks imported data with missing food type as needs review', () => {
    const missingTypeBatch = { ...batch, foodTypeSlug: '', foodTypeLabel: '' };
    const missingTypeDataset = {
      ...dataset,
      eTongueData: [{ ...dataset.eTongueData[0], type: '' }],
    };
    const summary = workflow({
      foodType: '',
      importBatches: [missingTypeBatch],
      instrumentalDataset: missingTypeDataset,
    });

    expect(stage('data', summary).status).toBe('needs_review');
    expect(stage('data', summary).warnings.join(' ')).toMatch(/food type classification/i);
    expect(summary.nextAction.route).toBe('/project/batch-1/data');
  });

  it('marks a survey with no sensory attributes as needs review', () => {
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [{ ...product, customAttributes: [] }],
    });

    expect(stage('studies', summary).status).toBe('needs_review');
    expect(stage('studies', summary).warnings.join(' ')).toMatch(/no sensory attributes/i);
    expect(summary.nextAction.route).toBe('/project/batch-1/studies');
    expect(summary.overallStatusLabel).toBe('Next: Studies');
    expect(summary.overallTone).toBe('neutral');
  });

  it('marks an active study with no assigned panelists as needing review', () => {
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [{ ...product, assignedPanelistIds: [] }],
    });

    expect(stage('studies', summary).completedItems.join(' ')).toMatch(/no panelists assigned/i);
    expect(stage('studies', summary).warnings.join(' ')).toMatch(/no panelists assigned/i);
    expect(stage('studies', summary).status).toBe('needs_review');
  });

  it('marks active survey with zero responses as not started', () => {
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 0 },
    });

    expect(stage('responses', summary).status).toBe('not_started');
    expect(stage('responses', summary).detail).toMatch(/0\/12/);
    expect(summary.nextAction.label).toMatch(/collect responses/i);
  });

  it('counts surveys linked by project id when batch links are missing', () => {
    const summary = workflow({
      importBatches: [{ ...batch, projectId: 'project-1' }],
      instrumentalDataset: dataset,
      products: [{
        ...product,
        sourceImportBatchId: null,
        sourceSampleId: null,
      }],
    });

    expect(stage('studies', summary).status).toBe('complete');
    expect(summary.counts.activeStudies).toBe(1);
    expect(summary.counts.studiesTotal).toBe(1);
    expect(stage('studies', summary).relatedEntityIds.productIds).toEqual(['product-1']);
  });

  it('marks launched survey with low responses as in progress', () => {
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 8 },
    });

    expect(stage('studies', summary).status).toBe('complete');
    expect(stage('responses', summary).status).toBe('in_progress');
    expect(stage('responses', summary).detail).toContain('8/12');
    expect(stage('responses', summary).warnings).toEqual([]);
  });

  it('marks insights ready and decision ready when response target is met', () => {
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 12 },
    });

    expect(stage('insights', summary).status).toBe('ready');
    expect(stage('decision', summary).status).toBe('ready');
  });

  it('keeps TWEAK follow-up on decision and blocks concept/report commercialization paths', () => {
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 12 },
      decisionRecords: [decisionWith('TWEAK')],
    });

    expect(stage('decision', summary).nextActionLabel).toMatch(/tweak/i);
    expect(stage('concept', summary).status).toBe('blocked');
    expect(stage('report', summary).status).toBe('blocked');
    expect(stage('concept', summary).blockers.join(' ')).toMatch(/current decision is TWEAK/i);
    expect(summary.nextAction.route).toBe('/project/batch-1/data?retest=decision-tweak');
  });

  it('keeps STOP follow-up on decision and blocks concept/report commercialization paths', () => {
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 12 },
      decisionRecords: [decisionWith('STOP')],
    });

    expect(stage('decision', summary).nextActionLabel).toMatch(/STOP rationale/i);
    expect(stage('concept', summary).status).toBe('blocked');
    expect(stage('report', summary).status).toBe('blocked');
    expect(stage('report', summary).blockers.join(' ')).toMatch(/confirmed GO decision/i);
  });

  it('blocks concept until a confirmed GO, then prompts concept creation', () => {
    const blocked = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 12 },
    });
    const unlocked = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 12 },
      decisionRecords: [decision],
    });

    expect(stage('concept', blocked).status).toBe('blocked');
    expect(stage('concept', unlocked).status).toBe('not_started');
    expect(stage('concept', unlocked).nextActionLabel).toMatch(/create concept/i);
  });

  it('marks concept exists with no responses as in progress', () => {
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 12 },
      decisionRecords: [decision],
      conceptTests: [concept],
      conceptResponseCounts: { 'concept-1': 0 },
    });

    expect(stage('concept', summary).status).toBe('in_progress');
    expect(stage('concept', summary).warnings.join(' ')).toMatch(/no consumer responses/i);
    expect(stage('report', summary).status).toBe('not_started');
  });

  it('does not count same-category concepts from another canonical project', () => {
    const summary = workflow({
      importBatches: [{ ...batch, projectId: 'mozza-project' }],
      instrumentalDataset: dataset,
      products: [{ ...product, projectId: 'mozza-project' }],
      responseCountsBySampleId: { S1: 12 },
      decisionRecords: [{ ...decision, projectId: 'mozza-project' }],
      conceptTests: [
        { ...concept, id: 'cashew-cheddar', name: 'Cashew Cheddar', projectId: 'cashew-project' },
        { ...concept, id: 'cashew-cream-cheese', name: 'Cashew Cream Cheese', projectId: 'cashew-project' },
        { ...concept, id: 'legacy-projectless', name: 'Legacy Cheese', projectId: null },
      ],
      conceptResponseCounts: {
        'cashew-cheddar': 12,
        'cashew-cream-cheese': 12,
        'legacy-projectless': 12,
      },
    });

    expect(stage('concept', summary).status).toBe('not_started');
    expect(stage('concept', summary).detail).toBe('No concept test has been created yet.');
    expect(stage('concept', summary).relatedEntityIds.conceptTestIds).toEqual([]);
    expect(summary.counts.conceptsActive).toBe(0);
  });

  it('marks concept responses as ready before completed review', () => {
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 12 },
      decisionRecords: [decision],
      conceptTests: [concept],
      conceptResponseCounts: { 'concept-1': 8 },
    });

    expect(stage('concept', summary).status).toBe('ready');
    expect(stage('concept', summary).nextActionLabel).toMatch(/review concept results/i);
  });

  it('marks report draft that is not export-ready as needs review', () => {
    const draft = { ...report, status: 'draft', approvedAt: null, approvedBy: null } satisfies CommercializationReportRecord;
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 12 },
      decisionRecords: [decision],
      conceptTests: [concept],
      conceptResponseCounts: { 'concept-1': 12 },
      commercializationReports: [draft],
      reportReadinessById: { 'report-1': blockedReport },
    });

    expect(stage('report', summary).status).toBe('needs_review');
    expect(stage('report', summary).blockers.join(' ')).toMatch(/report context is incomplete/i);
    expect(stage('report', summary).nextActionRoute).toBe('/project/batch-1/report?report=report-1');
  });

  it('does not surface reports owned by another canonical project', () => {
    const projectDecision = { ...decision, projectId: 'mozza-project' };
    const projectConcept = { ...concept, projectId: 'mozza-project', decisionRecordId: projectDecision.id };
    const summary = workflow({
      importBatches: [{ ...batch, projectId: 'mozza-project' }],
      instrumentalDataset: dataset,
      products: [{ ...product, projectId: 'mozza-project' }],
      responseCountsBySampleId: { S1: 12 },
      decisionRecords: [projectDecision],
      conceptTests: [projectConcept],
      conceptResponseCounts: { 'concept-1': 12 },
      commercializationReports: [{ ...report, canonicalProjectId: 'cashew-project' }],
      reportReadinessById: { 'report-1': readyReport },
    });

    expect(stage('report', summary).status).toBe('not_started');
    expect(stage('report', summary).relatedEntityIds.reportIds).toEqual([]);
    expect(summary.counts.reportsSaved).toBe(0);
  });

  it('shows a report in review as needs review', () => {
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 12 },
      decisionRecords: [decision],
      conceptTests: [concept],
      conceptResponseCounts: { 'concept-1': 12 },
      commercializationReports: [{ ...report, status: 'review', approvedAt: null, approvedBy: null }],
    });

    expect(stage('report', summary).status).toBe('needs_review');
    expect(stage('report', summary).nextActionLabel).toMatch(/open report/i);
  });

  it('keeps the overall status and next action aligned on an item needing review', () => {
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 8 },
      decisionRecords: [decision],
      conceptTests: [concept],
      conceptResponseCounts: { 'concept-1': 12 },
      commercializationReports: [{ ...report, status: 'review', approvedAt: null, approvedBy: null }],
    });

    expect(stage('responses', summary).status).toBe('in_progress');
    expect(stage('report', summary).status).toBe('needs_review');
    expect(summary.overallStatusLabel).toBe('Next: Report');
    expect(summary.nextAction.stageId).toBe('report');
    expect(summary.nextAction.route).toBe('/project/batch-1/report?report=report-1');
  });

  it('marks approved export-ready report as complete', () => {
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 12 },
      decisionRecords: [decision],
      conceptTests: [concept],
      conceptResponseCounts: { 'concept-1': 12 },
      commercializationReports: [report],
      reportReadinessById: { 'report-1': readyReport },
    });

    expect(stage('report', summary).status).toBe('complete');
    expect(stage('report', summary).completedItems).toContain('Strict PDF export context is ready');
  });

  it('marks approved report with changed context as needs review', () => {
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 12 },
      decisionRecords: [decision],
      conceptTests: [{ ...concept, status: 'completed' }],
      conceptResponseCounts: { 'concept-1': 12 },
      commercializationReports: [report],
      reportReadinessById: { 'report-1': staleApprovedReport },
    });

    expect(stage('report', summary).status).toBe('needs_review');
    expect(stage('report', summary).warnings.join(' ')).toMatch(/context changed/i);
    expect(summary.nextAction.route).toBe('/project/batch-1/report?report=report-1');
  });

  it('marks report using reference demo evidence as needs review', () => {
    const summary = workflow({
      importBatches: [batch],
      instrumentalDataset: dataset,
      products: [product],
      responseCountsBySampleId: { S1: 12 },
      decisionRecords: [decision],
      conceptTests: [{ ...concept, status: 'completed' }],
      conceptResponseCounts: { 'concept-1': 12 },
      commercializationReports: [report],
      reportReadinessById: { 'report-1': referenceReport },
    });

    expect(stage('report', summary).status).toBe('needs_review');
    expect(stage('report', summary).warnings.join(' ')).toMatch(/reference\/demo evidence/i);
    expect(stage('report', summary).blockers.join(' ')).toMatch(/Reference\/demo evidence/i);
  });
});
