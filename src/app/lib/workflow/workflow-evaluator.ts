import { sampleMatchesFoodType } from '../../contexts/food-type-context';
import { getProductAssignmentMode } from '../assignments';
import { formatFoodTypeLabel } from '../food-intelligence';
import {
  WORKFLOW_STAGE_LABELS,
  WORKFLOW_STAGE_ROUTES,
  workflowTone,
} from './workflow-actions';
import type {
  ProjectWorkflowSummary,
  WorkflowEvaluatorInput,
  WorkflowNextAction,
  WorkflowStageId,
  WorkflowStageStatus,
  WorkflowStageSummary,
} from './workflow-types';

type StageDraft = Omit<WorkflowStageSummary, 'label' | 'relatedEntityIds'> & {
  relatedEntityIds?: Record<string, string[]>;
};

function activeBatch(input: WorkflowEvaluatorInput) {
  return input.importBatchId
    ? input.importBatches.find(batch => batch.id === input.importBatchId) ?? null
    : input.importBatches.find(batch => batch.foodTypeSlug === input.foodType && batch.status === 'active') ?? null;
}

function projectName(input: WorkflowEvaluatorInput) {
  const batch = activeBatch(input);
  return batch ? batch.fileName.replace(/\.csv$/i, '') : `${formatFoodTypeLabel(input.foodType)} Project`;
}

function stage(input: StageDraft): WorkflowStageSummary {
  return {
    label: WORKFLOW_STAGE_LABELS[input.id],
    relatedEntityIds: {},
    ...input,
  };
}

function latestByDate<T>(items: T[], getDate: (item: T) => string | undefined | null): T | null {
  return [...items].sort((a, b) => new Date(getDate(b) ?? 0).getTime() - new Date(getDate(a) ?? 0).getTime())[0] ?? null;
}

function pickNextAction(stages: WorkflowStageSummary[]): WorkflowNextAction {
  const priority: WorkflowStageId[] = ['data', 'studies', 'responses', 'insights', 'decision', 'concept', 'report'];
  const next = priority
    .map(id => stages.find(item => item.id === id))
    .find((item): item is WorkflowStageSummary => item !== undefined && item.status !== 'complete')
    ?? stages[stages.length - 1]!;
  return {
    label: next.nextActionLabel,
    description: next.blockers[0] ?? next.warnings[0] ?? next.detail,
    route: next.nextActionRoute,
    stageId: next.id,
    tone: workflowTone(next.status),
  };
}

function overall(stages: WorkflowStageSummary[]) {
  const critical = stages.find(item => item.status === 'blocked');
  if (critical) return { label: `${critical.label} blocked`, tone: 'critical' as const };
  const review = stages.find(item => item.status === 'needs_review');
  if (review) return { label: `${review.label} needs review`, tone: 'warning' as const };
  const ready = stages.find(item => item.status === 'ready');
  if (ready) return { label: `${ready.label} ready`, tone: workflowTone(ready.status) };
  const completed = stages.filter(item => item.status === 'complete');
  const progress = completed[completed.length - 1] ?? stages.find(item => item.status === 'in_progress');
  if (progress) return { label: `${progress.label} ${progress.status === 'complete' ? 'complete' : 'in progress'}`, tone: workflowTone(progress.status) };
  return { label: 'Awaiting data', tone: 'neutral' as const };
}

function enforceNoReadyWithBlockers(input: WorkflowStageSummary): WorkflowStageSummary {
  if (input.blockers.length === 0 || (input.status !== 'ready' && input.status !== 'complete')) return input;
  return { ...input, status: 'needs_review' };
}

function explainReportIssue(message: string, fallbackAction: string): string {
  const cleaned = message.replace(/^[a-z0-9-]+:\s*/i, '').trim();
  if (/\b(open|review|rebuild|replace|collect|resolve|import|launch|approve)\b/i.test(cleaned)) return cleaned;
  return `${cleaned} ${fallbackAction}`;
}

