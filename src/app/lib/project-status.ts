import type { ImportBatchRecord, InstrumentalDataset, DecisionRecord, ConceptTest, CommercializationReportRecord } from './database';
import type { Product } from '../data/survey-domain';
import { formatFoodTypeLabel } from './food-intelligence';
import { projectStatusStagePath } from './project-journey-routes';
import { sampleMatchesFoodType } from '../contexts/food-type-context';
import { conceptBelongsToProject } from './concept-project-scope';
import { reportBelongsToProject } from './report-project-scope';

export type WorkflowStageId = 'data' | 'studies' | 'responses' | 'testing' | 'insights' | 'decision' | 'concept' | 'report';
export type WorkflowStageState = 'complete' | 'current' | 'needs-review' | 'available' | 'blocked' | 'not-started';

/** Semantic status palette shared across workflow chips, badges, cards, and buttons. */
export type SemanticTone = 'neutral' | 'info' | 'success' | 'warning' | 'critical' | 'creative';

export interface WorkflowStageStatus {
  id: WorkflowStageId;
  label: string;
  state: WorkflowStageState;
  detail: string;
  path: string;
}

export interface NextAction {
  label: string;
  description: string;
  path: string;
  tone: SemanticTone;
}

export type DecisionStatus = 'GO' | 'TWEAK' | 'STOP' | 'Pending' | 'Not started';

/** Qualitative evidence confidence — derived from completeness, never a fake percentage. */
export type ConfidenceLevel = 'High' | 'Moderate' | 'Low';

export type ReportStatus = 'not-ready' | 'draft' | 'review' | 'approved';

export interface ProjectStatusSummary {
  projectName: string;
  foodTypeLabel: string;
  statusLabel: string;
  statusTone: SemanticTone;
  responseCompleted: number;
  responseTarget: number;
  issfScore: number | null;
  decisionStatus: DecisionStatus;
  decisionTone: SemanticTone;
  /** Null until any evidence exists for the project. */
  confidence: ConfidenceLevel | null;
  /** Plain-language facts behind the confidence level (shown in a tooltip). */
  confidenceFactors: string[];
  /** Instrument dataset completeness: how many of the 3 expected sets are present. */
  datasetsPresent: number;
  datasetsExpected: number;
  /** Name of the launched concept test, when one exists. */
  conceptName: string | null;
  reportStatus: ReportStatus;
  latestReport: CommercializationReportRecord | null;
  stages: WorkflowStageStatus[];
  nextAction: NextAction;
  warnings: string[];
}

const STAGE_LABELS: Record<WorkflowStageId, string> = {
  data: 'Data',
  studies: 'Studies',
  responses: 'Responses',
  testing: 'Testing',
  insights: 'Insights',
  decision: 'Decision',
  concept: 'Concept',
  report: 'Report',
};

interface ComputeProjectStatusInput {
  foodType: string;
  importBatchId: string | null;
  importBatches: ImportBatchRecord[];
  instrumentalDataset?: InstrumentalDataset;
  products: Product[];
  /** Live response counts keyed by sample id (from useSurveyData liveAggregations). */
  responseCountsBySampleId: Record<string, number>;
  decisionRecords: DecisionRecord[];
  conceptTests: ConceptTest[];
  commercializationReports: CommercializationReportRecord[];
  minimumResponses: number;
}

function tone(state: WorkflowStageState): SemanticTone {
  switch (state) {
    case 'complete': return 'success';
    case 'current': return 'info';
    case 'needs-review': return 'warning';
    case 'blocked': return 'critical';
    case 'available': return 'neutral';
    default: return 'neutral';
  }
}

function pickProjectName(input: ComputeProjectStatusInput): string {
  const batch = input.importBatchId
    ? input.importBatches.find(b => b.id === input.importBatchId)
    : input.importBatches.find(b => b.foodTypeSlug === input.foodType && b.status === 'active');
  // Prefer the real project's name; fall back to the batch file name, then food type.
  if (batch) return batch.projectName ?? batch.fileName.replace(/\.csv$/i, '');
  return `${formatFoodTypeLabel(input.foodType)} Project`;
}

/**
 * Derive the live workflow state for a project/import batch from the data we
 * actually have on hand, rather than hard-coding stage progress. Each rule
 * mirrors a concrete readiness check elsewhere in the app (assessSampleWorkflow,
 * decisionMinResponses, etc.) so the header and the underlying pages never
 * disagree about "what's done."
 *
 * The "report" stage follows the report record's real lifecycle: draft is
 * in-progress, 'review' surfaces as needs-review, and only 'approved'
 * completes the stage.
 */
