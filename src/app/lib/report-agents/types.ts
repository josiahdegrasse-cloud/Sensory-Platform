import type {
  ClaimRecord,
  GeneratedSections,
  MethodologyEvidence,
  ReportContext,
  ValidationResult,
} from '../report-qc';

export type ReportExportStatus =
  | 'blocked'
  | 'internal_only'
  | 'demonstration_only'
  | 'client_ready';

export type ReportReviewMode = 'standard' | 'full';

export type ReportAgentRole =
  | 'evidence_auditor'
  | 'calculation_auditor'
  | 'scientific_skeptic'
  | 'decision_consistency_auditor'
  | 'commercial_strategist'
  | 'action_plan_engineer'
  | 'professional_report_writer'
  | 'editorial_reviewer'
  | 'client_red_team'
  | 'visual_qa_reviewer'
  | 'final_independent_judge';

export type ReportDefectSource =
  | 'deterministic_validator'
  | 'evidence_agent'
  | 'calculation_agent'
  | 'scientific_agent'
  | 'decision_agent'
  | 'editorial_agent'
  | 'visual_agent'
  | 'client_red_team'
  | 'final_judge';

export interface ReportDefect {
  id: string;
  category: string;
  severity: 'minor' | 'major' | 'critical';
  source: ReportDefectSource;
  page?: number;
  sectionId?: string;
  description: string;
  evidenceIds: string[];
  owningPass: string;
  requiredFix: string;
  status: 'open' | 'fixed' | 'accepted_risk' | 'human_review';
}

export interface AgentConflict {
  id: string;
  agents: string[];
  topic: string;
  positions: string[];
  evidenceIds: string[];
  resolution:
    | 'deterministic_rule'
    | 'human_review_required'
    | 'more_evidence_required';
  finalDecision: string;
}

export interface RepairHistoryEntry {
  iteration: number;
  defectIds: string[];
  owningPass: string;
  summary: string;
  outcome: 'fixed' | 'partially_fixed' | 'human_review' | 'not_fixable';
}

export interface HumanApprovalRecord {
  reviewerIdentity: string;
  reviewerRole: string;
  timestamp: string;
  approvalScope:
    | 'external_distribution'
    | 'legal_or_regulated_claims'
    | 'launch_authorization'
    | 'methodology_change'
    | 'threshold_change'
    | 'benchmark_library_change'
    | 'scientific_disagreement'
    | 'concept_copy'
    | 'packaging_claims';
  conditions: string[];
  reportFingerprint: string;
}

export interface ReportClaimLineage {
  claimId: string;
  sectionId: string;
  evidenceIds: string[];
  generatingAgent: 'professional_report_writer';
  reviewerAgents: Array<'evidence_auditor' | 'editorial_reviewer' | 'client_red_team' | 'final_independent_judge'>;
  approvalState: 'unreviewed' | 'approved' | 'rejected';
  reportFingerprint: string;
}

export interface ReportAgentState {
  reportContextHash: string;
  currentIteration: number;
  maxIterations: number;
  completedAgents: string[];
  pendingAgents: string[];
  defects: ReportDefect[];
  unresolvedConflicts: AgentConflict[];
  deterministicBlockers: string[];
  agentWarnings: string[];
  qualityScore: number | null;
  exportStatus: ReportExportStatus;
}

export interface EvidenceAuditResult {
  claims: Array<{
    claimId: string;
    status: 'supported' | 'directional' | 'unsupported' | 'requires_legal_review';
    supportingEvidenceIds: string[];
    missingEvidence: string[];
    permittedWording: string;
    prohibitedWording: string[];
    limitations: string[];
  }>;
  blockers: string[];
  warnings: string[];
}

export interface CalculationAuditResult {
  verifiedCalculations: string[];
  unexplainedCalculations: Array<{
    metric: string;
    issue: string;
    expectedExplanation: string;
  }>;
  numericalConflicts: Array<{
    label: string;
    sourceValue: number | string;
    displayedValue: number | string;
    transformationDocumented: boolean;
  }>;
  blockers: string[];
  warnings: string[];
}

