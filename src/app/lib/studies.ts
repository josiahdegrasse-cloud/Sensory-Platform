import type { Product, QuestionnaireResponse } from '../data/survey-domain';
import type { ConceptTest, ImportBatchRecord } from './database';

export type StudyType = 'product_sensory' | 'multi_sample' | 'concept_test';
export type StudyLifecycleStatus = 'draft' | 'active' | 'closed' | 'archived';

export interface StudyBlocker {
  id: string;
  label: string;
  severity: 'blocker' | 'warning';
}

export interface StudyNextAction {
  label: string;
  description: string;
  href?: string;
}

export interface StudySummary {
  id: string;
  type: StudyType;
  name: string;
  status: StudyLifecycleStatus;
  linkedLabel: string;
  sourceImportBatchId?: string | null;
  sourceImportBatchName?: string | null;
  assignmentLabel: string;
  assignedPanelistCount: number | null;
  openToAll: boolean;
  responseCount: number;
  blockers: StudyBlocker[];
  nextAction: StudyNextAction;
  previewPath: string;
  configurePath?: string;
  createdAt: string;
}

export interface BuildStudySummariesInput {
  products: Product[];
  concepts: ConceptTest[];
  responses: QuestionnaireResponse[];
  conceptResponseCounts?: Record<string, number>;
  importBatches?: ImportBatchRecord[];
}

const DEFAULT_TARGET_RESPONSE_COUNT = 12;

function compact<T>(items: Array<T | null | undefined | false>): T[] {
  return items.filter(Boolean) as T[];
}

export function normalizeProductStatus(status: Product['status']): StudyLifecycleStatus {
  if (status === 'completed') return 'closed';
  return status;
}

export function normalizeConceptStatus(status: ConceptTest['status']): StudyLifecycleStatus {
  if (status === 'active') return 'active';
  if (status === 'completed') return 'closed';
  if (status === 'archived') return 'archived';
  return 'draft';
}

export function validateProductStudy(product: Product): StudyBlocker[] {
  return compact([
    !product.sourceSampleId && {
      id: 'sample-linked',
      label: 'Link this study to a sample/import record',
      severity: 'warning' as const,
    },
    !product.category?.trim() && {
      id: 'category-present',
      label: 'Add food type or category',
      severity: 'blocker' as const,
    },
    !(product.customAttributes?.length) && {
      id: 'sensory-attributes',
      label: 'Select sensory attributes',
      severity: 'blocker' as const,
    },
    {
      id: 'target-response-count',
      label: `Target response count defaulted to ${DEFAULT_TARGET_RESPONSE_COUNT}`,
      severity: 'warning' as const,
    },
  ]);
}

export function validateMultiSampleStudy(product: Product): StudyBlocker[] {
  const samples = product.samples ?? [];
  const codes = samples.map(sample => sample.code.trim()).filter(Boolean);
  return compact([
    samples.length < 2 && {
      id: 'sample-count',
      label: 'Add at least 2 samples',
      severity: 'blocker' as const,
    },
    codes.length !== new Set(codes).size && {
      id: 'unique-sample-codes',
      label: 'Make sample codes unique',
      severity: 'blocker' as const,
    },
    {
      id: 'sample-order',
      label: 'Using compatibility default: fixed sequential sample order',
      severity: 'warning' as const,
    },
    {
      id: 'ranking-task',
      label: 'Ranking and discrimination tasks are included by the existing template',
      severity: 'warning' as const,
    },
  ]);
}

export function validateConceptStudy(concept: ConceptTest): StudyBlocker[] {
  const hasPriceQuestion = concept.questions.some(question =>
    question.category.toLowerCase().includes('price') ||
    question.text.toLowerCase().includes('price')
  );
  const hasImageChoiceQuestion = concept.questions.some(question => question.type === 'image_choice');

  return compact([
    !concept.description?.trim() && {
      id: 'description',
      label: 'Add concept description',
      severity: 'blocker' as const,
    },
    !concept.targetMarket?.trim() && {
      id: 'target-market',
      label: 'Add target market',
      severity: 'blocker' as const,
    },
    hasPriceQuestion && !concept.pricePoint?.trim() && {
      id: 'price-point',
      label: 'Add price point for price questions',
      severity: 'blocker' as const,
    },
    concept.questions.length === 0 && {
      id: 'questions',
      label: 'Add concept test questions',
      severity: 'blocker' as const,
    },
    concept.assignedPanelistIds.length === 0 && {
      id: 'assigned-panelists',
      label: 'Assign panelists before launch',
      severity: 'blocker' as const,
    },
    hasImageChoiceQuestion && concept.imageUrls.length === 0 && {
      id: 'image-choice',
      label: 'Select images for image-choice questions',
      severity: 'blocker' as const,
    },
  ]);
}