export function computeProjectStatus(input: ComputeProjectStatusInput): ProjectStatusSummary {
  const {
    foodType, importBatchId, instrumentalDataset, products,
    responseCountsBySampleId, decisionRecords, conceptTests, commercializationReports,
    minimumResponses,
  } = input;

  const batch = importBatchId
    ? input.importBatches.find(b => b.id === importBatchId) ?? null
    : input.importBatches.find(b => b.foodTypeSlug === foodType && b.status === 'active') ?? null;
  const routeProjectId = batch?.projectId ?? batch?.id ?? null;
  const canonicalProjectId = batch?.projectId ?? null;
  const pathFor = (stageId: WorkflowStageId) => projectStatusStagePath(stageId, routeProjectId);
  const projectName = pickProjectName(input);
  const foodTypeLabel = formatFoodTypeLabel(foodType);

  const samples = (instrumentalDataset?.eTongueData ?? []).filter(sample =>
    sample.type === foodType && (!importBatchId || sample.importBatchId === importBatchId)
  );
  const sampleIds = new Set(samples.map(s => s.sampleId));

  // ---- Decisions for this project ----
  // Match on imported sample ids first; fall back to food-type matching so that
  // decisions made against the reference/demo dataset (which isn't part of any
  // import batch) still surface here the same way they do on the Decision page.
  const projectDecisions = decisionRecords.filter(record => (
    canonicalProjectId
      ? record.projectId === canonicalProjectId
      : sampleIds.has(record.sampleId)
        || (!importBatchId && sampleMatchesFoodType(record.sampleId, record.sampleName) === foodType)
  ));
  const latestDecision = projectDecisions[0] ?? null; // fetchDecisionRecords orders by recency

  // The response/ISSF metrics must describe the same samples the decision does.
  // A reference decision surfaced by the food-type fallback references a sample
  // that isn't in this view's instrumental set, so counting responses only over
  // `sampleIds` would show "0 responses" next to a GO/ISSF — a contradiction the
  // workflow can't actually produce (a decision requires its sample's responses).
  // Folding the decision samples into the population keeps the numbers in sync.
  // It's a strict superset of `sampleIds`, so a reference decision is never hidden.
  const populationSampleIds = new Set(sampleIds);
  projectDecisions.forEach(record => populationSampleIds.add(record.sampleId));

  const projectProducts = products.filter(product =>
    product.status !== 'archived' &&
    (
      (batch?.projectId ? product.projectId === batch.projectId : false) ||
      (importBatchId ? product.sourceImportBatchId === importBatchId : false) ||
      (product.sourceSampleId ? populationSampleIds.has(product.sourceSampleId) : false)
    )
  );

  // ---- Data stage: required datasets present for at least one sample ----
  const hasEtongue = samples.length > 0;
  const hasGcms = samples.some(s => (instrumentalDataset?.gcmsData[s.sampleId]?.length ?? 0) > 0);
  const hasComposition = samples.some(s => Boolean(instrumentalDataset?.compositionData[s.sampleId]));
  const dataComplete = hasEtongue && hasGcms && hasComposition;
  const dataState: WorkflowStageState = dataComplete ? 'complete' : hasEtongue ? 'current' : 'not-started';

  // ---- Testing stage: a survey exists and has reached the minimum responses ----
  const responseCompleted = projectProducts.reduce((sum, product) => {
    const sampleId = product.sourceSampleId ?? '';
    return sum + (responseCountsBySampleId[sampleId] ?? 0);
  }, 0);
  const responseTarget = Math.max(projectProducts.length, 1) * minimumResponses;
  const testingComplete = projectProducts.length > 0 && projectProducts.every(product =>
    (responseCountsBySampleId[product.sourceSampleId ?? ''] ?? 0) >= minimumResponses
  );
  const testingState: WorkflowStageState = testingComplete
    ? 'complete'
    : projectProducts.length > 0
      ? 'current'
      : dataState === 'complete' || dataState === 'current'
        ? 'available'
        : 'blocked';

  // ---- Insights stage: enough survey + instrumental data exists to analyze ----
  const insightsComplete = testingComplete && hasEtongue;
  const insightsState: WorkflowStageState = insightsComplete
    ? 'complete'
    : testingState === 'complete' || testingState === 'current'
      ? 'current'
      : 'blocked';

  // ---- Decision stage: a decision record exists for one of this project's samples ----
  const decisionState: WorkflowStageState = latestDecision
    ? 'complete'
    : insightsState === 'complete'
      ? 'current'
      : insightsState === 'current'
        ? 'available'
        : 'blocked';

  // ---- Concept stage: a concept test exists/has launched for this project ----
  const projectConcepts = conceptTests.filter(concept =>
    conceptBelongsToProject(concept, canonicalProjectId) &&
    (concept.foodTypeSlug ? concept.foodTypeSlug === foodType : true) &&
    concept.status !== 'archived'
  );
  const launchedConcept = projectConcepts.find(concept => Boolean(concept.launchedAt) || concept.status === 'active' || concept.status === 'completed');
  const conceptComplete = Boolean(launchedConcept);
  // An AI-drafted concept awaiting admin approval turns the stage amber: a
  // human decision is queued, which is a different signal than "in progress."
  const conceptInReview = projectConcepts.find(concept => concept.status === 'review');
  const goDecision = latestDecision?.decision === 'GO';
  const conceptState: WorkflowStageState = conceptComplete
    ? 'complete'
    : conceptInReview
      ? 'needs-review'
      : goDecision
        ? 'current'
        : decisionState === 'complete'
          ? 'available'
          : 'blocked';

  // ---- Report stage: driven by the latest report record's real status ----
  const projectReports = commercializationReports.filter(report =>
    report.status !== 'archived' &&
    reportBelongsToProject(report, canonicalProjectId) &&
    report.decisionRecordId && projectDecisions.some(decision => decision.id === report.decisionRecordId)
  );
  const latestReport = projectReports[0] ?? null; // fetchCommercializationReports orders by recency
  const reportStatus: ReportStatus = latestReport
    ? (latestReport.status as Exclude<CommercializationReportRecord['status'], 'archived'>)
    : 'not-ready';
  const reportComplete = reportStatus === 'approved';
  const reportState: WorkflowStageState = reportComplete
    ? 'complete'
    : reportStatus === 'review'
      ? 'needs-review'
      : reportStatus === 'draft'
        ? 'current'
        : conceptState === 'complete'
          ? 'current'
          : conceptState === 'current' || conceptState === 'needs-review'
            ? 'available'
            : 'blocked';

  const stages: WorkflowStageStatus[] = [
    { id: 'data', label: STAGE_LABELS.data, state: dataState, path: pathFor('data'), detail: dataComplete ? 'All required datasets imported.' : hasEtongue ? 'E-tongue data imported; GC-MS / composition still pending.' : 'No instrumental data imported yet.' },
    { id: 'testing', label: STAGE_LABELS.testing, state: testingState, path: pathFor('testing'), detail: projectProducts.length === 0 ? 'No survey created for this project yet.' : `${responseCompleted}/${responseTarget} responses collected.` },
    { id: 'insights', label: STAGE_LABELS.insights, state: insightsState, path: pathFor('insights'), detail: insightsComplete ? 'Survey and instrumental data ready to analyze.' : 'Waiting on enough responses and instrumental data.' },
    { id: 'decision', label: STAGE_LABELS.decision, state: decisionState, path: pathFor('decision'), detail: latestDecision ? `${latestDecision.decision} recorded at ISSF ${latestDecision.issfScore.toFixed(0)}.` : 'Awaiting a GO / TWEAK / STOP decision.' },
    { id: 'concept', label: STAGE_LABELS.concept, state: conceptState, path: pathFor('concept'), detail: launchedConcept ? `${launchedConcept.name} sent to consumers.` : conceptInReview ? `${conceptInReview.name} drafted by AI — awaiting your approval.` : goDecision ? 'GO decision confirmed — ready to build a concept.' : 'Unlocks once a sample gets a GO decision.' },
    { id: 'report', label: STAGE_LABELS.report, state: reportState, path: pathFor('report'), detail:
        reportStatus === 'approved' ? 'Commercialization report approved.'
        : reportStatus === 'review' ? 'Report drafted — awaiting approval.'
        : reportStatus === 'draft' ? 'Report draft in progress.'
        : 'Unlocks once a concept test is underway.' },
  ];

  // ---- Roll up an overall status label + tone ----
  let statusLabel = 'Awaiting data';
  let statusTone: SemanticTone = 'neutral';
  if (reportStatus === 'approved') { statusLabel = 'Report approved'; statusTone = 'success'; }
  else if (reportStatus === 'review') { statusLabel = 'Report in review'; statusTone = 'warning'; }
  else if (reportStatus === 'draft') { statusLabel = 'Report drafted'; statusTone = 'info'; }
  else if (conceptComplete) { statusLabel = 'Concept testing'; statusTone = 'creative'; }
  else if (latestDecision) { statusLabel = `Decision: ${latestDecision.decision}`; statusTone = latestDecision.decision === 'GO' ? 'success' : latestDecision.decision === 'TWEAK' ? 'warning' : 'critical'; }
  else if (insightsComplete) { statusLabel = 'Ready for decision'; statusTone = 'info'; }
  else if (projectProducts.length > 0) { statusLabel = 'Survey running'; statusTone = 'info'; }
  else if (hasEtongue) { statusLabel = 'Data imported'; statusTone = 'info'; }

  // ---- Decision status + tone ----
  const decisionStatus: DecisionStatus = latestDecision ? latestDecision.decision : insightsComplete ? 'Pending' : 'Not started';
  const decisionTone: SemanticTone = latestDecision
    ? latestDecision.decision === 'GO' ? 'success' : latestDecision.decision === 'TWEAK' ? 'warning' : 'critical'
    : insightsComplete ? 'info' : 'neutral';

  // ---- Next recommended action ----
  const currentStage = stages.find(s => s.state === 'current') ?? stages.find(s => s.state === 'available');
  let nextAction: NextAction;
  if (!hasEtongue) {
    nextAction = { label: 'Import instrumental data', description: 'Upload an E-tongue / GC-MS export to start this project.', path: pathFor('data'), tone: 'info' };
  } else if (projectProducts.length === 0) {
    nextAction = { label: 'Create the survey', description: 'Turn this sample into a panelist questionnaire.', path: pathFor('testing'), tone: 'info' };
  } else if (!testingComplete) {
    nextAction = { label: 'Collect responses', description: `${Math.max(responseTarget - responseCompleted, 0)} more response${responseTarget - responseCompleted === 1 ? '' : 's'} needed before analysis.`, path: pathFor('testing'), tone: 'info' };
  } else if (!latestDecision) {
    nextAction = { label: 'Review results', description: 'Survey is complete — review insights and make the call.', path: pathFor('insights'), tone: 'info' };
  } else if (latestDecision.decision === 'GO' && !conceptComplete) {
    nextAction = { label: 'Build a concept', description: 'This sample got a GO — generate a concept test for consumers.', path: pathFor('concept'), tone: 'creative' };
  } else if (latestDecision.decision === 'TWEAK') {
    nextAction = { label: 'Plan the tweak', description: 'Review the recommended adjustments and re-test when ready.', path: pathFor('decision'), tone: 'warning' };
  } else if (latestDecision.decision === 'STOP') {
    nextAction = { label: 'Review the STOP rationale', description: 'See why this sample stopped and what to try next.', path: pathFor('decision'), tone: 'critical' };
  } else if (reportStatus === 'review') {
    nextAction = { label: 'Review the report', description: 'A drafted commercialization report is waiting for your approval.', path: pathFor('report'), tone: 'warning' };
  } else if (reportStatus === 'draft') {
    nextAction = { label: 'Finish the report draft', description: 'Pick up the commercialization report where you left off.', path: pathFor('report'), tone: 'info' };
  } else if (conceptComplete && !reportComplete) {
    nextAction = { label: 'Write the commercialization report', description: 'Concept testing is underway — start drafting the launch report.', path: pathFor('report'), tone: 'info' };
  } else if (currentStage) {
    nextAction = { label: `Go to ${currentStage.label}`, description: currentStage.detail, path: currentStage.path, tone: tone(currentStage.state) };
  } else {
    nextAction = { label: 'Review project', description: 'Everything looks complete — review the latest results.', path: pathFor('insights'), tone: 'neutral' };
  }

  // ---- Warnings ----
  const warnings: string[] = [];
  if (hasEtongue && !hasGcms) warnings.push('GC-MS data missing — aroma risk confidence will be reduced.');
  if (hasEtongue && !hasComposition) warnings.push('Composition data missing — formulation confidence will be reduced.');
  // ---- Confidence: a qualitative read on evidence completeness ----
  // Derived from facts the engine already knows (datasets, response counts,
  // warnings), never from a model. Null until any evidence exists.
  const datasetsPresent = [hasEtongue, hasGcms, hasComposition].filter(Boolean).length;
  const datasetsExpected = 3;
  let confidence: ConfidenceLevel | null = null;
  const confidenceFactors: string[] = [];
  if (hasEtongue) {
    confidenceFactors.push(`${datasetsPresent} of ${datasetsExpected} instrument datasets imported.`);
    if (projectProducts.length > 0) {
      confidenceFactors.push(`${responseCompleted} of ${responseTarget} panel responses collected.`);
    } else {
      confidenceFactors.push('No panel survey created yet.');
    }
    confidenceFactors.push(...warnings);
    if (datasetsPresent === datasetsExpected && testingComplete && warnings.length === 0) {
      confidence = 'High';
    } else if (datasetsPresent <= 1 || (projectProducts.length > 0 && responseCompleted < responseTarget / 2)) {
      confidence = 'Low';
    } else {
      confidence = 'Moderate';
    }
  }

  return {
    projectName,
    foodTypeLabel,
    statusLabel,
    statusTone,
    responseCompleted,
    responseTarget,
    issfScore: latestDecision?.issfScore ?? null,
    decisionStatus,
    decisionTone,
    confidence,
    confidenceFactors,
    datasetsPresent,
    datasetsExpected,
    conceptName: launchedConcept?.name ?? null,
    reportStatus,
    latestReport,
    stages,
    nextAction,
    warnings,
  };
}
