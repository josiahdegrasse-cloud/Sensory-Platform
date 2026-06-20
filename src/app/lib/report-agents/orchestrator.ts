import {
  validateGeneratedReport,
  validateReportContext,
  scoreReportQuality,
  type GeneratedSections,
  type ReportContext,
  type ValidationFinding,
} from '../report-qc';
import { REPORT_AGENT_DEFINITIONS } from './roles';
import { buildClaimLineage } from './artifacts';
import { hashReportContext } from './hash';
import { authorizeReportExport } from './release';
import { validateAgentResult } from './result-validation';
import type {
  ActionPlanResult,
  AgentConflict,
  CalculationAuditResult,
  ClientRedTeamResult,
  CommercialStrategyResult,
  DecisionConsistencyResult,
  EditorialReviewResult,
  EvidenceAuditResult,
  FinalJudgeResult,
  HumanApprovalRecord,
  RepairHistoryEntry,
  ReportAgentOutputMap,
  ReportAgentOutputs,
  ReportAgentPacketMap,
  ReportAgentRole,
  ReportAgentRunner,
  ReportAgentState,
  ReportDefect,
  ReportOrchestrationArtifacts,
  ReportRenderResult,
  ReportReviewMode,
  ScientificReviewResult,
  VisualQAResult,
  WrittenReportResult,
} from './types';

const MAX_AUTOMATED_REPAIR_ITERATIONS = 8;
const REVIEWABLE_PREFLIGHT_CODES = new Set([
  'action-without-owner',
]);

export interface ReportOrchestratorInput {
  mode?: ReportReviewMode;
  context: ReportContext;
  generatedSections: GeneratedSections;
  pageText: Array<{ page: number; text: string }>;
  runner: ReportAgentRunner;
  render: (input: {
    draft: WrittenReportResult;
    iteration: number;
  }) => Promise<ReportRenderResult>;
  repair?: (input: {
    draft: WrittenReportResult;
    defects: ReportDefect[];
    iteration: number;
    owningPasses: string[];
  }) => Promise<{
    draft: WrittenReportResult;
    fixedDefectIds: string[];
    summary: string;
  }>;
  humanApprovals?: HumanApprovalRecord[];
  maxIterations?: number;
}

const EMPTY_CALCULATION_AUDIT: CalculationAuditResult = {
  verifiedCalculations: [],
  unexplainedCalculations: [],
  numericalConflicts: [],
  blockers: [],
  warnings: [],
};

const EMPTY_DECISION_AUDIT: DecisionConsistencyResult = {
  canonicalDecisionSummary: '',
  decisionStatements: [],
  blockers: [],
  warnings: [],
};

function deterministicCommercialStrategy(ctx: ReportContext): CommercialStrategyResult {
  return {
    supportedCommercialConclusions: ctx.conceptStrategy.reasonsToBelieve,
    positioningHypothesis: ctx.conceptStrategy.positioning,
    targetSegmentHypothesis: ctx.conceptStrategy.targetSegment,
    consumerNeedHypothesis: ctx.conceptStrategy.consumerNeed,
    usageOccasionHypothesis: ctx.conceptStrategy.usageOccasion,
    productPromiseHypothesis: ctx.conceptStrategy.productPromise,
    reasonsToBelieve: ctx.conceptStrategy.reasonsToBelieve.map(statement => ({
      statement,
      evidenceIds: ctx.sourceEvidenceIds,
    })),
    priceHypothesis: ctx.conceptStrategy.priceHypothesis
      ? {
          statement: ctx.conceptStrategy.priceHypothesis,
          source: 'Project brief hypothesis; not market research.',
          validationRequired: true,
        }
      : undefined,
    packagingHypothesis: ctx.conceptStrategy.packagingHypothesis,
    conceptTestObjectives: [ctx.conceptStrategy.conceptTestObjective],
    prohibitedExternalClaims: ctx.conceptStrategy.prohibitedClaims,
  };
}

