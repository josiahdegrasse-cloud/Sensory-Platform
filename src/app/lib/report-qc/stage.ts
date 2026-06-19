import type {
  DecisionSemantics,
  EvidenceMaturity,
  GateResult,
  ReportStage,
  SensoryOutcome,
} from './types';

// ════════════════════════════════════════════════════════════════════════════
// Stage classification + decision semantics. The stage is derived strictly from
// evidence sufficiency and gate results — never asserted. A report can only be
// "commercialization_approval" when every configured gate passes.
// ════════════════════════════════════════════════════════════════════════════

export interface StageInputs {
  sensoryOutcome: SensoryOutcome;
  responseCount: number;
  gates: GateResult[];
  /** Lowest dimension score vs the readiness line — a sub-readiness dimension blocks approval. */
  weakestDimensionScore: number;
  readinessThreshold: number;
  approvalStatus: 'draft' | 'in_review' | 'approved';
}

// Overall evidence maturity. n=0 still has sensory evidence, so it maps to
// "limited" (matching getEvidenceStrength), not "none". "none" is reserved for a
// report with no analyzable sensory basis at all.
export function evidenceMaturity(responseCount: number): EvidenceMaturity {
  if (responseCount < 5) return 'limited';
  if (responseCount < 15) return 'directional';
  if (responseCount < 30) return 'developing';
  return 'established';
}

export function determineReportStage(input: StageInputs): ReportStage {
  // Insufficient sensory basis, or no decision at all → evidence review.
  if (input.sensoryOutcome === 'INSUFFICIENT_DATA' || input.sensoryOutcome === 'STOP') {
    return 'evidence_review';
  }

  const allGatesPass = input.gates.length > 0 && input.gates.every(gate => gate.status === 'pass');
  const launchReady =
    allGatesPass
    && input.approvalStatus === 'approved'
    && input.responseCount > 0
    && input.weakestDimensionScore >= input.readinessThreshold;

  if (launchReady) return 'commercialization_approval';

  // A GO/TWEAK sensory result with open gates, weak dimensions, or thin concept
  // evidence can still advance to a defined next gate — but not launch.
  return 'conditional_advancement';
}

// ── Decision semantics ──────────────────────────────────────────────────────
// Builds the seven separated fields. Each carries one meaning; they are never
// collapsed into a single confidence/status statement.
export interface SemanticsInputs extends StageInputs {
  stage: ReportStage;
  modelConfidence: number; // 0–1
  defaultNextGate: string;
}

export function buildDecisionSemantics(input: SemanticsInputs): DecisionSemantics {
  const launchAuthorization = input.stage === 'commercialization_approval' ? 'approved' : 'not_approved';

  const stageDecision = (() => {
    switch (input.stage) {
      case 'commercialization_approval':
        return 'Approved for commercialization';
      case 'conditional_advancement':
        return 'Advance to the next development gate, conditional on closing open items';
      case 'evidence_review':
      default:
        return 'Hold for further evidence before an advancement decision';
    }
  })();

  return {
    sensoryOutcome: input.sensoryOutcome,
    stageDecision,
    modelConfidence: clampFraction(input.modelConfidence),
    evidenceMaturity: evidenceMaturity(input.responseCount),
    launchAuthorization,
    approvalStatus: input.approvalStatus,
    nextGate: input.defaultNextGate,
  };
}

// ── Stage-aware headline (section 9) ────────────────────────────────────────
export interface StageHeadline {
  badge: string;
  headline: string;
  subheading: string;
}

export function stageHeadline(stage: ReportStage, sensoryOutcome: SensoryOutcome): StageHeadline {
  switch (stage) {
    case 'commercialization_approval':
      return {
        badge: 'APPROVED',
        headline: 'APPROVED FOR COMMERCIALIZATION',
        subheading: 'All required sensory, consumer, product, packaging, claims, and approval gates are satisfied.',
      };
    case 'evidence_review':
      return {
        badge: 'REVIEW',
        headline: 'EVIDENCE REVIEW — NOT AN ADVANCEMENT DECISION',
        subheading: 'Current evidence is insufficient to authorize advancement. Collect the missing evidence before the next gate.',
      };
    case 'conditional_advancement':
    default:
      return {
        badge: 'CONDITIONAL',
        headline: 'ADVANCE TO NEXT GATE — CONDITIONAL',
        subheading: `Proceed to pilot-scale confirmation and target-consumer concept validation. This is not approval for market launch.${
          sensoryOutcome === 'GO' ? ' The sensory GO result is supporting evidence only.' : ''
        }`,
      };
  }
}

function clampFraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return value > 1 && value <= 100 ? value / 100 : 1;
  return value;
}
