import type { CommercializationReportSnapshot } from '../commercialization-report';
import type { ReportContext } from '../report-qc';
import { splitClaims, normalizeClaimRecord, missingEvidenceFromContext } from './agent-claim-policy';
import type {
  AgentOutput,
  ReportAgentMode,
  ReportOrchestratorResult,
  ReportSectionDrafts,
} from './agent-types';
import type { LiteratureCitation, ReportAgentRole, ReportOrchestrationArtifacts } from './types';
import {
  applyOrchestratedNarrative,
  buildNarrativeFromSections,
  mapWrittenDraftToSections,
} from './agent-section-map';
import { mergeAgentAndDeterministicQc } from './agent-qc';
import { sanitizeLiteratureCitations } from './literature-citation-guard';
import type { GeneratedSections } from '../report-qc';
import { assertReportWriterInputSafe, type ReportSafeEvidenceCard } from '../evidence-assist';

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

// Deduped union of literatureCitations from the three roles that can
// legitimately carry them. Reads the field directly rather than routing
// through mapWrittenDraftToSections's regex matcher, which is unreliable
// for section content that regex doesn't happen to match.
function collectLiteratureCitations(artifacts: ReportOrchestrationArtifacts): LiteratureCitation[] {
  const byId = new Map<string, LiteratureCitation>();
  const sources: Array<LiteratureCitation[] | undefined> = [
    artifacts.outputs.professional_report_writer?.literatureCitations,
    artifacts.outputs.sensory_science_reviewer?.literatureCitations,
    artifacts.outputs.instrumental_science_reviewer?.literatureCitations,
  ];
  for (const list of sources) {
    for (const item of list ?? []) {
      if (item.id) byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

function collectEvidenceCards(artifacts: ReportOrchestrationArtifacts): ReportSafeEvidenceCard[] {
  const cards = artifacts.outputs.professional_report_writer?.evidenceCards ?? [];
  assertReportWriterInputSafe({ evidenceCards: cards });
  return cards;
}

// Defense-in-depth: re-verify every [lit:Lx] token against the citations
// this client actually received, mirroring report-evaluator.ts's handling
// of internal [evidence:id] tokens.
function sanitizeSectionDrafts(sections: Partial<ReportSectionDrafts>, knownIds: Set<string>): Partial<ReportSectionDrafts> {
  const sanitized: Partial<ReportSectionDrafts> = { ...sections };
  for (const key of Object.keys(sanitized) as Array<keyof ReportSectionDrafts>) {
    const value = sanitized[key];
    if (typeof value === 'string') {
      sanitized[key] = sanitizeLiteratureCitations(value, knownIds);
    }
  }
  return sanitized;
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
  const literatureCitations = collectLiteratureCitations(input.artifacts);
  const evidenceCards = collectEvidenceCards(input.artifacts);
  const knownLiteratureIds = new Set(literatureCitations.map(item => item.id));
  const sections = sanitizeSectionDrafts(
    mapWrittenDraftToSections(input.artifacts.finalDraft, input.snapshot),
    knownLiteratureIds,
  );
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
      agentsRun: [...new Set(input.artifacts.state.completedAgents.map(role => ROLE_TO_AGENT[role as ReportAgentRole] ?? 'orchestrator'))],
      retries: input.artifacts.repairHistory.length,
      estimatedCost: input.estimatedCost,
      modelUsage: input.modelUsage,
      contextChanged: input.contextChanged,
    },
    literatureCitations,
    evidenceCards,
    snapshot: applyOrchestratedNarrative(input.snapshot, narrative),
  };
}
