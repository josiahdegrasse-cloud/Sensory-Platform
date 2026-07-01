import { buildGeneratedReportSections, type CommercializationReportPdfInput } from '../../utils/commercialization-report-export';
import { orchestrateReportAgents } from './orchestrator';
import { buildPageText, renderAgentReviewedReport } from './runtime';
import { hashReportContext } from './hash';
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
  ['calculation_auditor', 'Calculation audit'],
  ['sensory_science_reviewer', 'Sensory science review'],
  ['instrumental_science_reviewer', 'Instrumental science review'],
  ['consumer_insights_reviewer', 'Consumer insights review'],
  ['claims_compliance_reviewer', 'Claims compliance review'],
  ['decision_consistency_auditor', 'Decision consistency audit'],
  ['commercial_strategist', 'Commercial strategy'],
  ['action_plan_engineer', 'Action plan'],
  ['professional_report_writer', 'Professional writing'],
  ['editorial_reviewer', 'Editorial review'],
  ['visual_qa_reviewer', 'Visual PDF QA'],
  ['client_red_team', 'Client red-team'],
  ['conflict_resolver', 'Conflict resolution'],
  ['final_independent_judge', 'Final release judge'],
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
      agentsRun: result.agentOutputs.map(output => output.agentName),
    },
  };
}
