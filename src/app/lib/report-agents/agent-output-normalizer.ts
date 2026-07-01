import type { CommercializationReportSnapshot } from '../commercialization-report';
import type { ReportContext } from '../report-qc';
import { splitClaims, normalizeClaimRecord, missingEvidenceFromContext } from './agent-claim-policy';
import type {
  AgentOutput,
  ReportAgentMode,
  ReportOrchestratorResult,
} from './agent-types';
import type { ReportAgentRole, ReportOrchestrationArtifacts } from './types';
import {
  applyOrchestratedNarrative,
  buildNarrativeFromSections,
  mapWrittenDraftToSections,
} from './agent-section-map';
import { mergeAgentAndDeterministicQc } from './agent-qc';
import type { GeneratedSections } from '../report-qc';

const ROLE_TO_AGENT: Partial<Record<ReportAgentRole, AgentOutput['agentName']>> = {
  evidence_auditor: 'evidence_auditor',
  calculation_auditor: 'calculation_auditor',
  sensory_science_reviewer: 'sensory_science_reviewer',
  instrumental_science_reviewer: 'instrumental_science_reviewer',
  consumer_insights_reviewer: 'consumer_insights_reviewer',
  claims_compliance_reviewer: 'claims_compliance_reviewer',
  decision_consistency_auditor: 'decision_consistency_auditor',
  commercial_strategist: 'commercial_strategist',
  action_plan_engineer: 'action_plan_engineer',
  professional_report_writer: 'professional_report_writer',
  editorial_reviewer: 'editorial_reviewer',
  client_red_team: 'client_red_team',
  visual_qa_reviewer: 'visual_qa_reviewer',
  conflict_resolver: 'conflict_resolver',
  final_independent_judge: 'final_independent_judge',
};

function outputStatus(blockers: string[], warnings: string[]): AgentOutput['status'] {
  if (blockers.length > 0) return 'failed';
  if (warnings.length > 0) return 'partial';
  return 'passed';
}

function normalizeAgentOutputs(artifacts: ReportOrchestrationArtifacts): AgentOutput[] {
  return Object.entries(artifacts.outputs).map(([role, value]) => {
    const agentName = ROLE_TO_AGENT[role as ReportAgentRole] ?? 'orchestrator';
    const record = value as Record<string, unknown>;
    const blockers = Array.isArray(record.blockers) ? record.blockers.filter((item): item is string => typeof item === 'string') : [];
    const warnings = Array.isArray(record.warnings) ? record.warnings.filter((item): item is string => typeof item === 'string') : [];
    return {
      agentName,
      status: outputStatus(blockers, warnings),
      summary: `${agentName.replace(/_/g, ' ')} completed through ${role.replace(/_/g, ' ')}.`,
      claims: [],
      warnings,
      blockers,
      evidenceUsed: [],
      missingEvidence: [],
    };
  });
}

export function normalizeOrchestrationResult(input: {
  mode: ReportAgentMode;
  ctx: ReportContext;
  snapshot: CommercializationReportSnapshot;
  generated: GeneratedSections;
  artifacts: ReportOrchestrationArtifacts;
  estimatedCost?: number;
  modelUsage?: unknown;
  contextChanged?: boolean;
}): ReportOrchestratorResult {
  const allClaims = input.ctx.claims.map(claim => normalizeClaimRecord(claim, input.ctx));
  const split = splitClaims(allClaims);
  const sections = mapWrittenDraftToSections(input.artifacts.finalDraft, input.snapshot);
  const narrative = buildNarrativeFromSections(sections, input.snapshot);
  const { qc } = mergeAgentAndDeterministicQc({
    ctx: input.ctx,
    generated: input.generated,
    artifacts: input.artifacts,
  });
  const status: ReportOrchestratorResult['status'] = qc.criticalBlockers.length > 0
    ? 'blocked'
    : qc.warnings.length > 0 ? 'partial' : 'passed';
  return {
    mode: input.mode,
    reportContextHash: input.artifacts.state.reportContextHash,
    generatedAt: new Date().toISOString(),
    status,
    finalNarrative: narrative,
    sectionDrafts: sections,
    evidenceAudit: {
      ...split,
      missingEvidence: missingEvidenceFromContext(input.ctx),
    },
    agentOutputs: normalizeAgentOutputs(input.artifacts),
    qc,
    metadata: {
      agentsRun: [...new Set(normalizeAgentOutputs(input.artifacts).map(output => output.agentName))],
      retries: input.artifacts.repairHistory.length,
      estimatedCost: input.estimatedCost,
      modelUsage: input.modelUsage,
      contextChanged: input.contextChanged,
    },
    snapshot: applyOrchestratedNarrative(input.snapshot, narrative),
  };
}
