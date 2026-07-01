import type { CommercializationReportSnapshot } from '../commercialization-report';

export type ReportAgentMode = 'quick_draft' | 'full_release_review';

export type ReportAgentName =
  | 'orchestrator'
  | 'evidence_auditor'
  | 'calculation_auditor'
  | 'sensory_science_reviewer'
  | 'instrumental_science_reviewer'
  | 'consumer_insights_reviewer'
  | 'claims_compliance_reviewer'
  | 'decision_consistency_auditor'
  | 'commercial_strategist'
  | 'action_plan_engineer'
  | 'professional_report_writer'
  | 'editorial_reviewer'
  | 'client_red_team'
  | 'visual_qa_reviewer'
  | 'conflict_resolver'
  | 'final_independent_judge';

export type EvidenceStrength = 'strong' | 'directional' | 'unsupported' | 'missing';

export interface AgentClaim {
  id: string;
  text: string;
  strength: EvidenceStrength;
  evidenceKeys: string[];
  allowedLanguage: string;
  disallowedLanguage?: string[];
  reason: string;
}

export interface EvidenceProvenancePacket {
  sensory: 'live' | 'reference' | 'none';
  instrumental: 'live' | 'reference' | 'none';
  concept: 'live' | 'reference' | 'none';
  purchaseIntent: 'live' | 'reference' | 'none';
}

export interface AgentBrief {
  agentName: ReportAgentName;
  mode: ReportAgentMode;
  reportContextHash: string;
  reportType: 'commercialization_report';
  product: {
    name: string;
    foodType?: string;
    sampleId?: string;
    importBatchId?: string;
  };
  decision: {
    outcome: 'GO' | 'TWEAK' | 'STOP';
    confidence?: number;
    riskLevel?: string;
    issfScore?: number;
    reasoning?: string[];
    gates?: unknown;
    decisionFingerprint?: string;
  };
  evidenceScope: {
    allowedEvidenceKeys: string[];
    prohibitedClaims: string[];
    missingEvidence: string[];
    provenance: EvidenceProvenancePacket;
  };
  assignedTasks: string[];
  requiredOutputSchema: string;
}

export interface ReportSectionDrafts {
  executiveSummary: string;
  productPerformance: string;
  methodEvidenceIntegration: string;
  keyCommercialInsights: string;
  conceptPackagingDirection: string;
  commercializationPlan: string;
  risksWatchPoints: string;
  appendixSourceRecord: string;
  claimsLimitations: string;
}

export interface AgentOutput {
  agentName: ReportAgentName;
  status: 'passed' | 'partial' | 'failed';
  summary: string;
  claims: AgentClaim[];
  sectionDrafts?: Partial<ReportSectionDrafts>;
  warnings: string[];
  blockers: string[];
  evidenceUsed: string[];
  missingEvidence: string[];
}

export interface ReportOrchestratorResult {
  mode: ReportAgentMode;
  reportContextHash: string;
  generatedAt: string;
  status: 'passed' | 'partial' | 'blocked';
  finalNarrative: {
    executiveSummary: string;
    whyPanelistsLikedIt: string;
    packagingRationale: string;
    launchRecommendation: string;
    claimCaution: string;
  };
  sectionDrafts: Partial<ReportSectionDrafts>;
  evidenceAudit: {
    supportedClaims: AgentClaim[];
    directionalClaims: AgentClaim[];
    unsupportedClaims: AgentClaim[];
    missingEvidence: string[];
  };
  agentOutputs: AgentOutput[];
  qc: {
    criticalBlockers: string[];
    warnings: string[];
    polishSuggestions: string[];
    qualityScore: number;
  };
  metadata: {
    agentsRun: ReportAgentName[];
    retries: number;
    estimatedCost?: number;
    modelUsage?: unknown;
    contextChanged?: boolean;
  };
  snapshot: CommercializationReportSnapshot;
}