function deterministicActionPlan(ctx: ReportContext, defects: ReportDefect[]): ActionPlanResult {
  return {
    immediateActions: ctx.actions.map(action => ({
      workstream: action.workstream,
      requiredAction: action.requiredAction,
      accountableOwner: action.owner,
      responsibleTeam: null,
      dueDate: action.dueDate,
      status: action.status,
      priority: 'high',
      dependencies: [],
      completionEvidence: action.completionEvidence,
      passingCriteria: action.passingThreshold,
      nextGate: action.nextGate,
      sourceDefectIds: defects
        .filter(defect => defect.status === 'open')
        .map(defect => defect.id),
    })),
    laterActions: [],
    readinessGaps: ctx.actions.flatMap(action => [
      ...(action.owner ? [] : [`${action.workstream}: accountable owner is not assigned.`]),
      ...(action.dueDate ? [] : [`${action.workstream}: due date is not scheduled.`]),
    ]),
  };
}

function findingDefect(finding: ValidationFinding, index: number): ReportDefect {
  const reviewableReadinessGap = REVIEWABLE_PREFLIGHT_CODES.has(finding.code);
  return {
    id: `deterministic-${finding.code}-${index + 1}`,
    category: finding.code,
    severity: finding.blocksExport && !reviewableReadinessGap
      ? 'critical'
      : finding.severity === 'error' ? 'major' : 'minor',
    source: 'deterministic_validator',
    description: finding.message,
    evidenceIds: [],
    owningPass: deterministicRepairOwner(finding.code),
    requiredFix: finding.message,
    status: 'open',
  };
}

function deterministicRepairOwner(code: string): string {
  if (/calculation|numeric|issf|score|metric|sample-size|instrumental/.test(code)) return 'deterministic_calculation';
  if (/claim|consumer|packaging|evidence-reference/.test(code)) return 'claim_planning';
  if (/decision|approval|stage|go-/.test(code)) return 'decision_language';
  if (/render|glyph|density|warning/.test(code)) return 'pdf_layout';
  if (/action|dependency/.test(code)) return 'action_plan_engineer';
  return 'professional_report_writer';
}

function allowedEvidenceIds(ctx: ReportContext): string[] {
  return ctx.sourceEvidenceIds;
}

async function invoke<R extends ReportAgentRole>(
  runner: ReportAgentRunner,
  role: R,
  hash: string,
  iteration: number,
  packet: ReportAgentPacketMap[R],
  evidenceIds: string[],
  reviewMode: ReportReviewMode,
): Promise<ReportAgentOutputMap[R]> {
  const definition = REPORT_AGENT_DEFINITIONS[role];
  const raw = await runner.run(
    {
      taskId: `${hash}:${iteration}:${role}`,
      role,
      reportContextHash: hash,
      iteration,
      reviewMode,
      packet,
    },
    {
      systemInstruction: definition.systemInstruction,
      temperature: definition.temperature,
    },
  );
  return validateAgentResult({ role, packet, output: raw, allowedEvidenceIds: evidenceIds });
}