export interface ScientificReviewResult {
  criticalChallenges: Array<{
    issue: string;
    severity: 'warning' | 'major' | 'critical';
    evidenceIds: string[];
    requiredCorrection: string;
  }>;
  alternativeInterpretations: string[];
  missingMethodDisclosures: string[];
  blockers: string[];
}

export interface DecisionConsistencyResult {
  canonicalDecisionSummary: string;
  decisionStatements: Array<{
    page: number;
    text: string;
    status: 'consistent' | 'ambiguous' | 'contradictory';
    correction?: string;
  }>;
  blockers: string[];
  warnings: string[];
}

export interface CommercialStrategyResult {
  supportedCommercialConclusions: string[];
  positioningHypothesis: string;
  targetSegmentHypothesis: string;
  consumerNeedHypothesis: string;
  usageOccasionHypothesis: string;
  productPromiseHypothesis: string;
  reasonsToBelieve: Array<{ statement: string; evidenceIds: string[] }>;
  priceHypothesis?: {
    statement: string;
    source: string;
    validationRequired: boolean;
  };
  packagingHypothesis: string;
  conceptTestObjectives: string[];
  prohibitedExternalClaims: string[];
}

export interface ActionPlanResult {
  immediateActions: Array<{
    workstream: string;
    requiredAction: string;
    accountableOwner: string | null;
    responsibleTeam: string | null;
    dueDate: string | null;
    status: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    dependencies: string[];
    completionEvidence: string;
    passingCriteria: string;
    nextGate: string;
    sourceDefectIds: string[];
  }>;
  laterActions: Array<{
    workstream: string;
    requiredAction: string;
    nextGate: string;
    dependencySummary: string[];
  }>;
  readinessGaps: string[];
}

export interface WrittenReportResult {
  pages: Array<{
    page: number;
    title: string;
    sections: Array<{
      sectionId: string;
      heading: string;
      body: string;
      claimIds: string[];
      evidenceIds: string[];
      limitationIds: string[];
    }>;
  }>;
}

export interface EditorialReviewResult {
  revisedSections: Array<{
    sectionId: string;
    original: string;
    revised: string;
    reason: string;
  }>;
  unresolvedIssues: string[];
  blockers: string[];
}

export interface ClientRedTeamResult {
  trustRisks: Array<{
    page: number;
    issue: string;
    severity: 'minor' | 'major' | 'critical';
    requiredFix: string;
  }>;
  likelyClientQuestions: string[];
  ambiguousStatements: string[];
  releaseRecommendation: ReportExportStatus;
}

export interface VisualQAResult {
  pageResults: Array<{
    page: number;
    issues: Array<{
      type: string;
      severity: 'minor' | 'major' | 'critical';
      description: string;
      requiredFix: string;
    }>;
  }>;
  blockers: string[];
  warnings: string[];
}

export interface FinalJudgeResult {
  categoryScores: {
    decisionClarity: number;
    evidenceIntegrity: number;
    methodologyReproducibility: number;
    claimSupport: number;
    commercialUsefulness: number;
    actionability: number;
    editorialQuality: number;
    visualReadability: number;
  };
  rawScore: number;
  appliedCaps: string[];
  finalScore: number;
  blockers: string[];
  releaseStatus: ReportExportStatus;
  rationale: string;
}

export interface ReportAgentOutputs {
  evidence_auditor?: EvidenceAuditResult;
  calculation_auditor?: CalculationAuditResult;
  scientific_skeptic?: ScientificReviewResult;
  decision_consistency_auditor?: DecisionConsistencyResult;
  commercial_strategist?: CommercialStrategyResult;
  action_plan_engineer?: ActionPlanResult;
  professional_report_writer?: WrittenReportResult;
  editorial_reviewer?: EditorialReviewResult;
  client_red_team?: ClientRedTeamResult;
  visual_qa_reviewer?: VisualQAResult;
  final_independent_judge?: FinalJudgeResult;
}

export interface CalculationTracePacket {
  methodology: MethodologyEvidence;
  dimensions: ReportContext['dimensions'];
  thresholds: ReportContext['thresholds'];
  gates: ReportContext['gates'];
  confidence: ReportContext['decision']['confidence'];
}

export interface RenderedPagePacket {
  page: number;
  imageUrl: string;
  width: number;
  height: number;
  text: string;
  minimumFontSizePt: number | null;
  contrastFailures: string[];
  warningRequired: boolean;
  warningVisible: boolean;
}

