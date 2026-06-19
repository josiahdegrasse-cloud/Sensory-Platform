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
export type LaunchAuthorization = 'approved' | 'not_approved';
export type EvidenceMaturity = 'none' | 'limited' | 'directional' | 'developing' | 'established';
export type ApprovalStatus = 'draft' | 'in_review' | 'approved';

export interface DecisionSemantics {
  /** The deterministic sensory engine result. Supporting info only — not a launch decision. */
  sensoryOutcome: SensoryOutcome;
  /** The action this report authorizes, in plain language (e.g. "Advance to pilot-scale validation"). */
  stageDecision: string;
  /** Model confidence as a 0–1 fraction. Always paired with its meaning, never bare. */
  modelConfidence: number;
  /** How mature the supporting evidence is. */
  evidenceMaturity: EvidenceMaturity;
  /** Whether the product is authorized for market launch. */
  launchAuthorization: LaunchAuthorization;
  /** Workflow approval state of the report document itself. */
  approvalStatus: ApprovalStatus;
  /** The next decision gate the product must clear. */
  nextGate: string;
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
export interface DimensionEvidence {
  key: string;
  label: string;
  score: number;
  threshold: number;
  sampleSize: number | null;
  source: string;
  /** Underlying raw or summarized measures behind the score. */
  measures: string[];
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

  // concept evidence
  concept: ConceptEvidence;

  // evidence provenance — the real ids that exist in the source bundle. Claims
  // must cite ids from this set; anything else is unsupported.
  sourceEvidenceIds: string[];

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
