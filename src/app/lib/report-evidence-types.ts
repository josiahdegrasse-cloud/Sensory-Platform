import type { EnhancedSensoryProfile } from '../data/enhanced-sensory';
import type { DecisionOutcome, GoStopTweakDecision } from '../utils/go-stop-tweak-engine';

export type DecisionType = DecisionOutcome | 'INSUFFICIENT_DATA';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type EvidenceRecord = {
  id: string;
  evidenceType:
    | 'metric'
    | 'critical_attribute'
    | 'comparison'
    | 'missing_data'
    | 'quality_warning'
    | 'commercial_constraint';
  title: string;
  description: string;
  value?: number | string | boolean | null;
  unit?: string | null;
  sourceType: string;
  sourceId?: string | null;
  category?: string | null;
  sampleId?: string | null;
  confidence: number;
  isCritical: boolean;
};

export type SampleEvidenceSummary = {
  sampleId: string;
  sampleName: string;
  decision: DecisionType;
  issfScore: number | null;
  confidenceScore: number | null;
  riskLevel: GoStopTweakDecision['riskLevel'] | null;
  methodVersion: string | null;
  decisionFingerprint: string | null;
};

export type CategoryEvidenceResult = {
  sampleId: string;
  category: keyof GoStopTweakDecision['dimensionScores'];
  score: number;
};

export type CriticalAttributeResult = {
  sampleId: string;
  id: string;
  label: string;
  status: 'pass' | 'watch' | 'fail';
  detail: string;
  impact: number;
};

export type MissingDataIssue = {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  sampleId?: string | null;
};

export type QualityWarning = {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  sampleId?: string | null;
};

export type EvidenceBundle = {
  id: string;
  projectId: string;
  version: number;
  schemaVersion: string;
  generatedAt: string;
  sourceDataVersion: string;
  sampleSummaries: SampleEvidenceSummary[];
  categoryResults: CategoryEvidenceResult[];
  criticalAttributeResults: CriticalAttributeResult[];
  screeningAlignment?: number | null;
  rankAgreement?: number | null;
  repeatability?: number | null;
  substitutionIndex?: number | null;
  evidence: EvidenceRecord[];
  missingData: MissingDataIssue[];
  qualityWarnings: QualityWarning[];
  deterministicCandidateDecision: DecisionType;
  deterministicConfidence: ConfidenceLevel;
  decisionReasons: string[];
  createdBy: string;
  /** Underlying sensory measures behind the dimension scores — the raw evidence
   *  the report dashboard and QC pipeline cite instead of "saved decision model". */
  sensoryProfile?: SensoryProfileEvidence | null;
  commercialProfile?: CommercializationProjectProfile | null;
};

export type CommercializationProjectProfile = {
  sampleId: string;
  evidenceStatus: 'reference_demo' | 'live' | 'mixed';
  evidenceLabel: string;
  product: {
    productName: string;
    category: string;
    baseSystem: string;
    formatHypothesis: string;
    developmentStage: string;
    intendedUseHypotheses: string[];
  };
  development: {
    objective: string;
    strengths: string[];
    technicalRisks: string[];
    formulationKnown: string[];
    formulationUnknown: string[];
  };
  studyDesign: {
    sensoryPopulation: string;
    conceptPopulation: string;
    instrumentalPopulation: string;
    sensoryMethod: string;
    instrumentalMethod: string;
    collectionBoundary: string;
  };
  instrumentalSummary: Array<{
    source: string;
    finding: string;
    benchmark: string;
    effect: 'supports' | 'contradicts' | 'watch' | 'neutral';
  }>;
  conceptHypothesis: {
    positioning: string;
    targetSegment: string;
    consumerNeed: string;
    usageOccasion: string;
    productPromise: string;
    reasonsToBelieve: string[];
    priceHypothesis: string;
    packagingHypothesis: string;
    validationQuestions: string[];
  };
  claimsBoundary: {
    supportedInternalLanguage: string[];
    prohibitedUntilValidated: string[];
    requiredReviews: string[];
  };
  actionPlan: Array<{
    workstream: string;
    owner: string;
    team: string;
    dueDate: string | null;
    priority: 'critical' | 'high' | 'medium' | 'low';
    action: string;
    completionEvidence: string;
    passingCriteria: string;
    dependencies: string[];
    nextGate: string;
  }>;
};

export type SensoryProfileEvidence = {
  panelSize: number;
  /** Trained/consumer-panel CATA descriptor citations. */
  descriptors: Array<{ descriptor: string; count: number }>;
  /** Per-dimension underlying measures, keyed by dimension (hedonic/texture/cata/emotional). */
  dimensionMeasures: Record<string, string[]>;
  intensity: Record<string, number>;
  foodTypeSlug: string;
  instrumentSignal: number;
  gatePenalty: number;
  instrumentalFindings: Array<{
    source: string;
    batchId?: string;
    replicateCount?: number;
    finding: string;
    benchmark: string;
    decisionEffect: 'supports' | 'contradicts' | 'watch' | 'neutral';
  }>;
  confidenceCalculation: Array<{
    input: string;
    score: number;
    weightPct: number;
    contribution: number;
  }>;
};

export type BuildEvidenceBundleInput = {
  projectId: string;
  profiles: EnhancedSensoryProfile[];
  foodTypeSlug: string;
  createdBy: string;
  version?: number;
  generatedAt?: string;
  thresholds?: { go: number; stop: number };
  minimumResponses?: number;
};

export type EvidenceBundleRecord = {
  id: string;
  projectId: string;
  version: number;
  schemaVersion: string;
  sourceDataVersion: string;
  payload: EvidenceBundle;
  createdBy: string;
  createdAt: string;
};
