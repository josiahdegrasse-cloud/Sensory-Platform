import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, CircleDollarSign, ShieldAlert } from 'lucide-react';
import type { CommercializationReportRecord } from '../lib/database';
import type { CommercializationReportSnapshot } from '../lib/commercialization-report';
import {
  createMeteredReportAgentRunner,
  estimateReportAgentCost,
  hashReportContext,
  runCommercializationReportOrchestrator,
  REPORT_AGENT_WORKFLOW_STEPS,
  type ReportAgentMode,
  type ReportOrchestratorResult,
} from '../lib/report-agents';
import type { CommercializationReportPdfInput } from '../utils/commercialization-report-export';
import { useCreateCommercializationReport } from '../lib/hooks';
import { Button } from './ui/button';

export function ReportAgentReviewPanel({
  report,
  input,
}: {
  report: CommercializationReportRecord;
  input: CommercializationReportPdfInput & { reportContext: NonNullable<CommercializationReportPdfInput['reportContext']> };
}) {
  const createReport = useCreateCommercializationReport();
  const [runningMode, setRunningMode] = useState<ReportAgentMode | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ReportOrchestratorResult | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [contextChanged, setContextChanged] = useState(false);

  useEffect(() => {
    let active = true;
    const previousHash = input.snapshot.agentReview?.reportContextHash;
    if (!previousHash) {
      setContextChanged(false);
      return;
    }
    hashReportContext(input.reportContext)
      .then(currentHash => {
        if (active) setContextChanged(previousHash !== currentHash);
      })
      .catch(() => {
        if (active) setContextChanged(false);
      });
    return () => { active = false; };
  }, [input.reportContext, input.snapshot.agentReview?.reportContextHash]);

  const runReview = async (mode: ReportAgentMode) => {
    setRunningMode(mode);
    setError('');
    setResult(null);
    setCost(null);
    setSavedVersion(null);
    const metered = createMeteredReportAgentRunner();
    try {
      const currentHash = await hashReportContext(input.reportContext);
      const previousHash = input.snapshot.agentReview?.reportContextHash ?? null;
      const changed = Boolean(previousHash && previousHash !== currentHash);
      setContextChanged(changed);

      const orchestrated = await runCommercializationReportOrchestrator({
        mode,
        reportInput: input,
        runner: metered.runner,
        previousContextHash: previousHash,
      });
      const estimatedCostUsd = estimateReportAgentCost(metered.usage);
      const enriched: ReportOrchestratorResult = {
        ...orchestrated,
        metadata: {
          ...orchestrated.metadata,
          estimatedCost: estimatedCostUsd,
          modelUsage: metered.usage,
          contextChanged: changed,
        },
      };
      setResult(enriched);
      setCost(estimatedCostUsd);

      const revisedSnapshot: CommercializationReportSnapshot = {
        ...enriched.snapshot,
        agentReview: {
          mode,
          runTimestamp: enriched.generatedAt,
          reportContextHash: enriched.reportContextHash,
          status: enriched.status,
          exportStatus: enriched.status,
          qualityScore: enriched.qc.qualityScore,
          agentsRun: enriched.metadata.agentsRun,
          criticalBlockers: enriched.qc.criticalBlockers,
          warnings: enriched.qc.warnings,
          polishSuggestions: enriched.qc.polishSuggestions,
          evidenceAudit: enriched.evidenceAudit as unknown as Record<string, unknown>,
          modelUsage: metered.usage,
          estimatedCostUsd,
          usage: metered.usage.map(item => ({
            role: item.role,
            model: item.model,
            inputTokens: item.inputTokens,
            outputTokens: item.outputTokens,
          })),
          artifacts: enriched as unknown as Record<string, unknown>,
        },
      };
      const saved = await createReport.mutateAsync({
        decisionRecordId: report.decisionRecordId,
        conceptTestId: report.conceptTestId,
        packagingImageId: report.packagingImageId,
        title: report.title,
        reportSnapshot: revisedSnapshot as unknown as Record<string, unknown>,
        evidenceBundleId: report.evidenceBundleId,
      });
      setSavedVersion(saved.version);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The orchestrated report workflow could not be completed.');
    } finally {
      setRunningMode(null);
    }
  };

  const releaseTone = result?.status === 'passed'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : result?.status === 'blocked'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : 'border-amber-200 bg-amber-50 text-amber-900';

  const completedAgents = new Set(result?.metadata.agentsRun ?? []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-slate-700" aria-hidden />
            <h2 className="font-semibold text-slate-950">Report Orchestrator</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            A central orchestrator coordinates specialist agents, then deterministic QC decides what is safe to save, approve, and export.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <CircleDollarSign className="size-3.5" aria-hidden />
            Quick Draft: approximately $0.08-$0.30. Full Agent Draft: approximately $0.40-$1.25.
            Deterministic evidence remains the source of truth.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => runReview('full_release_review')} disabled={Boolean(runningMode) || createReport.isPending}>
            <ShieldAlert className="size-4" aria-hidden />
            {runningMode === 'full_release_review' ? 'Running full workflow…' : 'Full Agent Draft'}
          </Button>
          <Button variant="outline" onClick={() => runReview('quick_draft')} disabled={Boolean(runningMode) || createReport.isPending}>
            <Bot className="size-4" aria-hidden />
            {runningMode === 'quick_draft' ? 'Drafting…' : 'Quick Draft'}
          </Button>
        </div>
      </div>

      {contextChanged && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          New project evidence or metadata is available since this report version was created. Generate a new draft version to include updated evidence.
        </div>
      )}

      {(runningMode || result) && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {REPORT_AGENT_WORKFLOW_STEPS.map(([key, label]) => {
            const done = key === 'deterministic_qc'
              ? Boolean(result)
              : completedAgents.has(key as never);
            return (
              <div key={key} className={`rounded-lg border px-3 py-2 text-xs ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : runningMode ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <div className="font-semibold">{label}</div>
                <div>{done ? 'Complete' : runningMode ? 'Queued / running' : 'Waiting'}</div>
              </div>
            );
          })}
        </div>
      )}

      {runningMode && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {runningMode === 'quick_draft'
            ? 'The orchestrator is running a lower-cost internal draft workflow. Keep this page open.'
            : 'The orchestrator is running the full release-review workflow with specialist agents, claims review, critic review, and deterministic QC. Keep this page open.'}
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}
      {result && (
        <div className={`mt-4 rounded-lg border px-4 py-3 ${releaseTone}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4" aria-hidden />
              <span className="text-sm font-semibold">
                Orchestrator result: {result.status.replace(/_/g, ' ')}
              </span>
            </div>
            <span className="text-xs font-semibold">
              Quality {result.qc.qualityScore}/100
              {cost !== null ? ` · API cost $${cost.toFixed(2)}` : ''}
            </span>
          </div>
          <p className="mt-1 text-xs">
            {result.metadata.agentsRun.length} specialist stages coordinated
            {savedVersion ? ` · generated draft applied and saved as version ${savedVersion}` : ' · no revised version was saved'}
            {result.metadata.retries ? ` · ${result.metadata.retries} repair/retry pass${result.metadata.retries === 1 ? '' : 'es'}` : ''}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div><strong>{result.evidenceAudit.supportedClaims.length}</strong><span className="ml-1 text-xs">supported claims</span></div>
            <div><strong>{result.evidenceAudit.directionalClaims.length}</strong><span className="ml-1 text-xs">directional claims</span></div>
            <div><strong>{result.evidenceAudit.unsupportedClaims.length}</strong><span className="ml-1 text-xs">unsupported claims</span></div>
            <div><strong>{result.evidenceAudit.missingEvidence.length}</strong><span className="ml-1 text-xs">missing evidence notes</span></div>
          </div>
          {result.qc.criticalBlockers.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {result.qc.criticalBlockers.slice(0, 5).map(blocker => (
                <li key={blocker}>• {blocker}</li>
              ))}
            </ul>
          )}
          {result.qc.criticalBlockers.length === 0 && result.qc.warnings.length > 0 && (
            <p className="mt-2 text-xs">
              Warnings remain. The draft is saved for internal review, but approval/export still depends on deterministic QC and approval gates.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
