// ════════════════════════════════════════════════════════════════════════════
// Report QC — typed model for stage-aware, evidence-grounded commercialization
// reports. The single source of truth for the deterministic quality-control
// pipeline: stage classification, separated decision semantics, the canonical
// ReportContext, claim records, validation results, and quality scores.
// ════════════════════════════════════════════════════════════════════════════

// ── 1. Stage-aware report types ─────────────────────────────────────────────
export type ReportStage =
  | 'evidence_review'          // evidence insufficient for an advancement decision
  | 'conditional_advancement'  // may proceed to a defined next gate; NOT launch-approved
  | 'commercialization_approval'; // all configured gates satisfied

export const REPORT_STAGE_TITLE: Record<ReportStage, string> = {
  evidence_review: 'Evidence Review',
  conditional_advancement: 'Conditional Advancement',
  commercialization_approval: 'Commercialization Approval',
};

// ── 2. Separated decision semantics ─────────────────────────────────────────
// These are deliberately distinct fields. They must never be merged into one
// generic "confidence" or "status" statement.
export type SensoryOutcome = 'GO' | 'TWEAK' | 'STOP' | 'INSUFFICIENT_DATA';
export type LaunchAuthorization = 'not_approved' | 'conditionally_approved' | 'approved';
export type EvidenceMaturity = 'none' | 'insufficient' | 'early' | 'limited' | 'moderate' | 'strong' | 'complete';
export type ApprovalStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected';

// The stage decision is the dominant headline — it answers "what does this report
// authorize", which is NOT the same as the sensory screening outcome.
export type StageDecisionCode =
  | 'HOLD_FOR_EVIDENCE'
  | 'ADVANCE_TO_REFORMULATION'
  | 'ADVANCE_TO_PILOT_VALIDATION'
  | 'ADVANCE_TO_CONCEPT_VALIDATION'
  | 'ADVANCE_TO_COMMERCIAL_PREPARATION'
  | 'APPROVED_FOR_LAUNCH';

export type ConfidenceLabel = 'low' | 'medium' | 'high' | 'not_available';

export interface ModelConfidenceDetail {
  value: number | null; // 0–1 fraction
  label: ConfidenceLabel;
  /** What the confidence is computed from — never a bare number. */
  basis: string[];
  methodId: string | null;
}

export interface DecisionSemantics {
  /** The deterministic sensory engine result. Supporting info only — not a launch decision. */
  sensoryOutcome: SensoryOutcome;
  /** Typed stage decision — the dominant headline. */
  stageDecisionCode: StageDecisionCode;
  /** The action this report authorizes, in plain language. */
  stageDecision: string;
  /** Model confidence as a 0–1 fraction (kept for layout); see confidence for the typed detail. */
  modelConfidence: number;
  confidence: ModelConfidenceDetail;
  /** How mature the supporting evidence is. */
  evidenceMaturity: EvidenceMaturity;
  /** Whether the product is authorized for market launch. */
  launchAuthorization: LaunchAuthorization;
  /** Workflow approval state of the report document itself. */
  approvalStatus: ApprovalStatus;
  /** The next decision gate the product must clear. */
  nextGate: string;
  /** Conditions attached to a conditional advancement. */
  conditions: string[];
}

// ── Gates ───────────────────────────────────────────────────────────────────
export type GateCategory =
  | 'sensory'
  | 'consumer'
  | 'product'
  | 'packaging'
  | 'claims'
  | 'operational'
  | 'approval';

export type GateStatus = 'pass' | 'fail' | 'pending';

export interface GateResult {
  id: string;
  category: GateCategory;
  label: string;
  status: GateStatus;
  detail: string;
}

// ── 3. Canonical ReportContext ──────────────────────────────────────────────
export type MetricDirection = 'higher_better' | 'lower_better' | 'ideal_range';

export interface RawMetric {
  label: string;
  value: number | string;
  scale?: string;
  direction?: MetricDirection;
  targetRange?: [number, number];
  /** Marks an input that was expected but not captured (drives "missing firmness" explanations). */
  missing?: boolean;
}

