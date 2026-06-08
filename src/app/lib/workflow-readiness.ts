import type { Product } from '../data/mock-users';
import type { ImportBatchRecord, InstrumentalDataset } from './database';

export type WorkflowStageState = 'complete' | 'current' | 'blocked';

export interface SampleWorkflowReadiness {
  sampleId: string;
  sampleName: string;
  responseCount: number;
  decisionReady: boolean;
  blockers: string[];
  stages: Array<{
    id: 'import' | 'questionnaire' | 'assignment' | 'responses' | 'decision';
    label: string;
    state: WorkflowStageState;
    detail: string;
  }>;
}

export interface DataIntegrityIssue {
  id: string;
  severity: 'warning' | 'error';
  message: string;
}

export function assessSampleWorkflow(input: {
  sample: InstrumentalDataset['eTongueData'][number];
  product?: Product;
  responseCount: number;
  minimumResponses: number;
  hasGcms: boolean;
  hasComposition: boolean;
}): SampleWorkflowReadiness {
  const { sample, product, responseCount, minimumResponses, hasGcms, hasComposition } = input;
  const assignedCount = product?.assignedPanelistIds?.length ?? 0;
  const blockers: string[] = [];
  if (!product) blockers.push('Create a questionnaire for this sample.');
  if (product && assignedCount === 0) blockers.push('Assign the questionnaire to panelists.');
  if (product && responseCount < minimumResponses) {
    blockers.push(`${minimumResponses - responseCount} more completed response${minimumResponses - responseCount === 1 ? '' : 's'} required.`);
  }
  if (!hasGcms) blockers.push('GC-MS data is missing; aroma risk confidence will be reduced.');
  if (!hasComposition) blockers.push('Composition data is missing; formulation confidence will be reduced.');

  const decisionReady = Boolean(product) && assignedCount > 0 && responseCount >= minimumResponses;
  return {
    sampleId: sample.sampleId,
    sampleName: sample.sampleName || sample.sampleId,
    responseCount,
    decisionReady,
    blockers,
    stages: [
      { id: 'import', label: 'Imported', state: 'complete', detail: 'Machine sample saved.' },
      {
        id: 'questionnaire',
        label: 'Questionnaire',
        state: product ? 'complete' : 'current',
        detail: product ? 'Questionnaire created.' : 'Create the questionnaire.',
      },
      {
        id: 'assignment',
        label: 'Assignment',
        state: assignedCount > 0 ? 'complete' : product ? 'current' : 'blocked',
        detail: assignedCount > 0 ? `${assignedCount} panelist${assignedCount === 1 ? '' : 's'} assigned.` : 'No panelists assigned.',
      },
      {
        id: 'responses',
        label: 'Responses',
        state: responseCount >= minimumResponses ? 'complete' : assignedCount > 0 ? 'current' : 'blocked',
        detail: `${responseCount}/${minimumResponses} completed.`,
      },
      {
        id: 'decision',
        label: 'Decision',
        state: decisionReady ? 'complete' : 'blocked',
        detail: decisionReady ? 'GO / TWEAK / STOP available.' : 'Waiting for required evidence.',
      },
    ],
  };
}

export function findDataIntegrityIssues(input: {
  dataset?: InstrumentalDataset;
  products: Product[];
  importBatches: ImportBatchRecord[];
}): DataIntegrityIssue[] {
  const { dataset, products, importBatches } = input;
  const samples = dataset?.eTongueData ?? [];
  const issues: DataIntegrityIssue[] = [];
  const sampleIds = new Set<string>();
  const batchIds = new Set(importBatches.map(batch => batch.id));

  samples.forEach(sample => {
    if (sampleIds.has(sample.sampleId)) {
      issues.push({ id: `duplicate:${sample.sampleId}`, severity: 'error', message: `Duplicate sample ID: ${sample.sampleId}.` });
    }
    sampleIds.add(sample.sampleId);
    if (sample.importBatchId && !batchIds.has(sample.importBatchId)) {
      issues.push({ id: `orphan-sample:${sample.sampleId}`, severity: 'error', message: `${sample.sampleId} references a missing import project.` });
    }
  });

  products.forEach(product => {
    if (product.sourceSampleId && !sampleIds.has(product.sourceSampleId)) {
      // Only flag if the source batch is also gone — if the batch exists but is archived/deleted
      // the sample is simply inactive (not orphaned) and will recover when the batch is restored.
      const batchGone = product.sourceImportBatchId && !batchIds.has(product.sourceImportBatchId);
      if (batchGone || !product.sourceImportBatchId) {
        issues.push({ id: `orphan-survey:${product.id}`, severity: 'warning', message: `${product.name} references a sample that is not active.` });
      }
    }
    if (product.sourceImportBatchId && !batchIds.has(product.sourceImportBatchId)) {
      issues.push({ id: `orphan-product-batch:${product.id}`, severity: 'error', message: `${product.name} references a missing import project.` });
    }
  });

  return issues;
}