export function evaluateProjectWorkflow(input: WorkflowEvaluatorInput): ProjectWorkflowSummary {
  const batch = activeBatch(input);
  const samples = (input.instrumentalDataset?.eTongueData ?? []).filter(sample =>
    sample.type === input.foodType && (!input.importBatchId || sample.importBatchId === input.importBatchId)
  );
  const batchSamples = (input.instrumentalDataset?.eTongueData ?? []).filter(sample =>
    !input.importBatchId || sample.importBatchId === input.importBatchId
  );
  const sampleIds = new Set(samples.map(sample => sample.sampleId));
  const hasEtongue = samples.length > 0;
  const hasGcms = samples.some(sample => (input.instrumentalDataset?.gcmsData[sample.sampleId]?.length ?? 0) > 0);
  const hasComposition = samples.some(sample => Boolean(input.instrumentalDataset?.compositionData[sample.sampleId]));
  const missingSampleId = batchSamples.some(sample => !sample.sampleId?.trim());
  const missingFoodType = batchSamples.some(sample => !sample.type?.trim())
    || input.importBatches.some(item => item.status === 'active' && !item.foodTypeSlug);
  const dataWarnings = [
    hasEtongue && !hasGcms ? 'GC-MS evidence is missing. Aroma-risk confidence will be lower until GC-MS data is imported or explicitly marked out of scope.' : null,
    hasEtongue && !hasComposition ? 'Composition evidence is missing. Formulation confidence will be lower until composition data is imported or explicitly marked out of scope.' : null,
    missingSampleId ? 'One or more imported rows are missing sample IDs. Sample IDs are required to link surveys, responses, decisions, and reports; fix the import mapping and re-import.' : null,
    missingFoodType ? 'One or more imported samples are missing food type classification. Food type drives sensory defaults and project matching; review the import and assign a food type.' : null,
  ].filter((item): item is string => Boolean(item));

  const dataStatus: WorkflowStageStatus = hasEtongue
    ? missingSampleId || missingFoodType ? 'needs_review' : 'complete'
    : (input.pendingImportCount ?? 0) > 0
      ? 'in_progress'
      : 'not_started';
  const dataStage = enforceNoReadyWithBlockers(stage({
    id: 'data',
    status: dataStatus,
    blockers: [],
    warnings: dataWarnings,
    completedItems: [
      hasEtongue ? `${samples.length} machine sample${samples.length === 1 ? '' : 's'} imported` : null,
      hasGcms ? 'GC-MS data linked' : null,
      hasComposition ? 'Composition data linked' : null,
    ].filter((item): item is string => Boolean(item)),
    nextActionLabel: missingSampleId || missingFoodType ? 'Review imported data' : hasEtongue ? 'View imported data' : 'Import instrumental data',
    nextActionRoute: WORKFLOW_STAGE_ROUTES.data,
    detail: hasEtongue ? 'Instrumental data exists for this project.' : 'No imported machine sample data exists yet. Import an instrumental CSV to start the workflow.',
    relatedEntityIds: { importBatchIds: batch ? [batch.id] : [], sampleIds: [...sampleIds] },
  }));

  const projectDecisions = input.decisionRecords.filter(record =>
    sampleIds.has(record.sampleId) ||
    (!input.importBatchId && sampleMatchesFoodType(record.sampleId, record.sampleName) === input.foodType)
  );
  const latestDecision = latestByDate(projectDecisions, decision => decision.timestamp);
  projectDecisions.forEach(record => sampleIds.add(record.sampleId));

  const projectProducts = input.products.filter(product =>
    product.status !== 'archived' &&
    (product.sourceSampleId ? sampleIds.has(product.sourceSampleId) : false)
  );
  const activeStudies = projectProducts.filter(product => product.status === 'active');
  const multiSampleStudies = activeStudies.filter(product => product.isMultiSample);
  const studyWarnings = [
    ...activeStudies
      .filter(product => !product.isMultiSample && (product.customAttributes?.length ?? 0) === 0)
      .map(product => `${product.name} has no sensory attributes selected. Panelists need attributes to produce defensible sensory analysis; review the study setup before relying on responses.`),
    ...multiSampleStudies
      .filter(product => (product.samples?.length ?? 0) < 2)
      .map(product => `${product.name} needs at least two samples. Multi-sample studies require at least two unique samples; add samples or convert it to a single-product study.`),
  ];
  const studiesStatus: WorkflowStageStatus = activeStudies.length === 0
    ? hasEtongue ? 'not_started' : 'blocked'
    : studyWarnings.length > 0 ? 'needs_review' : 'complete';
  const assignmentSummaries = activeStudies.map(product => {
    const mode = getProductAssignmentMode(product);
    if (mode === 'open') return `${product.name}: Open to all active panelists`;
    const count = product.assignedPanelistIds?.length ?? 0;
    return `${product.name}: ${count} assigned panelist${count === 1 ? '' : 's'}`;
  });
  const studiesStage = enforceNoReadyWithBlockers(stage({
    id: 'studies',
    status: studiesStatus,
    blockers: hasEtongue ? [] : ['Import sample data before setting up studies. Studies need linked samples so panelist responses can be traced back to the correct product.'],
    warnings: studyWarnings,
    completedItems: [
      ...activeStudies.map(product => product.isMultiSample ? `${product.name} multi-sample study exists` : `${product.name} sensory study exists`),
      ...assignmentSummaries,
    ],
    nextActionLabel: activeStudies.length === 0 ? 'Create sensory study' : studyWarnings.length > 0 ? 'Review study setup' : 'Open studies',
    nextActionRoute: WORKFLOW_STAGE_ROUTES.studies,
    detail: activeStudies.length > 0 ? `${activeStudies.length} active stud${activeStudies.length === 1 ? 'y' : 'ies'} configured.` : 'No sensory study has been created for this project yet.',
    relatedEntityIds: { productIds: activeStudies.map(product => product.id) },
  }));

  const responseCompleted = projectProducts.reduce((sum, product) => (
    sum + (input.responseCountsBySampleId[product.sourceSampleId ?? ''] ?? 0)
  ), 0);
  const responseTarget = Math.max(projectProducts.length, 1) * input.minimumResponses;
  const enoughResponses = projectProducts.length > 0 && projectProducts.every(product =>
    (input.responseCountsBySampleId[product.sourceSampleId ?? ''] ?? 0) >= input.minimumResponses
  );
  const responseWarnings = projectProducts
    .filter(product => {
      const n = input.responseCountsBySampleId[product.sourceSampleId ?? ''] ?? 0;
      return n > 0 && n < input.minimumResponses;
    })
    .map(product => `${product.name} has a low response count. The target is ${input.minimumResponses} responses before decision review; continue collecting panelist responses.`);
  const responsesStatus: WorkflowStageStatus = activeStudies.length === 0
    ? 'blocked'
    : enoughResponses
      ? 'complete'
      : responseCompleted > 0
        ? 'in_progress'
        : 'not_started';
  const responsesStage = enforceNoReadyWithBlockers(stage({
    id: 'responses',
    status: responsesStatus,
    blockers: activeStudies.length === 0 ? ['Launch a valid study before collecting responses. Panelists need an active study route before response progress can begin.'] : [],
    warnings: responseWarnings,
    completedItems: responseCompleted > 0 ? [`${responseCompleted}/${responseTarget} target responses collected`] : [],
    nextActionLabel: enoughResponses ? 'View response progress' : 'Collect responses',
    nextActionRoute: WORKFLOW_STAGE_ROUTES.responses,
    detail: activeStudies.length === 0 ? 'No active study is available for panelists.' : responseCompleted === 0 ? `0/${responseTarget} target responses collected. The study exists, but no panelist has submitted yet.` : `${responseCompleted}/${responseTarget} target responses collected.`,
    relatedEntityIds: { productIds: projectProducts.map(product => product.id) },
  }));

  const insightsStatus: WorkflowStageStatus = latestDecision
    ? 'complete'
    : !hasEtongue || responseCompleted === 0
    ? 'blocked'
    : enoughResponses
      ? 'ready'
      : 'in_progress';
  const insightsStage = enforceNoReadyWithBlockers(stage({
    id: 'insights',
    status: insightsStatus,
    blockers: [
      !hasEtongue ? 'Import instrumental data before reviewing insights. Insights compare sensory results with machine evidence, so the project needs linked data first.' : null,
      responseCompleted === 0 ? 'Collect panelist responses before reviewing insights. Sensory aggregation cannot run until at least one response exists.' : null,
    ].filter((item): item is string => Boolean(item)),
    warnings: enoughResponses ? [] : ['Insights are directional until response targets are met. Continue collecting responses before using insights for a final decision.'],
    completedItems: [
      responseCompleted > 0 ? 'Survey aggregation available' : null,
      hasEtongue ? 'Instrumental comparison available' : null,
    ].filter((item): item is string => Boolean(item)),
    nextActionLabel: enoughResponses ? 'Open insights' : 'Check insight readiness',
    nextActionRoute: WORKFLOW_STAGE_ROUTES.insights,
    detail: responseCompleted > 0 && hasEtongue ? 'Sensory aggregation and instrumental data can be reviewed.' : 'Insights require responses and linked instrumental data.',
  }));

  const decisionStatus: WorkflowStageStatus = latestDecision
    ? 'complete'
    : insightsStatus === 'ready'
      ? 'ready'
      : 'blocked';
  const decisionWarnings = latestDecision && latestDecision.confidence < 70
    ? [`Decision confidence is ${latestDecision.confidence}%. Treat this decision as cautious guidance and review the underlying evidence before downstream work.`]
    : [];
  const decisionStage = enforceNoReadyWithBlockers(stage({
    id: 'decision',
    status: decisionStatus,
    blockers: insightsStatus === 'ready' || latestDecision ? [] : ['Insights must be ready before a GO/TWEAK/STOP decision. Review responses and instrumental evidence first so the decision has a defensible basis.'],
    warnings: decisionWarnings,
    completedItems: latestDecision ? [`${latestDecision.decision} decision recorded at ISSF ${latestDecision.issfScore.toFixed(0)}`] : [],
    nextActionLabel: latestDecision?.decision === 'TWEAK' ? 'Review tweak plan' : latestDecision?.decision === 'STOP' ? 'Review STOP rationale' : latestDecision ? 'Open decision record' : 'Review decision',
    nextActionRoute: WORKFLOW_STAGE_ROUTES.decision,
    detail: latestDecision ? `${latestDecision.decision} decision has been confirmed.${latestDecision.decision === 'GO' ? ' Concept and report paths are unlocked.' : ' This does not unlock commercialization readiness.'}` : 'Decision recommendation is waiting for review.',
    relatedEntityIds: { decisionRecordIds: latestDecision ? [latestDecision.id] : [] },
  }));

  const goDecision = latestDecision?.decision === 'GO';
  const projectConcepts = input.conceptTests.filter(concept =>
    (concept.foodTypeSlug ? concept.foodTypeSlug === input.foodType : true) &&
    concept.status !== 'archived'
  );
  const conceptResponses = projectConcepts.reduce((sum, concept) => sum + (input.conceptResponseCounts?.[concept.id] ?? 0), 0);
  const completedConcept = projectConcepts.find(concept => concept.status === 'completed' || concept.status === 'approved');
  const conceptInReview = projectConcepts.find(concept => concept.status === 'review');
  const conceptStatus: WorkflowStageStatus = !goDecision
    ? 'blocked'
    : projectConcepts.length === 0
      ? 'not_started'
      : completedConcept && conceptResponses > 0
        ? 'complete'
        : conceptResponses > 0
          ? 'ready'
          : conceptInReview
          ? 'needs_review'
          : 'in_progress';
  const conceptStage = enforceNoReadyWithBlockers(stage({
    id: 'concept',
    status: conceptStatus,
    blockers: goDecision ? [] : [`A confirmed GO decision is required before concept testing. The current decision is ${latestDecision?.decision ?? 'not confirmed'}, so do not use this project for consumer-facing concept or commercialization work yet.`],
    warnings: projectConcepts.length > 0 && conceptResponses === 0 ? ['Concept evidence has no consumer responses yet. Consumer preference and purchase intent cannot be supported until panelists complete the concept test. Launch the test or collect responses.'] : [],
    completedItems: [
      projectConcepts[0] ? `${projectConcepts[0].name} concept exists` : null,
      conceptResponses > 0 ? `${conceptResponses} concept response${conceptResponses === 1 ? '' : 's'} collected` : null,
    ].filter((item): item is string => Boolean(item)),
    nextActionLabel: !goDecision ? 'Go to decision' : projectConcepts.length === 0 ? 'Create concept test' : conceptResponses > 0 ? 'Review concept results' : 'Launch concept test',
    nextActionRoute: goDecision ? WORKFLOW_STAGE_ROUTES.concept : WORKFLOW_STAGE_ROUTES.decision,
    detail: !goDecision ? 'Concept testing unlocks after a GO decision.' : projectConcepts.length > 0 ? `${projectConcepts.length} concept test${projectConcepts.length === 1 ? '' : 's'} found.` : 'No concept test has been created yet.',
    relatedEntityIds: { conceptTestIds: projectConcepts.map(concept => concept.id) },
  }));

  const projectReports = input.commercializationReports.filter(report =>
    report.status !== 'archived' &&
    projectDecisions.some(decision => decision.id === report.decisionRecordId)
  );
  const latestReport = latestByDate(projectReports, report => report.updatedAt);
  const readiness = latestReport ? input.reportReadinessById?.[latestReport.id] : undefined;
  const reportContextChanged = readiness?.agentStatus === 'stale';
  const referenceEvidence = readiness?.evidenceProvenance.sensory === 'reference'
    || readiness?.evidenceProvenance.concept === 'reference'
    || readiness?.evidenceProvenance.instrumental === 'reference'
    || readiness?.evidenceProvenance.purchaseIntent === 'reference';
  const reportReadinessBlockers = [
    ...(readiness?.exportBlockers ?? []),
    ...(readiness?.approvalBlockers ?? []),
    ...(readiness?.blockers ?? []),
  ].map(issue => explainReportIssue(issue, 'Open the report workspace to resolve this before export or approval.'));
  const reportStatus: WorkflowStageStatus = !goDecision
    ? 'blocked'
    : !latestReport
      ? 'not_started'
      : reportContextChanged || referenceEvidence || reportReadinessBlockers.length > 0
        ? 'needs_review'
        : latestReport.status === 'approved'
        ? 'complete'
        : latestReport.status === 'review'
          ? 'needs_review'
          : readiness?.exportReady
            ? 'ready'
            : 'in_progress';
  const reportStage = enforceNoReadyWithBlockers(stage({
    id: 'report',
    status: reportStatus,
    blockers: [
      !goDecision ? `A confirmed GO decision is required before building a commercialization report. The current decision is ${latestDecision?.decision ?? 'not confirmed'}; review the decision and retest if needed before commercialization reporting.` : null,
      ...reportReadinessBlockers,
    ].filter((item): item is string => Boolean(item)),
    warnings: [
      ...(readiness?.warnings ?? []).map(issue => explainReportIssue(issue, 'Review the report workspace before export or approval.')),
      reportContextChanged ? 'The saved report context changed after the last agent/QC review. Reopen the report workspace and regenerate or review the report before export or reuse.' : null,
      referenceEvidence ? 'This report uses reference/demo evidence. Replace it with collected client evidence before approval or external use.' : null,
    ].filter((item): item is string => Boolean(item)),
    completedItems: [
      latestReport ? `Report v${latestReport.version} saved as ${latestReport.status}` : null,
      readiness?.exportReady ? 'Strict PDF export context is ready' : null,
      readiness?.evidenceProvenance.sensory === 'reference' ? 'Reference/demo sensory evidence detected' : null,
    ].filter((item): item is string => Boolean(item)),
    nextActionLabel: !goDecision
      ? 'Go to decision'
      : !latestReport
        ? 'Build report'
        : reportStatus === 'complete' || reportStatus === 'ready'
          ? 'Export report'
          : 'Open report workspace',
    nextActionRoute: latestReport ? `/report?report=${latestReport.id}` : WORKFLOW_STAGE_ROUTES.report,
    detail: latestReport ? `Latest report is ${latestReport.status}.` : 'No commercialization report snapshot has been saved yet.',
    relatedEntityIds: { reportIds: projectReports.map(report => report.id) },
  }));

  const stages = [dataStage, studiesStage, responsesStage, insightsStage, decisionStage, conceptStage, reportStage];
  const rollup = overall(stages);
  const counts = {
    importedSamples: samples.length,
    activeStudies: activeStudies.length,
    responsesCollected: responseCompleted,
    decisionsRecorded: projectDecisions.length,
    conceptsActive: projectConcepts.length,
    reportsSaved: projectReports.length,
  };

  return {
    projectName: projectName(input),
    foodTypeLabel: formatFoodTypeLabel(input.foodType),
    overallStatusLabel: rollup.label,
    overallTone: rollup.tone,
    stages,
    nextAction: pickNextAction(stages),
    blockers: stages.flatMap(item => item.blockers),
    warnings: stages.flatMap(item => item.warnings),
    counts,
    latestDecision,
    latestReport,
  };
}
