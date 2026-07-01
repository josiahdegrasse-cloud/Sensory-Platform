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
  calculation_auditor: ['Verify displayed numbers against deterministic calculation traces.', 'Flag unexplained ISSF, confidence, threshold, or rounding differences.'],
  sensory_science_reviewer: ['Challenge sensory panel interpretation.', 'Flag descriptor, CATA, agreement, benchmark, sample-size, and method-disclosure risks.'],
  instrumental_science_reviewer: ['Challenge GC-MS, E-tongue, and composition interpretation.', 'Separate measured analytical evidence from inferred product meaning.'],
  consumer_insights_reviewer: ['Summarize actual consumer/concept signals.', 'Flag overread purchase intent and small-sample interpretation risks.'],
  claims_compliance_reviewer: ['Classify risky claims safely.', 'Block unsupported marketing, health, superiority, clean-label, plant-based, and launch claims.'],
  decision_consistency_auditor: ['Compare all decision language to the canonical GO/TWEAK/STOP outcome.', 'Flag launch, approval, confidence, and next-gate conflicts.'],
  commercial_strategist: ['Translate approved evidence into commercial hypotheses.', 'Respect allowed recommendation strength and validation needs.'],
  action_plan_engineer: ['Convert defects and evidence gaps into next actions.', 'Preserve unknown owners and dates as null.'],
  professional_report_writer: ['Draft the report from approved claims only.', 'Distinguish facts, calculations, hypotheses, limitations, and actions.'],
  editorial_reviewer: ['Improve coherence and tone without adding claims.'],
  client_red_team: ['Challenge the report like a skeptical paying client.', 'Surface trust risks and likely client questions.'],
  visual_qa_reviewer: ['Inspect rendered pages for visual defects, clipping, warnings, and readability.'],
  conflict_resolver: ['Resolve specialist disagreements conservatively.', 'Softens, removes, or escalates conflicted claims.'],
  final_independent_judge: ['Apply the final release rubric.', 'Confirm blockers, hard caps, and release status.'],
};

const SCHEMA: Record<ReportAgentName, string> = {
  orchestrator: 'ReportOrchestratorResult',
  evidence_auditor: 'Evidence audit with claim classifications, missing evidence, disclaimers, and framing.',
  calculation_auditor: 'verifiedCalculations, unexplainedCalculations, numericalConflicts, blockers, warnings',
  sensory_science_reviewer: 'criticalChallenges, alternativeInterpretations, missingMethodDisclosures, blockers',
  instrumental_science_reviewer: 'criticalChallenges, alternativeInterpretations, missingMethodDisclosures, blockers',
  consumer_insights_reviewer: 'insightThemes, overreachRisks, panelLimitations, blockers, warnings',
  claims_compliance_reviewer: 'reviewedClaims, blockedClaims, requiredDisclaimers, legalReviewRequired, blockers, warnings',
  decision_consistency_auditor: 'canonicalDecisionSummary, decisionStatements, blockers, warnings',
  commercial_strategist: 'commercial conclusions, positioning hypotheses, reasons to believe, prohibited claims',
  action_plan_engineer: 'immediateActions, laterActions, readinessGaps',
  professional_report_writer: 'structured written report pages with section, claim, evidence, and limitation ids',
  editorial_reviewer: 'revisedSections, unresolvedIssues, blockers',
  client_red_team: 'trustRisks, likelyClientQuestions, ambiguousStatements, releaseRecommendation',
  visual_qa_reviewer: 'pageResults, blockers, warnings',
  conflict_resolver: 'resolutions, humanReviewRequired, warnings, blockers',
  final_independent_judge: 'categoryScores, appliedCaps, blockers, releaseStatus, rationale',
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
    ? ['orchestrator', 'evidence_auditor', 'consumer_insights_reviewer', 'claims_compliance_reviewer', 'professional_report_writer', 'editorial_reviewer']
    : [
        'orchestrator',
        'evidence_auditor',
        'calculation_auditor',
        'sensory_science_reviewer',
        'instrumental_science_reviewer',
        'consumer_insights_reviewer',
        'claims_compliance_reviewer',
        'decision_consistency_auditor',
        'commercial_strategist',
        'action_plan_engineer',
        'professional_report_writer',
        'editorial_reviewer',
        'visual_qa_reviewer',
        'client_red_team',
        'conflict_resolver',
        'final_independent_judge',
      ];

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