function auditDefects(input: {
  evidence: EvidenceAuditResult;
  calculation: CalculationAuditResult;
  scientific: ScientificReviewResult;
  decision: DecisionConsistencyResult;
}): ReportDefect[] {
  const defects: ReportDefect[] = [];
  const addBlockers = (
    blockers: string[],
    source: ReportDefect['source'],
    category: string,
    owningPass: string,
  ) => blockers.forEach((description, index) => defects.push({
    id: `${category}-blocker-${index + 1}`,
    category,
    severity: 'critical',
    source,
    description,
    evidenceIds: [],
    owningPass,
    requiredFix: description,
    status: owningPass.startsWith('human_') ? 'human_review' : 'open',
  }));
  addBlockers(input.evidence.blockers, 'evidence_agent', 'evidence', 'claim_planning');
  addBlockers(input.calculation.blockers, 'calculation_agent', 'calculation', 'deterministic_calculation');
  addBlockers(input.scientific.blockers, 'scientific_agent', 'scientific_logic', 'human_scientific_review');
  addBlockers(input.decision.blockers, 'decision_agent', 'decision_conflict', 'decision_language');
  input.evidence.claims
    .filter(claim => claim.status === 'unsupported')
    .forEach(claim => defects.push({
      id: `evidence-${claim.claimId}`,
      category: 'unsupported_claim',
      severity: 'critical',
      source: 'evidence_agent',
      description: `Claim ${claim.claimId} is unsupported.`,
      evidenceIds: claim.supportingEvidenceIds,
      owningPass: 'claim_planning',
      requiredFix: claim.permittedWording || 'Remove the unsupported claim.',
      status: 'open',
    }));
  input.calculation.unexplainedCalculations.forEach((item, index) => defects.push({
    id: `calculation-unexplained-${index + 1}`,
    category: 'calculation',
    severity: 'critical',
    source: 'calculation_agent',
    description: `${item.metric}: ${item.issue}`,
    evidenceIds: [],
    owningPass: 'deterministic_calculation',
    requiredFix: item.expectedExplanation,
    status: 'open',
  }));
  input.calculation.numericalConflicts.forEach((item, index) => defects.push({
    id: `calculation-conflict-${index + 1}`,
    category: 'numerical_conflict',
    severity: 'critical',
    source: 'calculation_agent',
    description: `${item.label}: source ${item.sourceValue}, displayed ${item.displayedValue}.`,
    evidenceIds: [],
    owningPass: 'deterministic_calculation',
    requiredFix: 'Reconcile the displayed value to the deterministic calculation trace.',
    status: 'open',
  }));
  input.scientific.criticalChallenges.forEach((item, index) => defects.push({
    id: `scientific-${index + 1}`,
    category: 'scientific_logic',
    severity: item.severity === 'critical' ? 'critical' : item.severity === 'major' ? 'major' : 'minor',
    source: 'scientific_agent',
    description: item.issue,
    evidenceIds: item.evidenceIds,
    owningPass: item.severity === 'critical' ? 'human_scientific_review' : 'professional_report_writer',
    requiredFix: item.requiredCorrection,
    status: item.severity === 'critical' ? 'human_review' : 'open',
  }));
  input.decision.decisionStatements
    .filter(statement => statement.status !== 'consistent')
    .forEach((statement, index) => defects.push({
      id: `decision-${index + 1}`,
      category: 'decision_conflict',
      severity: statement.status === 'contradictory' ? 'critical' : 'major',
      source: 'decision_agent',
      page: statement.page,
      description: statement.text,
      evidenceIds: [],
      owningPass: 'decision_language',
      requiredFix: statement.correction ?? input.decision.canonicalDecisionSummary,
      status: 'open',
    }));
  return defects;
}

function applyEditorialReview(
  draft: WrittenReportResult,
  review: EditorialReviewResult,
): WrittenReportResult {
  const revisions = new Map(review.revisedSections.map(item => [item.sectionId, item.revised]));
  return {
    pages: draft.pages.map(page => ({
      ...page,
      sections: page.sections.map(section => ({
        ...section,
        body: revisions.get(section.sectionId) ?? section.body,
      })),
    })),
  };
}

function visualDefects(result: VisualQAResult): ReportDefect[] {
  return result.pageResults.flatMap(page => page.issues.map((issue, index) => ({
    id: `visual-${page.page}-${index + 1}`,
    category: issue.type,
    severity: issue.severity,
    source: 'visual_agent' as const,
    page: page.page,
    description: issue.description,
    evidenceIds: [],
    owningPass: 'pdf_layout',
    requiredFix: issue.requiredFix,
    status: 'open' as const,
  })));
}

function redTeamDefects(result: ClientRedTeamResult): ReportDefect[] {
  return result.trustRisks.map((risk, index) => ({
    id: `client-red-team-${index + 1}`,
    category: 'client_trust',
    severity: risk.severity,
    source: 'client_red_team',
    page: risk.page,
    description: risk.issue,
    evidenceIds: [],
    owningPass: 'professional_report_writer',
    requiredFix: risk.requiredFix,
    status: 'open',
  }));
}

