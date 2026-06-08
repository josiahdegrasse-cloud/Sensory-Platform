import { useMemo } from 'react';
import {
  useAdminConceptTests,
  useCommercializationReports,
  useDecisionRecords,
  useImportBatches,
  useInstrumentalDataset,
  useProducts,
  useWorkspaceSettings,
} from './hooks';
import { useSurveyData } from './use-survey-data';
import { computeProjectStatus, type ProjectStatusSummary } from './project-status';
import type { ImportBatchRecord } from './database';

/**
 * Bundles every query computeProjectStatus needs so ProjectHeader, the
 * dashboard, and any future report page can derive statuses without each
 * re-wiring the same six hooks.
 */
function useProjectStatusInputs() {
  const { data: importBatches = [] } = useImportBatches();
  const { data: instrumentalDataset } = useInstrumentalDataset();
  const { data: products = [] } = useProducts();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { data: decisionRecords = [] } = useDecisionRecords();
  const { data: conceptTests = [] } = useAdminConceptTests();
  const { data: commercializationReports = [] } = useCommercializationReports();
  const { liveAggregations } = useSurveyData();

  const responseCountsBySampleId = useMemo(() => {
    const counts: Record<string, number> = {};
    liveAggregations.forEach(agg => {
      if (agg.sourceSampleId) counts[agg.sourceSampleId] = agg.n;
    });
    return counts;
  }, [liveAggregations]);

  return {
    importBatches,
    instrumentalDataset,
    products,
    decisionRecords,
    conceptTests,
    commercializationReports,
    responseCountsBySampleId,
    minimumResponses: workspaceSettings?.decisionMinResponses ?? 12,
  };
}

export function useProjectStatus(foodType: string, importBatchId: string | null): ProjectStatusSummary {
  const inputs = useProjectStatusInputs();
  return useMemo(() => computeProjectStatus({ foodType, importBatchId, ...inputs }), [foodType, importBatchId, inputs]);
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
        status: computeProjectStatus({ foodType: batch.foodTypeSlug, importBatchId: batch.id, ...inputs }),
      }))
  ), [inputs]);
}