export interface DimensionEvidence {
  key: string;
  label: string;
  score: number;
  threshold: number;
  sampleSize: number | null;
  /** Names the study population, e.g. "Sensory panel n=14". Never a bare n. */
  population: string;
  source: string;
  /** Underlying raw or summarized measures behind the score (display strings). */
  measures: string[];
  /** Structured raw metrics with direction — used by the consistency validator. */
  rawMetrics: RawMetric[];
  /** Plain-language account of how the metrics produced the score. */
  calculationExplanation: string;
  /** Variability or panel agreement, when available. */
  agreement: string | null;
  /** Benchmark / reference comparison, when available. */
  benchmark: string | null;
  businessImplication: string;
  limitation: string | null;
}

export interface DescriptorFrequency {
  descriptor: string;
  count: number;
  sampleSize: number;
  percentage: number;
}

export interface ConceptEvidence {
  responseCount: number;
  purchaseIntent: number | null;
  descriptorFrequencies: DescriptorFrequency[];
  representativeComments: string[];
}

export interface PlanAction {
  workstream: string;
  owner: string | null;
  /** ISO date, or null when explicitly unscheduled. */
  dueDate: string | null;
  unscheduled: boolean;
  requiredAction: string;
  completionEvidence: string;
  passingThreshold: string;
  nextGate: string;
  status: string;
}

export interface RiskItem {
  category: string;
  risk: string;
  impact: string;
  mitigation: string;
  nextGate: string;
}

export interface ReportLimitation {
  id: string;
  limitation: string;
  /** Which missing evidence or constraint produced this limitation. */
  cause: string;
}

export interface ImageProvenance {
  attached: boolean;
  aiGenerated: boolean;
  label: string | null;
  directionalDisclaimer: boolean;
}

export interface ReportContext {
  // identity
  projectId: string;
  sampleId: string;
  sampleName: string;
  foodType: string;

  // stage + decision
  stage: ReportStage;
  decision: DecisionSemantics;

  // sensory evidence
  issfScore: number;
  dimensions: DimensionEvidence[];
  thresholds: { go: number; stop: number; readiness: number };
  gates: GateResult[];

  // methodology (ISSF reproducibility)
  methodology: MethodologyEvidence;

  // instrumental evidence — shown when present, explicitly absent otherwise
  instrumental: InstrumentalEvidence;

  // concept evidence
  concept: ConceptEvidence;

  // evidence provenance — the real ids that exist in the source bundle. Claims
  // must cite ids from this set; anything else is unsupported.
  sourceEvidenceIds: string[];
  evidenceProvenance: string;

  // governance / traceability
  methodVersion: string;
  decisionFingerprint: string;
  reportVersion: number;
  approvalStatus: ApprovalStatus;
  generatedAt: string;
  imageProvenance: ImageProvenance;

  // commercial planning
  risks: RiskItem[];
  actions: PlanAction[];
  claims: ClaimRecord[];
  limitations: ReportLimitation[];

  // concept strategy (hypotheses when concept n=0)
  conceptStrategy: ConceptStrategy;
}

// ── Methodology / ISSF reproducibility ──────────────────────────────────────
export interface IssfContribution {
  dimension: string;
  score: number;
  weightPct: number;
  contribution: number;
}

export interface MethodologyEvidence {
  methodId: string;
  methodVersion: string;
  weights: Record<string, number>;
  thresholds: { go: number; stop: number; readiness: number };
  contributions: IssfContribution[];
  /** Weighted dimension base before the instrument-signal blend and gate penalty. */
  weightedBase: number;
  instrumentSignal: number | null;
  gatePenalty: number;
  /** Reconciles rounded display dimensions to the stored full-precision decision trace. */
  displayPrecisionAdjustment: number;
  /** Deterministic treatment of expected-but-unobserved inputs. */
  missingDataPolicy: string;
  formula: string;
  /** ISSF reproduced from the contributions, for the consistency check. */
  reproducedIssf: number;
  /** ISSF stored on the decision record. */
  storedIssf: number;
  confidenceBasis: string[];
  confidenceCalculation: Array<{
    input: string;
    score: number;
    weightPct: number;
    contribution: number;
  }>;
  /** Why a sub-readiness dimension forces conditional advancement, not GO. */
  conditionalReason: string;
}

