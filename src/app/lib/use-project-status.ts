import { useMemo } from 'react';
import {
  useAdminConceptTests,
  useCommercializationReports,
  useConceptResponseCounts,
  useDecisionRecords,
  useImportBatches,
  useInstrumentalDataset,
  usePendingImports,
  useProducts,
  useResponseCountsByProduct,
  useWorkspaceSettings,
} from './hooks';
import type { ProjectStatusSummary, WorkflowStageState, ReportStatus, DecisionStatus, SemanticTone } from './project-status';
import type { ImportBatchRecord } from './database';
import { evaluateProjectWorkflow } from './workflow/workflow-evaluator';
import type { ProjectWorkflowSummary, WorkflowStageStatus } from './workflow/workflow-types';
import { workflowToneToSemanticTone } from './workflow/workflow-actions';

/**
 * Bundles every query the canonical workflow evaluator needs so the dashboard
 * and report pages derive status from one workflow model.
 */
function useProjectStatusInputs() {
  const { data: importBatches = [] } = useImportBatches();
  const { data: pendingImports = [] } = usePendingImports();
  const { data: instrumentalDataset } = useInstrumentalDataset();
  const { data: products = [] } = useProducts();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { data: decisionRecords = [] } = useDecisionRecords();
  const { data: conceptTests = [] } = useAdminConceptTests();
  const { data: conceptResponseCounts = {} } = useConceptResponseCounts();
  const { data: commercializationReports = [] } = useCommercializationReports();
  const { data: responseCountsByProduct = {} } = useResponseCountsByProduct();

  const responseCountsBySampleId = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(product => {
      if (!product.sourceSampleId) return;
      counts[product.sourceSampleId] = (
        (counts[product.sourceSampleId] ?? 0)
        + (responseCountsByProduct[product.id] ?? 0)
      );
    });
    return counts;
  }, [products, responseCountsByProduct]);

  return {
    importBatches,
    pendingImportCount: pendingImports.length,
    instrumentalDataset,
    products,
    decisionRecords,
    conceptTests,
    conceptResponseCounts,
    commercializationReports,
    responseCountsBySampleId,
    minimumResponses: workspaceSettings?.decisionMinResponses ?? 12,
  };
}

function stageState(status: WorkflowStageStatus): WorkflowStageState {
  switch (status) {
    case 'complete': return 'complete';
    case 'ready': return 'available';
    case 'in_progress': return 'current';
    case 'needs_review': return 'needs-review';
    case 'blocked': return 'blocked';
    case 'not_started':
    default:
      return 'not-started';
  }
}

function reportStatus(summary: ProjectWorkflowSummary): ReportStatus {
  if (summary.latestReport?.status === 'approved') return 'approved';
  if (summary.latestReport?.status === 'review') return 'review';
  if (summary.latestReport?.status === 'draft') return 'draft';
  return 'not-ready';
}

function adaptWorkflowToProjectStatus(summary: ProjectWorkflowSummary, minimumResponses: number): ProjectStatusSummary {
  const importedDatasets = summary.stages.find(stage => stage.id === 'data')?.completedItems ?? [];
  const datasetsPresent = [
    importedDatasets.some(item => /machine sample/i.test(item)),
    importedDatasets.some(item => /GC-MS/i.test(item)),
    importedDatasets.some(item => /Composition/i.test(item)),
  ].filter(Boolean).length;
  const responseTarget = Math.max(summary.counts.studiesTotal, 1) * minimumResponses;
  const latestDecision = summary.latestDecision;
  const decisionStatus: DecisionStatus = latestDecision?.decision ?? (summary.stages.find(stage => stage.id === 'decision')?.status === 'ready' ? 'Pending' : 'Not started');
  const decisionTone: SemanticTone = latestDecision
    ? latestDecision.decision === 'GO' ? 'success' : latestDecision.decision === 'TWEAK' ? 'warning' : 'critical'
    : decisionStatus === 'Pending' ? 'info' : 'neutral';

  return {
    projectName: summary.projectName,
    foodTypeLabel: summary.foodTypeLabel,
    statusLabel: summary.overallStatusLabel,
    statusTone: workflowToneToSemanticTone(summary.overallTone),
    responseCompleted: summary.counts.responsesCollected,
    responseTarget,
    issfScore: latestDecision?.issfScore ?? null,
    decisionStatus,
    decisionTone,
    confidence: datasetsPresent === 0 ? null : datasetsPresent === 3 && summary.counts.responsesCollected >= responseTarget ? 'High' : datasetsPresent === 1 ? 'Low' : 'Moderate',
    confidenceFactors: [
      `${datasetsPresent} of 3 instrument datasets imported.`,
      `${summary.counts.responsesCollected} of ${responseTarget} target panel responses collected.`,
      ...summary.warnings,
    ],
    datasetsPresent,
    datasetsExpected: 3,
    conceptName: summary.stages.find(stage => stage.id === 'concept')?.completedItems[0]?.replace(/ concept exists$/i, '') ?? null,
    reportStatus: reportStatus(summary),
    latestReport: summary.latestReport,
    stages: summary.stages.map(stage => ({
      id: stage.id,
      label: stage.label,
      state: stageState(stage.status),
      detail: stage.detail,
      path: stage.nextActionRoute,
    })),
    nextAction: {
      label: summary.nextAction.label,
      description: summary.nextAction.description,
      path: summary.nextAction.route,
      tone: workflowToneToSemanticTone(summary.nextAction.tone),
    },
    warnings: summary.warnings,
  };
}

export function useProjectStatus(foodType: string, importBatchId: string | null): ProjectStatusSummary {
  const inputs = useProjectStatusInputs();
  return useMemo(() => adaptWorkflowToProjectStatus(
    evaluateProjectWorkflow({ foodType, importBatchId, ...inputs }),
    inputs.minimumResponses,
  ), [foodType, importBatchId, inputs]);
}

export interface ProjectStatusListEntry {
  batch: ImportBatchRecord;
  status: ProjectStatusSummary;
}

/** One status summary per active import batch — the basis of the project dashboard. */
export function useProjectStatusList(): ProjectStatusListEntry[] {
  const inputs = useProjectStatusInputs();
  return useMemo(() => (
    inputs.importBatches
      .filter(batch => batch.status === 'active')
      .map(batch => ({
        batch,
        status: adaptWorkflowToProjectStatus(
          evaluateProjectWorkflow({ foodType: batch.foodTypeSlug, importBatchId: batch.id, ...inputs }),
          inputs.minimumResponses,
        ),
      }))
  ), [inputs]);
}
