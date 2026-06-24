import type { ReportContext } from '../report-qc';
import type { AgentBrief, ReportAgentMode, ReportAgentName } from './agent-types';
import {
  evidenceProvenanceFromContext,
  missingEvidenceFromContext,
  prohibitedClaimsFromContext,
} from './agent-claim-policy';

const TASKS: Record<ReportAgentName, string[]> = {
  orchestrator: ['Coordinate specialists, merge outputs, and defer truth decisions to deterministic context/QC.'],
  evidence_auditor: ['Classify evidence sources.', 'Classify supported, directional, unsupported, and missing claims.'],
  sensory_science: ['Explain panel sensory findings.', 'State response counts and panel limitations.'],
  instrumental_science: ['Explain measured instrumental findings.', 'Separate measured data from inferred meaning.'],
  commercial_strategy: ['Translate evidence and decision into next-stage recommendation.', 'Respect allowed recommendation strength.'],
  concept_packaging: ['Explain concept, target, price, selected visual, and concept evidence limits.'],
  claims_compliance: ['Rewrite risky claims safely.', 'Block unsupported marketing, health, superiority, and launch claims.'],
  section_writer: ['Draft the nine-page report structure from approved claims only.'],
  editor: ['Improve coherence and tone without adding claims.'],
  qc_critic: ['Challenge contradictions, missing limitations, unsupported claims, and export blockers.'],
};

const SCHEMA: Record<ReportAgentName, string> = {
  orchestrator: 'ReportOrchestratorResult',
  evidence_auditor: 'Evidence audit with claim classifications, missing evidence, disclaimers, and framing.',
  sensory_science: 'sensorySummary, likedDrivers, sensoryRisks, panelLimitations, suggestedReportText, claims',
  instrumental_science: 'instrumentalSummary, evidenceAlignment, instrumentalRisks, missingInstrumentalEvidence, suggestedReportText, claims',
  commercial_strategy: 'launchRecommendation, commercializationPlan, nextSteps, riskPriorities, claims',
  concept_packaging: 'conceptSummary, packagingRationale, purchaseIntentSummary, conceptLimitations, suggestedReportText, claims',
  claims_compliance: 'approvedClaims, rewrittenClaims, blockedClaims, requiredClaimCautions, claimsCautionNarrative',
  section_writer: 'sectionDrafts and finalNarrative fields',
  editor: 'editedSectionDrafts, editedNarrative, polishNotes',
  qc_critic: 'criticalBlockers, warnings, polishSuggestions, qualityScore, passFailStatus',
};

function outcome(ctx: ReportContext): 'GO' | 'TWEAK' | 'STOP' {
  if (ctx.decision.sensoryOutcome === 'STOP') return 'STOP';
  if (ctx.decision.sensoryOutcome === 'TWEAK' || ctx.decision.sensoryOutcome === 'INSUFFICIENT_DATA') return 'TWEAK';
  return 'GO';
}

export function buildAgentBriefs(input: {
  ctx: ReportContext;
  mode: ReportAgentMode;
  reportContextHash: string;
}): AgentBrief[] {
  const provenance = evidenceProvenanceFromContext(input.ctx);
  const missingEvidence = missingEvidenceFromContext(input.ctx);
  const prohibitedClaims = prohibitedClaimsFromContext(input.ctx);
  const names: ReportAgentName[] = input.mode === 'quick_draft'
    ? ['orchestrator', 'evidence_auditor', 'sensory_science', 'concept_packaging', 'claims_compliance', 'section_writer', 'editor', 'qc_critic']
    : ['orchestrator', 'evidence_auditor', 'sensory_science', 'instrumental_science', 'commercial_strategy', 'concept_packaging', 'claims_compliance', 'section_writer', 'editor', 'qc_critic'];

  return names.map(agentName => ({
    agentName,
    mode: input.mode,
    reportContextHash: input.reportContextHash,
    reportType: 'commercialization_report',
    product: {
      name: input.ctx.sampleName,
      foodType: input.ctx.foodType,
      sampleId: input.ctx.sampleId,
      importBatchId: input.ctx.instrumental.findings.find(finding => finding.batchId)?.batchId,
    },
    decision: {
      outcome: outcome(input.ctx),
      confidence: input.ctx.decision.modelConfidence,
      riskLevel: input.ctx.decision.evidenceMaturity,
      issfScore: input.ctx.issfScore,
      reasoning: input.ctx.decision.conditions,
      gates: input.ctx.gates,
      decisionFingerprint: input.ctx.decisionFingerprint,
    },
    evidenceScope: {
      allowedEvidenceKeys: input.ctx.sourceEvidenceIds,
      prohibitedClaims,
      missingEvidence,
      provenance,
    },
    assignedTasks: TASKS[agentName],
    requiredOutputSchema: SCHEMA[agentName],
  }));
}
