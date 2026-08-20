import type { Product } from '../data/survey-domain';
import type {
  ConceptTest,
  ETongueMeasurementRecord,
} from './database';
import type { NextAction, ReportStatus } from './project-status';
import { matchFoodType } from '../contexts/food-type-context';
import { conceptBelongsToProject } from './concept-project-scope';

export type InsightsEvidenceLevel = 'Insufficient' | 'Limited' | 'Moderate' | 'Strong';

export interface InsightsEvidenceStrength {
  level: InsightsEvidenceLevel;
  representative: boolean;
  note: string;
  factors: string[];
}

export function deriveInsightsEvidenceStrength(input: {
  liveResponseCount: number;
  minimumResponses: number;
  liveDataFetchFailed?: boolean;
  usesReferenceData?: boolean;
  datasetsPresent: number;
  datasetsExpected?: number;
  hasBlockingWarnings?: boolean;
}): InsightsEvidenceStrength {
  const {
    liveResponseCount,
    minimumResponses,
    liveDataFetchFailed = false,
    usesReferenceData = false,
    datasetsPresent,
    datasetsExpected = 3,
    hasBlockingWarnings = false,
  } = input;
  const factors = [
    `${liveResponseCount} live panel response${liveResponseCount === 1 ? '' : 's'}.`,
    `${datasetsPresent} of ${datasetsExpected} instrumental datasets available.`,
  ];

  if (liveDataFetchFailed) {
    return {
      level: 'Insufficient',
      representative: false,
      note: 'Live panel responses could not be loaded. Do not use the displayed reference evidence for client decisions.',
      factors: [...factors, 'Live response loading failed.'],
    };
  }

  if (usesReferenceData || liveResponseCount === 0) {
    return {
      level: 'Insufficient',
      representative: false,
      note: usesReferenceData
        ? 'Reference/demo evidence is shown for orientation only and is not client panel evidence.'
        : 'No live panel responses are available yet.',
      factors: [...factors, usesReferenceData ? 'Reference/demo sensory data is in use.' : 'Live sensory evidence is missing.'],
    };
  }

  if (liveResponseCount < minimumResponses) {
    return {
      level: 'Limited',
      representative: false,
      note: liveResponseCount === 1
        ? 'Directional only: one response is available and should not be treated as representative.'
        : `Directional only: ${liveResponseCount} responses are available, below the ${minimumResponses}-response decision threshold.`,
      factors: [...factors, `${minimumResponses - liveResponseCount} additional responses are needed to reach the configured threshold.`],
    };
  }

  if (datasetsPresent < datasetsExpected || hasBlockingWarnings) {
    return {
      level: 'Moderate',
      representative: true,
      note: 'The panel response threshold has been reached, but supporting evidence is incomplete.',
      factors: [...factors, 'One or more supporting datasets or quality checks remain incomplete.'],
    };
  }

  return {
    level: 'Strong',
    representative: true,
    note: 'The configured panel threshold and expected instrumental evidence are available.',
    factors,
  };
}

export function filterProjectInstrumentSamples(
  samples: ETongueMeasurementRecord[],
  foodType: string,
  importBatchId: string | null,
) {
  return samples.filter(sample =>
    (foodType === 'all' || sample.type === foodType) &&
    (!importBatchId || sample.importBatchId === importBatchId)
  );
}

export function filterProjectProducts(
  products: Product[],
  sampleIds: Set<string>,
  foodType: string,
  importBatchId: string | null,
  projectId?: string | null,
) {
  return products.filter(product => {
    if (product.status === 'archived') return false;
    if (projectId && product.projectId === projectId) return true;
    if (importBatchId) return product.sourceImportBatchId === importBatchId;
    if (product.sourceSampleId && sampleIds.has(product.sourceSampleId)) return true;
    return foodType === 'all' || matchFoodType(product.category) === foodType;
  });
}

function normalizedProjectName(value?: string | null) {
  return (value ?? '').trim().toLowerCase().replace(/\.csv$/i, '');
}

export function filterProjectConceptTests(
  tests: ConceptTest[],
  input: { foodType: string; importBatchId: string | null; projectId?: string | null; projectName?: string | null },
) {
  const active = tests.filter(test => test.status !== 'archived');
  if (input.projectId) {
    return active.filter(test => conceptBelongsToProject(test, input.projectId));
  }
  const projectName = normalizedProjectName(input.projectName);
  if (input.importBatchId && projectName) {
    return active.filter(test => normalizedProjectName(test.projectName) === projectName);
  }
  return active.filter(test =>
    input.foodType === 'all' ||
    test.foodTypeSlug === input.foodType ||
    (!test.foodTypeSlug && matchFoodType(test.category) === input.foodType)
  );
}

export function deriveInsightsNextAction(input: {
  fallback: NextAction;
  hasInstrumentData: boolean;
  productCount: number;
  liveResponseCount: number;
  minimumResponses: number;
  decision?: 'GO' | 'TWEAK' | 'STOP' | null;
  conceptCount: number;
  conceptResponseCount: number;
  reportStatus: ReportStatus;
}): NextAction {
  if (!input.hasInstrumentData) {
    return { label: 'Import instrumental data', description: 'Add machine evidence before interpreting product performance.', path: '/stage1', tone: 'info' };
  }
  if (input.productCount === 0) {
    return { label: 'Create the survey', description: 'Turn the imported sample into a panelist questionnaire.', path: '/admin', tone: 'info' };
  }
  if (input.liveResponseCount < input.minimumResponses) {
    const remaining = Math.max(input.minimumResponses - input.liveResponseCount, 0);
    return {
      label: 'Collect more responses',
      description: `${remaining} more response${remaining === 1 ? '' : 's'} needed before the configured decision threshold is reached.`,
      path: '/admin',
      tone: 'warning',
    };
  }
  if (!input.decision) {
    return { label: 'Review the decision', description: 'Evidence is ready for a deterministic GO / TWEAK / STOP review.', path: '/decision', tone: 'info' };
  }
  if (input.decision === 'TWEAK') {
    return { label: 'Review adjustments', description: 'Use the saved decision rationale to plan the next formulation round.', path: '/decision', tone: 'warning' };
  }
  if (input.decision === 'STOP') {
    return { label: 'Review the STOP rationale', description: 'Confirm why this sample stopped before planning another test.', path: '/decision', tone: 'critical' };
  }
  if (input.conceptCount === 0) {
    return { label: 'Build a concept', description: 'The product has a GO decision and is ready for concept development.', path: '/concept-testing', tone: 'creative' };
  }
  if (input.conceptResponseCount < input.minimumResponses) {
    return { label: 'Collect concept feedback', description: 'Continue concept testing before treating the direction as representative.', path: '/concept-testing', tone: 'warning' };
  }
  if (input.reportStatus === 'review') {
    return { label: 'Review the report', description: 'The commercialization report is waiting for approval.', path: '/report', tone: 'warning' };
  }
  if (input.reportStatus === 'draft') {
    return { label: 'Finish the report', description: 'Complete the saved commercialization report draft.', path: '/report', tone: 'info' };
  }
  return input.fallback;
}

export function canShowInferentialStatistics(responseCount: number, usesReferenceData: boolean) {
  return !usesReferenceData && responseCount >= 5;
}
