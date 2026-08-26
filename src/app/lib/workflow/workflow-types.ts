import type {
  CommercializationReportRecord,
  ConceptTest,
  DecisionRecord,
  EvidenceBundleRecord,
  ImportBatchRecord,
  InstrumentalDataset,
} from '../database';
import type { Product } from '../study-types';
import type { ReportReadiness } from '../report-context-builder';

export type WorkflowStageId =
  | 'data'
  | 'studies'
  | 'responses'
  | 'insights'
  | 'decision'
  | 'concept'
  | 'report';

export type WorkflowStageStatus =
  | 'not_started'
  | 'in_progress'
  | 'needs_review'
  | 'blocked'
  | 'ready'
  | 'complete';

export type WorkflowTone = 'neutral' | 'info' | 'success' | 'warning' | 'critical' | 'creative';

export interface WorkflowStageSummary {
  id: WorkflowStageId;
  label: string;
  status: WorkflowStageStatus;
  blockers: string[];
  warnings: string[];
  completedItems: string[];
  nextActionLabel: string;
  nextActionRoute: string;
  relatedEntityIds: Record<string, string[]>;
  detail: string;
}

export interface WorkflowNextAction {
  label: string;
  description: string;
  route: string;
  stageId: WorkflowStageId;
  tone: WorkflowTone;
}

export interface WorkflowSummaryCounts {
  importedSamples: number;
  activeStudies: number;
  studiesTotal: number;
  responsesCollected: number;
  decisionsRecorded: number;
  conceptsActive: number;
  reportsSaved: number;
}

export interface ProjectWorkflowSummary {
  projectName: string;
  foodTypeLabel: string;
  overallStatusLabel: string;
  overallTone: WorkflowTone;
  stages: WorkflowStageSummary[];
  nextAction: WorkflowNextAction;
  blockers: string[];
  warnings: string[];
  counts: WorkflowSummaryCounts;
  latestDecision: DecisionRecord | null;
  latestReport: CommercializationReportRecord | null;
}

export interface WorkflowEvaluatorInput {
  foodType: string;
  importBatchId: string | null;
  importBatches: ImportBatchRecord[];
  pendingImportCount?: number;
  instrumentalDataset?: InstrumentalDataset;
  products: Product[];
  responseCountsBySampleId: Record<string, number>;
  decisionRecords: DecisionRecord[];
  evidenceBundles?: EvidenceBundleRecord[];
  conceptTests: ConceptTest[];
  conceptResponseCounts?: Record<string, number>;
  commercializationReports: CommercializationReportRecord[];
  reportReadinessById?: Record<string, ReportReadiness>;
  minimumResponses: number;
}
