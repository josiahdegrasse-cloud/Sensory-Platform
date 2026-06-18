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