function getProductNextAction(product: Product, blockers: StudyBlocker[], responseCount: number): StudyNextAction {
  if (normalizeProductStatus(product.status) === 'archived') {
    return { label: 'Restore study', description: 'Restore it when the team needs access again.' };
  }
  if (normalizeProductStatus(product.status) === 'closed') {
    return { label: 'Analyze results', description: 'Responses are locked for reporting.', href: '/survey-analysis' };
  }
  if (blockers.some(blocker => blocker.severity === 'blocker')) {
    return { label: 'Finish setup', description: blockers.find(blocker => blocker.severity === 'blocker')?.label ?? 'Resolve launch blockers.' };
  }
  if (responseCount === 0) {
    return { label: 'Preview as panelist', description: 'Check the questionnaire before inviting responses.', href: product.isMultiSample ? `/multi-sample-info/${product.id}` : `/questionnaire-info/${product.id}` };
  }
  return { label: 'Monitor responses', description: `${responseCount}/${DEFAULT_TARGET_RESPONSE_COUNT} target responses captured.`, href: '/survey-analysis' };
}

function getConceptNextAction(concept: ConceptTest, blockers: StudyBlocker[], responseCount: number): StudyNextAction {
  const status = normalizeConceptStatus(concept.status);
  if (status === 'archived') return { label: 'Restore from concept testing', description: 'Archived concepts are hidden from default study work.' };
  if (status === 'closed') return { label: 'Analyze concept test', description: 'Concept responses are ready for insights/reporting.', href: '/survey-analysis' };
  if (status === 'draft' || blockers.some(blocker => blocker.severity === 'blocker')) {
    return { label: 'Complete concept setup', description: blockers[0]?.label ?? 'Review questions, imagery, and panel assignment.', href: '/concept-testing' };
  }
  if (responseCount === 0) return { label: 'Preview as panelist', description: 'Validate the panelist flow before fielding.', href: `/concept-survey/${concept.id}` };
  return { label: 'Monitor concept responses', description: `${responseCount}/${concept.panelSize || DEFAULT_TARGET_RESPONSE_COUNT} target responses captured.`, href: '/survey-analysis' };
}

export function adaptProductToStudySummary(
  product: Product,
  responses: QuestionnaireResponse[],
  importBatches: ImportBatchRecord[] = [],
): StudySummary {
  const responseCount = responses.filter(response => response.productId === product.id).length;
  const sourceBatch = product.sourceImportBatchId
    ? importBatches.find(batch => batch.id === product.sourceImportBatchId)
    : undefined;
  const productBlockers = validateProductStudy(product);
  const multiBlockers = product.isMultiSample ? validateMultiSampleStudy(product) : [];
  const blockers = [...productBlockers, ...multiBlockers];
  const assignedCount = product.assignedPanelistIds?.length ?? 0;

  return {
    id: product.id,
    type: product.isMultiSample ? 'multi_sample' : 'product_sensory',
    name: product.name,
    status: normalizeProductStatus(product.status),
    linkedLabel: product.isMultiSample
      ? `${product.samples?.length ?? 0} samples`
      : product.sourceSampleId ?? product.category,
    sourceImportBatchId: product.sourceImportBatchId,
    sourceImportBatchName: sourceBatch?.fileName ?? null,
    assignmentLabel: assignedCount > 0 ? `${assignedCount} assigned` : 'Open to all panelists',
    assignedPanelistCount: assignedCount > 0 ? assignedCount : null,
    openToAll: assignedCount === 0,
    responseCount,
    blockers,
    nextAction: getProductNextAction(product, blockers, responseCount),
    previewPath: product.isMultiSample ? `/multi-sample-info/${product.id}` : `/questionnaire-info/${product.id}`,
    configurePath: '/admin',
    createdAt: product.createdDate,
  };
}

export function adaptConceptToStudySummary(
  concept: ConceptTest,
  conceptResponseCounts: Record<string, number> = {},
): StudySummary {
  const blockers = validateConceptStudy(concept);
  const responseCount = conceptResponseCounts[concept.id] ?? 0;
  const assignedCount = concept.assignedPanelistIds.length;

  return {
    id: concept.id,
    type: 'concept_test',
    name: concept.name,
    status: normalizeConceptStatus(concept.status),
    linkedLabel: concept.projectName ?? concept.category,
    sourceImportBatchId: null,
    sourceImportBatchName: null,
    assignmentLabel: assignedCount > 0 ? `${assignedCount} assigned` : 'Panel not assigned',
    assignedPanelistCount: assignedCount,
    openToAll: false,
    responseCount,
    blockers,
    nextAction: getConceptNextAction(concept, blockers, responseCount),
    previewPath: `/concept-survey/${concept.id}`,
    configurePath: '/concept-testing',
    createdAt: concept.createdAt,
  };
}

export function buildStudySummaries(input: BuildStudySummariesInput): StudySummary[] {
  return [
    ...input.products.map(product => adaptProductToStudySummary(product, input.responses, input.importBatches)),
    ...input.concepts.map(concept => adaptConceptToStudySummary(concept, input.conceptResponseCounts)),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