// ── Instrumental evidence ───────────────────────────────────────────────────
export interface InstrumentalFinding {
  source: string;
  batchId?: string;
  replicateCount?: number;
  finding: string;
  benchmark: string;
  decisionEffect: 'supports' | 'contradicts' | 'watch' | 'neutral';
}

export interface InstrumentalEvidence {
  available: boolean;
  includedInDecision: boolean;
  findings: InstrumentalFinding[];
  /** Stated explicitly when no instrumental evidence is in the decision snapshot. */
  absenceNote: string | null;
}

// ── Concept strategy (section 11) ───────────────────────────────────────────
export interface ConceptStrategy {
  /** True when all market conclusions must be labeled hypotheses (concept n=0). */
  hypothesisOnly: boolean;
  positioning: string;
  targetSegment: string;
  consumerNeed: string;
  usageOccasion: string;
  productPromise: string;
  reasonsToBelieve: string[];
  priceHypothesis: string;
  packagingHypothesis: string;
  unknowns: string[];
  conceptTestObjective: string;
  prohibitedClaims: string[];
  visualProvenance: string;
}

// ── 4. Claim-level evidence records ─────────────────────────────────────────
export type ClaimType =
  | 'sensory'
  | 'consumer_preference'
  | 'purchase_demand'
  | 'market_readiness'
  | 'health_benefit'
  | 'nutrition_benefit'
  | 'superiority'
  | 'representative_acceptance'
  | 'production_readiness'
  | 'legal_approval'
  | 'descriptive';

export type ReviewerStatus = 'unreviewed' | 'approved' | 'rejected';

export interface ClaimRecord {
  id: string;
  claim: string;
  claimType: ClaimType;
  evidenceIds: string[];
  confidence: number;
  permittedWording: string[];
  prohibitedWording: string[];
  limitations: string[];
  reviewerStatus: ReviewerStatus;
}

/** Claim types that require explicit supporting evidence or they must be blocked. */
export const RESTRICTED_CLAIM_TYPES: ClaimType[] = [
  'consumer_preference',
  'purchase_demand',
  'market_readiness',
  'health_benefit',
  'nutrition_benefit',
  'superiority',
  'representative_acceptance',
  'production_readiness',
  'legal_approval',
];

// ── 5/6. Validation + scoring results ───────────────────────────────────────
export type Severity = 'error' | 'warning';

export interface ValidationFinding {
  code: string;
  severity: Severity;
  message: string;
  /** Quality points deducted by this finding. */
  deduction: number;
  /** When true, blocks PDF export. */
  blocksExport: boolean;
}

export interface ValidationResult {
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  /** True when no export-blocking error is present. */
  exportAllowed: boolean;
}

export type QualityCategory =
  | 'decisionClarity'
  | 'evidenceCompleteness'
  | 'claimSupport'
  | 'commercialUsefulness'
  | 'actionability'
  | 'writingQuality'
  | 'visualReadability'
  | 'governance';

export const QUALITY_WEIGHTS: Record<QualityCategory, number> = {
  decisionClarity: 15,
  evidenceCompleteness: 20,
  claimSupport: 15,
  commercialUsefulness: 15,
  actionability: 10,
  writingQuality: 10,
  visualReadability: 5,
  governance: 10,
};

export interface QualityScore {
  totalScore: number;
  categoryScores: Record<QualityCategory, number>;
  blockers: string[];
  warnings: string[];
  recommendedFixes: string[];
  /** True only when all client-ready conditions are met (see scoreReportQuality). */
  clientReady: boolean;
}