function judgeDefects(result: FinalJudgeResult): ReportDefect[] {
  return result.blockers.map((blocker, index) => ({
    id: `final-judge-${index + 1}`,
    category: 'final_judgment',
    severity: 'critical',
    source: 'final_judge',
    description: blocker,
    evidenceIds: [],
    owningPass: 'human_review',
    requiredFix: blocker,
    status: 'human_review',
  }));
}

function addCompleted(state: ReportAgentState, roles: ReportAgentRole[]): void {
  state.completedAgents.push(...roles.filter(role => !state.completedAgents.includes(role)));
  state.pendingAgents = state.pendingAgents.filter(role => !roles.includes(role as ReportAgentRole));
}

function uniqueFindings(findings: ValidationFinding[]): ValidationFinding[] {
  const seen = new Set<string>();
  return findings.filter(finding => {
    const key = `${finding.code}:${finding.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function orchestrateReportAgents(
  input: ReportOrchestratorInput,
): Promise<ReportOrchestrationArtifacts> {
  const mode = input.mode ?? 'full';
  const hash = await hashReportContext(input.context);
  const maxIterations = Math.min(input.maxIterations ?? MAX_AUTOMATED_REPAIR_ITERATIONS, MAX_AUTOMATED_REPAIR_ITERATIONS);
  const contextValidation = validateReportContext(input.context);
  const reportValidation = validateGeneratedReport(input.context, input.generatedSections);
  const combinedValidation = {
    errors: uniqueFindings([...contextValidation.errors, ...reportValidation.errors]),
    warnings: uniqueFindings([...contextValidation.warnings, ...reportValidation.warnings]),
    exportAllowed: contextValidation.exportAllowed && reportValidation.exportAllowed,
  };
  const initialFindings = [...combinedValidation.errors, ...combinedValidation.warnings];
  const hardPreflightBlockers = combinedValidation.errors.filter(finding =>
    finding.blocksExport && !REVIEWABLE_PREFLIGHT_CODES.has(finding.code),
  );
  const state: ReportAgentState = {
    reportContextHash: hash,
    currentIteration: 0,
    maxIterations,
    completedAgents: [],
    pendingAgents: mode === 'standard'
      ? ['evidence_auditor', 'scientific_skeptic', 'professional_report_writer', 'editorial_reviewer']
      : Object.keys(REPORT_AGENT_DEFINITIONS),
    defects: initialFindings.map(findingDefect),
    unresolvedConflicts: [],
    deterministicBlockers: hardPreflightBlockers
      .map(finding => `${finding.code}: ${finding.message}`),
    agentWarnings: [],
    qualityScore: null,
    exportStatus: combinedValidation.exportAllowed ? 'internal_only' : 'blocked',
  };
  const outputs: ReportAgentOutputs = {};
  const repairHistory: RepairHistoryEntry[] = [];
  const conflicts: AgentConflict[] = [];

  if (hardPreflightBlockers.length > 0) {
    return {
      state,
      outputs,
      defects: state.defects,
      conflicts,
      repairHistory,
      humanApprovals: input.humanApprovals ?? [],
      deterministicValidation: combinedValidation,
    };
  }

  const evidenceIds = allowedEvidenceIds(input.context);
  const methodologyText = input.generatedSections.sections
    .filter(section => /method|calculation|confidence|ISSF/i.test(section.label))
    .map(section => section.text)
    .join('\n');
  const proposedInterpretations = input.generatedSections.sections.map(section => section.text);

  const coreAudits = await Promise.all([
    invoke(input.runner, 'evidence_auditor', hash, 0, {
      contextSummary: {
        sourceEvidenceIds: input.context.sourceEvidenceIds,
        concept: input.context.concept,
        dimensions: input.context.dimensions,
        instrumental: input.context.instrumental,
        limitations: input.context.limitations,
      },
      claims: input.context.claims,
    }, evidenceIds, mode),
    ...(mode === 'full' ? [invoke(input.runner, 'calculation_auditor', hash, 0, {
      calculationTrace: {
        methodology: input.context.methodology,
        dimensions: input.context.dimensions,
        thresholds: input.context.thresholds,
        gates: input.context.gates,
        confidence: input.context.decision.confidence,
      },
      renderedMethodologyText: methodologyText,
    }, evidenceIds, mode)] : []),
    invoke(input.runner, 'scientific_skeptic', hash, 0, {
      contextSummary: {
        dimensions: input.context.dimensions,
        instrumental: input.context.instrumental,
        concept: input.context.concept,
        methodology: input.context.methodology,
        limitations: input.context.limitations,
        gates: input.context.gates,
      },
      proposedInterpretations,
    }, evidenceIds, mode),
    ...(mode === 'full' ? [invoke(input.runner, 'decision_consistency_auditor', hash, 0, {
      canonicalDecision: input.context.decision,
      pageText: input.pageText,
      reportTitle: input.generatedSections.sections[0]?.text ?? '',
    }, evidenceIds, mode)] : []),
  ]);
  const evidence = coreAudits[0] as EvidenceAuditResult;
  const scientific = coreAudits[mode === 'full' ? 2 : 1] as ScientificReviewResult;
  const calculation = mode === 'full'
    ? coreAudits[1] as CalculationAuditResult
    : EMPTY_CALCULATION_AUDIT;
  const decision = mode === 'full'
    ? coreAudits[3] as DecisionConsistencyResult
    : EMPTY_DECISION_AUDIT;
  Object.assign(outputs, {
    evidence_auditor: evidence,
    calculation_auditor: calculation,
    scientific_skeptic: scientific,
    decision_consistency_auditor: decision,
  });
  addCompleted(state, mode === 'full'
    ? ['evidence_auditor', 'calculation_auditor', 'scientific_skeptic', 'decision_consistency_auditor']
    : ['evidence_auditor', 'scientific_skeptic']);
  state.defects.push(...auditDefects({ evidence, calculation, scientific, decision }));
  state.agentWarnings.push(...evidence.warnings, ...calculation.warnings, ...decision.warnings);
  scientific.criticalChallenges
    .filter(challenge => challenge.severity === 'critical')
    .forEach((challenge, index) => conflicts.push({
      id: `scientific-conflict-${index + 1}`,
      agents: ['scientific_skeptic', 'evidence_auditor'],
      topic: challenge.issue,
      positions: [
        'The scoped claim/evidence audit did not independently resolve this scientific challenge.',
        challenge.requiredCorrection,
      ],
      evidenceIds: challenge.evidenceIds,
      resolution: 'human_review_required',
      finalDecision: 'External release remains blocked until a qualified human reviewer resolves the scientific issue.',
    }));
  state.unresolvedConflicts = conflicts;

  const criticalAuditDefects = state.defects.filter(defect =>
    defect.severity === 'critical' && defect.status !== 'fixed',
  );
  if (criticalAuditDefects.length > 0) {
    state.exportStatus = 'blocked';
    return {
      state,
      outputs,
      defects: state.defects,
      conflicts,
      repairHistory,
      humanApprovals: input.humanApprovals ?? [],
      deterministicValidation: combinedValidation,
    };
  }

  const commercialStrategy = mode === 'full'
    ? await invoke(input.runner, 'commercial_strategist', hash, 0, {
        canonicalDecision: input.context.decision,
        approvedClaims: evidence.claims.filter(claim => claim.status !== 'unsupported'),
        conceptInputs: input.context.conceptStrategy,
        limitations: input.context.limitations,
      }, evidenceIds, mode)
    : deterministicCommercialStrategy(input.context);
  if (mode === 'full') {
    outputs.commercial_strategist = commercialStrategy;
    addCompleted(state, ['commercial_strategist']);
  }

  const actionPlan = mode === 'full'
    ? await invoke(input.runner, 'action_plan_engineer', hash, 0, {
        nextGate: input.context.decision.nextGate,
        gates: input.context.gates,
        defects: state.defects,
        scientificReview: scientific,
        commercialStrategy,
        storedActions: input.context.actions,
      }, evidenceIds, mode)
    : deterministicActionPlan(input.context, state.defects);
  if (mode === 'full') {
    outputs.action_plan_engineer = actionPlan;
    addCompleted(state, ['action_plan_engineer']);
  }

  const draft = await invoke(input.runner, 'professional_report_writer', hash, 0, {
    context: input.context,
    approvedClaims: evidence.claims.filter(claim => claim.status !== 'unsupported'),
    commercialStrategy,
    actionPlan,
    requiredLimitations: input.context.limitations,
  }, evidenceIds, mode);
  outputs.professional_report_writer = draft;
  addCompleted(state, ['professional_report_writer']);

  const editorial = await invoke(input.runner, 'editorial_reviewer', hash, 0, {
    draft,
    immutableNumbers: [
      input.context.issfScore,
      input.context.decision.modelConfidence,
      ...input.context.dimensions.flatMap(dimension => [dimension.score, dimension.sampleSize ?? 'missing']),
    ],
    requiredLimitations: input.context.limitations,
  }, evidenceIds, mode);
  outputs.editorial_reviewer = editorial;
  addCompleted(state, ['editorial_reviewer']);
  let editedDraft = applyEditorialReview(draft, editorial);

  let rendered = await input.render({ draft: editedDraft, iteration: 0 });
  if (mode === 'standard') {
    const finalValidation = validateGeneratedReport(input.context, rendered.generatedSections);
    const hardFinalBlockers = finalValidation.errors.filter(finding =>
      finding.blocksExport && !REVIEWABLE_PREFLIGHT_CODES.has(finding.code),
    );
    const authoritativeScore = scoreReportQuality({
      ctx: input.context,
      validation: finalValidation,
    });
    state.qualityScore = authoritativeScore.totalScore;
    state.exportStatus = hardFinalBlockers.length === 0
      ? /reference\/demo|reference-demo/i.test(input.context.evidenceProvenance)
        ? 'demonstration_only'
        : 'internal_only'
      : 'blocked';
    state.deterministicBlockers = hardFinalBlockers
      .map(finding => `${finding.code}: ${finding.message}`);
    return {
      state,
      outputs,
      defects: state.defects,
      conflicts,
      repairHistory,
      humanApprovals: input.humanApprovals ?? [],
      claimLineage: buildClaimLineage({
        draft: rendered.writtenReport,
        evidenceAudit: evidence,
        reportFingerprint: input.context.decisionFingerprint,
        editorialReviewed: true,
        redTeamReviewed: false,
        finalJudgeReviewed: false,
      }),
      finalDraft: rendered.writtenReport,
      deterministicValidation: finalValidation,
    };
  }
  let visualQa = await invoke(input.runner, 'visual_qa_reviewer', hash, 0, {
    pages: rendered.renderedPages,
    reportStage: input.context.stage,
    evidenceMode: input.context.evidenceProvenance,
  }, evidenceIds, mode);
  outputs.visual_qa_reviewer = visualQa;
  state.defects.push(...visualDefects(visualQa));
  addCompleted(state, ['visual_qa_reviewer']);

  let redTeam = await invoke(input.runner, 'client_red_team', hash, 0, {
    finalDraft: rendered.writtenReport,
    evidenceSummary: input.context.sourceEvidenceIds,
    methodologySummary: [
      input.context.methodology.formula,
      input.context.methodology.missingDataPolicy,
      input.context.methodology.conditionalReason,
    ],
  }, evidenceIds, mode);
  outputs.client_red_team = redTeam;
  state.defects.push(...redTeamDefects(redTeam));
  addCompleted(state, ['client_red_team']);

  while (input.repair && state.currentIteration < maxIterations) {
    const repairable = state.defects.filter(defect =>
      defect.status === 'open'
      && (defect.severity === 'critical' || defect.severity === 'major')
      && defect.owningPass !== 'human_review'
      && defect.owningPass !== 'human_scientific_review',
    );
    if (repairable.length === 0) break;

    state.currentIteration += 1;
    const repaired = await input.repair({
      draft: editedDraft,
      defects: repairable,
      iteration: state.currentIteration,
      owningPasses: [...new Set(repairable.map(defect => defect.owningPass))],
    });
    const fixed = new Set(repaired.fixedDefectIds);
    state.defects.forEach(defect => {
      if (fixed.has(defect.id)) defect.status = 'fixed';
    });
    repairHistory.push({
      iteration: state.currentIteration,
      defectIds: repairable.map(defect => defect.id),
      owningPass: [...new Set(repairable.map(defect => defect.owningPass))].join(', '),
      summary: repaired.summary,
      outcome: repaired.fixedDefectIds.length === repairable.length ? 'fixed' : 'partially_fixed',
    });
    if (repaired.fixedDefectIds.length === 0) break;

    editedDraft = repaired.draft;
    rendered = await input.render({ draft: editedDraft, iteration: state.currentIteration });
    visualQa = await invoke(input.runner, 'visual_qa_reviewer', hash, state.currentIteration, {
      pages: rendered.renderedPages,
      reportStage: input.context.stage,
      evidenceMode: input.context.evidenceProvenance,
    }, evidenceIds, mode);
    redTeam = await invoke(input.runner, 'client_red_team', hash, state.currentIteration, {
      finalDraft: rendered.writtenReport,
      evidenceSummary: input.context.sourceEvidenceIds,
      methodologySummary: [
        input.context.methodology.formula,
        input.context.methodology.missingDataPolicy,
        input.context.methodology.conditionalReason,
      ],
    }, evidenceIds, mode);
    outputs.visual_qa_reviewer = visualQa;
    outputs.client_red_team = redTeam;
    state.defects.push(...visualDefects(visualQa), ...redTeamDefects(redTeam));
  }

  const finalValidation = validateGeneratedReport(input.context, rendered.generatedSections);
  const finalJudge = await invoke(input.runner, 'final_independent_judge', hash, 0, {
    finalPdfText: rendered.finalPdfText,
    renderedPages: rendered.renderedPages,
    contextSummary: {
      stage: input.context.stage,
      decision: input.context.decision,
      limitations: input.context.limitations,
      evidenceProvenance: input.context.evidenceProvenance,
    },
    deterministicValidation: finalValidation,
    specialistResults: outputs,
  }, evidenceIds, mode);
  outputs.final_independent_judge = finalJudge;
  state.defects.push(...judgeDefects(finalJudge));
  const authoritativeScore = scoreReportQuality({
    ctx: input.context,
    validation: finalValidation,
    renderDefects: visualQa.pageResults.flatMap(page => page.issues.map(issue => ({
      message: `Page ${page.page}: ${issue.description}`,
      blocksExport: issue.severity === 'critical',
    }))),
  });
  state.qualityScore = authoritativeScore.totalScore;
  addCompleted(state, ['final_independent_judge']);

  const authorization = authorizeReportExport({
    context: input.context,
    deterministicValidation: finalValidation,
    visualQa,
    redTeam,
    finalJudge,
    authoritativeQualityScore: authoritativeScore.totalScore,
    humanApprovals: input.humanApprovals,
  });
  state.exportStatus = authorization.status;
  state.deterministicBlockers = authorization.deterministicBlockers;

  return {
    state,
    outputs,
    defects: state.defects,
    conflicts,
    repairHistory,
    humanApprovals: input.humanApprovals ?? [],
    claimLineage: buildClaimLineage({
      draft: rendered.writtenReport,
      evidenceAudit: evidence,
      reportFingerprint: input.context.decisionFingerprint,
      editorialReviewed: true,
      redTeamReviewed: true,
      finalJudgeReviewed: true,
    }),
    finalDraft: rendered.writtenReport,
    deterministicValidation: finalValidation,
  };
}
