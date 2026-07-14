export const EVIDENCE_ASSIST_SCHEMA_VERSION = 'evidence-assist.v1' as const;

export type EvidenceSourceType =
  | 'project_evidence'
  | 'literature'
  | 'method'
  | 'instrumental'
  | 'claims_guidance';

export type EvidenceUse =
  | 'decision_evidence'
  | 'scientific_context'
  | 'method_guidance'
  | 'claims_support'
  | 'validation_guidance';

export type ClaimPermission =
  | 'product_specific'
  | 'context_only'
  | 'method_only'
  | 'not_for_external_claims';

export type EvidenceConfidence = 'high' | 'medium' | 'low';

export type EvidenceAssistDecision = 'GO' | 'TWEAK' | 'STOP';

export interface EvidenceAssistProductContext {
  projectId: string;
  productId?: string;
  decisionId?: string;
  productName: string;
  foodType: string;
  productCategory: string;
  decision: EvidenceAssistDecision;
  issfScore: number;
  dimensionScores: Record<string, number>;
  sensoryPanelN: number;
  conceptPanelN: number;
  instrumentalFindings: string[];
  defects: string[];
  openGates: string[];
  currentDecisionReason: string;
  intendedReportSection: string;
  validationNeeds: string[];
  claimsQuestions: string[];
}

/**
 * The internal card is the traceability record. It is allowed to contain the
 * retrieved source material needed by reviewers, but it must never be passed
 * to a report-writing model or rendered into a client report.
 */
export interface EvidenceCard {
  id: string;
  sourceTitle: string;
  sourceType: EvidenceSourceType;
  sourcePath?: string;
  citationLabel?: string;
  productCategory?: string;
  topic: string;
  evidenceUse: EvidenceUse;
  appliesTo: string[];
  supports: string[];
  doesNotSupport: string[];
  safeReportLanguage: string | null;
  claimPermission: ClaimPermission;
  confidence: EvidenceConfidence;
  limitations: string[];
  retrievedExcerpt?: string;
  internalNotes?: string;
  sourceId?: string;
  chunkId?: string;
  retrievalScore?: number;
  contentFingerprint: string;
  classifierVersion: string;
}

/**
 * Deliberately omits sourceTitle, sourcePath, excerpt, notes and retrieval
 * metadata. This is the only evidence-card shape a report writer may receive.
 */
export interface ReportSafeEvidenceCard {
  id: string;
  citationLabel?: string;
  topic: string;
  evidenceUse: EvidenceUse;
  appliesTo: string[];
  supports: string[];
  doesNotSupport: string[];
  safeReportLanguage: string;
  claimPermission: Exclude<ClaimPermission, 'not_for_external_claims'>;
  confidence: EvidenceConfidence;
  limitations: string[];
  contentFingerprint: string;
}

export interface EvidenceAssistRejectedSource {
  sourceTitle: string;
  reason:
    | 'low_relevance'
    | 'duplicate_source'
    | 'category_mismatch'
    | 'unsafe_source'
    | 'unapproved_source'
    | 'no_report_safe_language'
    | 'classification_failed';
}

export interface EvidenceAssistResult {
  schemaVersion: typeof EVIDENCE_ASSIST_SCHEMA_VERSION;
  productId?: string;
  decisionId?: string;
  reportSection?: string;
  queryContext: string;
  cards: EvidenceCard[];
  rejectedSources: EvidenceAssistRejectedSource[];
  qcWarnings: string[];
  metadata: {
    engineMode: string;
    retrievedCount: number;
    acceptedCount: number;
    generatedAt: string;
  };
}

export interface EvidenceAssistRequest {
  productContext: EvidenceAssistProductContext;
  options?: {
    maxCards?: number;
    minimumRelevance?: number;
    evidenceUses?: EvidenceUse[];
  };
}

export interface ReportWriterContext {
  identity: {
    projectId: string;
    sampleId: string;
    productName: string;
    foodType: string;
  };
  deterministicDecision: {
    sensoryOutcome: EvidenceAssistDecision | 'INSUFFICIENT_DATA';
    stageDecision: string;
    nextGate: string;
    conditions: string[];
    issfScore: number;
  };
  dimensions: Array<{
    key: string;
    label: string;
    score: number;
    threshold: number;
    sampleSize: number | null;
    population: string;
    measures: string[];
    businessImplication: string;
  }>;
  instrumental: {
    available: boolean;
    findings: Array<{
      id: string;
      finding: string;
      benchmark: string;
      decisionEffect: string;
    }>;
  };
  concept: {
    responseCount: number;
    evidenceStrength: string;
    purchaseIntent: number | null;
  };
  limitations: Array<{ id: string; limitation: string; cause: string }>;
  sourceEvidenceIds: string[];
}

export interface ClientFacingLeakageFinding {
  code: string;
  message: string;
  excerpt: string;
}
