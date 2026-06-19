import type {
  DecisionSemantics,
  EvidenceMaturity,
  GateResult,
  ModelConfidenceDetail,
  ReportStage,
  SensoryOutcome,
  StageDecisionCode,
} from './types';

// ════════════════════════════════════════════════════════════════════════════
// Stage classification + decision semantics. The stage decision is the dominant
// headline and is derived strictly from evidence sufficiency and gate results —
// never asserted. Final-approval wording is only produced when every gate passes
// and the report is approved.
// ════════════════════════════════════════════════════════════════════════════

export interface StageInputs {
  sensoryOutcome: SensoryOutcome;
  responseCount: number;
  gates: GateResult[];
  /** Lowest dimension score — a sub-readiness dimension forces pilot validation. */
  weakestDimensionScore: number;
  readinessThreshold: number;
  approvalStatus: DecisionSemantics['approvalStatus'];
}

// Overall evidence maturity across sensory + concept evidence. n=0 still has a
// full sensory panel, so it maps to "limited", not "insufficient".
export function evidenceMaturity(responseCount: number, hasSensory = true): EvidenceMaturity {
  if (!hasSensory && responseCount === 0) return 'insufficient';
  if (responseCount >= 30) return 'strong';
  if (responseCount >= 15) return 'moderate';
  return 'limited';
}

export function stageDecisionCode(input: StageInputs): StageDecisionCode {
  if (input.sensoryOutcome === 'INSUFFICIENT_DATA' || input.sensoryOutcome === 'STOP') {
    return 'HOLD_FOR_EVIDENCE';
  }
  // A failing sensory dimension is the binding constraint — pilot reformulation
  // and revalidation come before any consumer or commercial step.
  if (input.weakestDimensionScore < input.readinessThreshold) return 'ADVANCE_TO_PILOT_VALIDATION';
  if (input.responseCount === 0) return 'ADVANCE_TO_CONCEPT_VALIDATION';
  const allGatesPass = input.gates.length > 0 && input.gates.every(g => g.status === 'pass');
  if (allGatesPass && input.approvalStatus === 'approved') return 'APPROVED_FOR_LAUNCH';
  return 'ADVANCE_TO_COMMERCIAL_PREPARATION';
}

export function reportStageFor(code: StageDecisionCode): ReportStage {
  if (code === 'HOLD_FOR_EVIDENCE') return 'evidence_review';
  if (code === 'APPROVED_FOR_LAUNCH') return 'commercialization_approval';
  return 'conditional_advancement';
}

export function determineReportStage(input: StageInputs): ReportStage {
  return reportStageFor(stageDecisionCode(input));
}

// ── Decision semantics ──────────────────────────────────────────────────────
export interface SemanticsInputs extends StageInputs {
  modelConfidence: number; // 0–1
  confidenceBasis: string[];
  methodId: string;
  defaultNextGate: string;
  conditions: string[];
}

function confidenceLabel(value: number): ModelConfidenceDetail['label'] {
  if (!Number.isFinite(value)) return 'not_available';
  if (value >= 0.85) return 'high';
  if (value >= 0.7) return 'medium';
  return 'low';
}

export function buildDecisionSemantics(input: SemanticsInputs): DecisionSemantics {
  const code = stageDecisionCode(input);
  const launchAuthorization = code === 'APPROVED_FOR_LAUNCH' ? 'approved' : 'not_approved';
  const stageDecision = STAGE_DECISION_TEXT[code];
  const value = clampFraction(input.modelConfidence);

  return {
    sensoryOutcome: input.sensoryOutcome,
    stageDecisionCode: code,
    stageDecision,
    modelConfidence: value,
    confidence: {
      value,
      label: confidenceLabel(value),
      basis: input.confidenceBasis,
      methodId: input.methodId,
    },
    evidenceMaturity: evidenceMaturity(input.responseCount),
    launchAuthorization,
    approvalStatus: input.approvalStatus,
    nextGate: input.defaultNextGate,
    conditions: input.conditions,
  };
}

const STAGE_DECISION_TEXT: Record<StageDecisionCode, string> = {
  HOLD_FOR_EVIDENCE: 'Hold for additional evidence before an advancement decision',
  ADVANCE_TO_REFORMULATION: 'Advance to reformulation, conditional on closing open sensory items',
  ADVANCE_TO_PILOT_VALIDATION: 'Advance to pilot-scale validation, conditional on closing open items',
  ADVANCE_TO_CONCEPT_VALIDATION: 'Advance to target-consumer concept validation, conditional on closing open items',
  ADVANCE_TO_COMMERCIAL_PREPARATION: 'Advance to commercial preparation, conditional on closing open items',
  APPROVED_FOR_LAUNCH: 'Approved for market launch',
};

// ── Stage-aware report titles + headline (sections "Required report title logic") ──
export interface StageHeadline {
  reportType: string;
  badge: string;
  headline: string;
  subheading: string;
}

export function stageHeadline(code: StageDecisionCode, sensoryOutcome: SensoryOutcome): StageHeadline {
  const notLaunch = 'The sensory screening outcome supports continued development. This is not approval for commercialization or market launch.';
  switch (code) {
    case 'APPROVED_FOR_LAUNCH':
      return { reportType: 'Commercialization Approval Report', badge: 'APPROVED', headline: 'APPROVED FOR MARKET LAUNCH', subheading: 'All configured gates pass and the report is approved for launch.' };
    case 'HOLD_FOR_EVIDENCE':
      return { reportType: 'Evidence Review Report', badge: 'REVIEW', headline: 'ADDITIONAL EVIDENCE REQUIRED', subheading: 'Current evidence is insufficient to authorize advancement. Collect the missing evidence before the next gate.' };
    case 'ADVANCE_TO_REFORMULATION':
      return { reportType: 'Development Advancement Report', badge: 'CONDITIONAL', headline: 'ADVANCE TO REFORMULATION — CONDITIONAL', subheading: notLaunch };
    case 'ADVANCE_TO_CONCEPT_VALIDATION':
      return { reportType: 'Development Advancement Report', badge: 'CONDITIONAL', headline: 'ADVANCE TO CONCEPT VALIDATION — CONDITIONAL', subheading: notLaunch };
    case 'ADVANCE_TO_COMMERCIAL_PREPARATION':
      return { reportType: 'Commercial Readiness Report', badge: 'CONDITIONAL', headline: 'ADVANCE TO COMMERCIAL PREPARATION — CONDITIONAL', subheading: notLaunch };
    case 'ADVANCE_TO_PILOT_VALIDATION':
    default:
      return {
        reportType: 'Development Advancement Report',
        badge: 'CONDITIONAL',
        headline: 'ADVANCE TO PILOT VALIDATION — CONDITIONAL',
        subheading: `${notLaunch}${sensoryOutcome === 'GO' ? ' The sensory GO is supporting evidence only.' : ''}`,
      };
  }
}

function clampFraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return value <= 100 ? value / 100 : 1;
  return value;
}
