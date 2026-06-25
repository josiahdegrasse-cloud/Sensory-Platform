import { useEffect, useMemo, useState } from 'react';
import {
  useAdminConceptTests,
  useCommercializationReports,
  useConceptResponseCounts,
  useDecisionRecords,
  useImportBatches,
  useInstrumentalDataset,
  usePendingImports,
  useProducts,
  useWorkspaceSettings,
} from '../hooks';
import { useSurveyData } from '../use-survey-data';
import {
  buildSavedReportExportContext,
  type ReportReadiness,
} from '../report-context-builder';
import { evaluateProjectWorkflow } from './workflow-evaluator';
import type { ProjectWorkflowSummary } from './workflow-types';

function useWorkflowInputs() {
  const { data: importBatches = [] } = useImportBatches();
  const { data: pendingImports = [] } = usePendingImports();
  const { data: instrumentalDataset } = useInstrumentalDataset();
  const { data: products = [] } = useProducts();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { data: decisionRecords = [] } = useDecisionRecords();
  const { data: conceptTests = [] } = useAdminConceptTests();
  const { data: conceptResponseCounts = {} } = useConceptResponseCounts();
  const { data: commercializationReports = [] } = useCommercializationReports();
  const { liveAggregations } = useSurveyData();

  const responseCountsBySampleId = useMemo(() => {
    const counts: Record<string, number> = {};
    liveAggregations.forEach(aggregation => {
      if (aggregation.sourceSampleId) counts[aggregation.sourceSampleId] = aggregation.n;
    });
    return counts;
  }, [liveAggregations]);

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

export function useProjectWorkflow(foodType: string, importBatchId: string | null): ProjectWorkflowSummary {
  const inputs = useWorkflowInputs();
  const [reportReadinessById, setReportReadinessById] = useState<Record<string, ReportReadiness>>({});

  const candidateReportIds = useMemo(
    () => inputs.commercializationReports
      .filter(report => report.status !== 'archived')
      .map(report => report.id)
      .join('|'),
    [inputs.commercializationReports],
  );

  useEffect(() => {
    let active = true;
    const ids = candidateReportIds.split('|').filter(Boolean).filter(id => !reportReadinessById[id]);
    ids.forEach(id => {
      buildSavedReportExportContext(id)
        .then(result => {
          if (!active) return;
          setReportReadinessById(current => ({ ...current, [id]: result.readiness }));
        })
        .catch(() => {
          if (!active) return;
          setReportReadinessById(current => ({
            ...current,
            [id]: {
              exportReady: false,
              approvalReady: false,
              blockers: ['Saved report context needs review before export.'],
              warnings: [],
              evidenceProvenance: { sensory: 'none', instrumental: 'none', concept: 'none', purchaseIntent: 'none' },
              evidenceBundleStatus: 'missing',
              sensoryStatus: 'Needs review',
              instrumentalStatus: 'Needs review',
              conceptStatus: 'Needs review',
              purchaseIntentStatus: 'Needs review',
              approvalBlockers: ['Saved report context needs review before approval.'],
              exportBlockers: ['Saved report context needs review before export.'],
              qcWarnings: [],
              agentStatus: 'not_run',
            },
          }));
        });
    });
    return () => { active = false; };
  }, [candidateReportIds, reportReadinessById]);

  return useMemo(() => evaluateProjectWorkflow({
    foodType,
    importBatchId,
    reportReadinessById,
    ...inputs,
  }), [foodType, importBatchId, inputs, reportReadinessById]);
}
