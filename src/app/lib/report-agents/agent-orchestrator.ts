import { buildGeneratedReportSections, type CommercializationReportPdfInput } from '../../utils/commercialization-report-export';
import { orchestrateReportAgents } from './orchestrator';
import { buildPageText, renderAgentReviewedReport } from './runtime';
import { hashReportContext } from './hash';
import { buildAgentBriefs } from './agent-brief-builder';
import { normalizeOrchestrationResult } from './agent-output-normalizer';
import type {
  ReportAgentMode,
  ReportOrchestratorResult,
} from './agent-types';
import type {
  ReportAgentRunner,
  ReportReviewMode,
} from './types';

function legacyMode(mode: ReportAgentMode): ReportReviewMode {
  return mode === 'quick_draft' ? 'standard' : 'full';
}

export const REPORT_AGENT_WORKFLOW_STEPS = [
  ['evidence_auditor', 'Evidence audit'],
  ['sensory_science', 'Sensory interpretation'],
  ['instrumental_science', 'Instrumental interpretation'],
  ['concept_packaging', 'Concept/packaging interpretation'],
  ['commercial_strategy', 'Commercial strategy'],
  ['claims_compliance', 'Claims check'],
  ['section_writer', 'Section writing'],
  ['editor', 'Editing'],
  ['qc_critic', 'QC critic'],
  ['deterministic_qc', 'Deterministic QC'],
] as const;

export async function runCommercializationReportOrchestrator(input: {
  mode: ReportAgentMode;
  reportInput: CommercializationReportPdfInput & { reportContext: NonNullable<CommercializationReportPdfInput['reportContext']> };
  runner: ReportAgentRunner;
  estimatedCost?: number;
  modelUsage?: unknown;
  previousContextHash?: string | null;
}): Promise<ReportOrchestratorResult> {
  const context = input.reportInput.reportContext;
  const reportContextHash = await hashReportContext(context);
  const generatedSections = buildGeneratedReportSections(input.reportInput);
  const briefs = buildAgentBriefs({
    ctx: context,
    mode: input.mode,
    reportContextHash,
  });

  if (!context || !input.reportInput.snapshot) {
    throw new Error('Report orchestration requires a validated ReportContext and report snapshot.');
  }
  if (context.decision.sensoryOutcome !== 'GO') {
    throw new Error('Formal commercialization report orchestration requires a confirmed GO sensory outcome.');
  }

  const artifacts = await orchestrateReportAgents({
    mode: legacyMode(input.mode),
    context,
    generatedSections,
    pageText: buildPageText(generatedSections),
    runner: input.runner,
    render: async ({ draft }) => renderAgentReviewedReport({
      baseInput: input.reportInput,
      draft,
    }),
    maxIterations: input.mode === 'quick_draft' ? 1 : 2,
  });

  const result = normalizeOrchestrationResult({
    mode: input.mode,
    ctx: context,
    snapshot: input.reportInput.snapshot,
    generated: generatedSections,
    artifacts,
    estimatedCost: input.estimatedCost,
    modelUsage: input.modelUsage,
    contextChanged: Boolean(input.previousContextHash && input.previousContextHash !== reportContextHash),
  });

  return {
    ...result,
    metadata: {
      ...result.metadata,
      agentsRun: briefs.map(brief => brief.agentName).filter(agent => agent !== 'orchestrator'),
    },
  };
}