export interface ReportAgentPacketMap {
  evidence_auditor: {
    contextSummary: Pick<ReportContext, 'sourceEvidenceIds' | 'concept' | 'dimensions' | 'instrumental' | 'limitations'>;
    claims: ClaimRecord[];
  };
  calculation_auditor: {
    calculationTrace: CalculationTracePacket;
    renderedMethodologyText: string;
  };
  scientific_skeptic: {
    contextSummary: Pick<ReportContext, 'dimensions' | 'instrumental' | 'concept' | 'methodology' | 'limitations' | 'gates'>;
    proposedInterpretations: string[];
  };
  decision_consistency_auditor: {
    canonicalDecision: ReportContext['decision'];
    pageText: Array<{ page: number; text: string }>;
    reportTitle: string;
  };
  commercial_strategist: {
    canonicalDecision: ReportContext['decision'];
    approvedClaims: EvidenceAuditResult['claims'];
    conceptInputs: ReportContext['conceptStrategy'];
    limitations: ReportContext['limitations'];
  };
  action_plan_engineer: {
    nextGate: string;
    gates: ReportContext['gates'];
    defects: ReportDefect[];
    scientificReview: ScientificReviewResult;
    commercialStrategy: CommercialStrategyResult;
    storedActions: ReportContext['actions'];
  };
  professional_report_writer: {
    context: ReportContext;
    approvedClaims: EvidenceAuditResult['claims'];
    commercialStrategy: CommercialStrategyResult;
    actionPlan: ActionPlanResult;
    requiredLimitations: ReportContext['limitations'];
  };
  editorial_reviewer: {
    draft: WrittenReportResult;
    immutableNumbers: Array<number | string>;
    requiredLimitations: ReportContext['limitations'];
  };
  client_red_team: {
    finalDraft: WrittenReportResult;
    evidenceSummary: string[];
    methodologySummary: string[];
  };
  visual_qa_reviewer: {
    pages: RenderedPagePacket[];
    reportStage: ReportContext['stage'];
    evidenceMode: string;
  };
  final_independent_judge: {
    finalPdfText: string;
    renderedPages: RenderedPagePacket[];
    contextSummary: Pick<ReportContext, 'stage' | 'decision' | 'limitations' | 'evidenceProvenance'>;
    deterministicValidation: ValidationResult;
    specialistResults: Omit<ReportAgentOutputs, 'final_independent_judge'>;
  };
}

export type ReportAgentOutputMap = {
  evidence_auditor: EvidenceAuditResult;
  calculation_auditor: CalculationAuditResult;
  scientific_skeptic: ScientificReviewResult;
  decision_consistency_auditor: DecisionConsistencyResult;
  commercial_strategist: CommercialStrategyResult;
  action_plan_engineer: ActionPlanResult;
  professional_report_writer: WrittenReportResult;
  editorial_reviewer: EditorialReviewResult;
  client_red_team: ClientRedTeamResult;
  visual_qa_reviewer: VisualQAResult;
  final_independent_judge: FinalJudgeResult;
};

export interface ReportAgentTask<R extends ReportAgentRole = ReportAgentRole> {
  taskId: string;
  role: R;
  reportContextHash: string;
  iteration: number;
  reviewMode?: ReportReviewMode;
  packet: ReportAgentPacketMap[R];
}

export interface ReportAgentRunner {
  run<R extends ReportAgentRole>(
    task: ReportAgentTask<R>,
    options: { systemInstruction: string; temperature: number },
  ): Promise<ReportAgentOutputMap[R]>;
}

export interface ReportRenderResult {
  generatedSections: GeneratedSections;
  writtenReport: WrittenReportResult;
  finalPdfText: string;
  renderedPages: RenderedPagePacket[];
}

export interface ReportOrchestrationArtifacts {
  state: ReportAgentState;
  outputs: ReportAgentOutputs;
  defects: ReportDefect[];
  conflicts: AgentConflict[];
  repairHistory: RepairHistoryEntry[];
  humanApprovals: HumanApprovalRecord[];
  claimLineage?: ReportClaimLineage[];
  finalDraft?: WrittenReportResult;
  deterministicValidation: ValidationResult;
}
