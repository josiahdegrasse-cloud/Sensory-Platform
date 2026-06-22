import { useState } from 'react';
import { Bot, CheckCircle2, CircleDollarSign, ShieldAlert } from 'lucide-react';
import type { CommercializationReportRecord } from '../lib/database';
import type { CommercializationReportSnapshot } from '../lib/commercialization-report';
import {
  createMeteredReportAgentRunner,
  estimateReportAgentCost,
  orchestrateReportAgents,
  applyAgentDraftToSnapshot,
  buildPageText,
  hashReportContext,
  renderAgentReviewedReport,
  type ReportOrchestrationArtifacts,
  type ReportReviewMode,
} from '../lib/report-agents';
import { buildGeneratedReportSections, type CommercializationReportPdfInput } from '../utils/commercialization-report-export';
import { useCreateCommercializationReport } from '../lib/hooks';
import { Button } from './ui/button';

function isReusableReview(value: unknown): value is ReportOrchestrationArtifacts {
  if (!value || typeof value !== 'object') return false;
  const artifacts = value as Partial<ReportOrchestrationArtifacts>;
  return Boolean(
    artifacts.finalDraft
    && artifacts.state
    && artifacts.state.completedAgents.length > 0
    && artifacts.state.qualityScore !== null,
  );
}

export function ReportAgentReviewPanel({
  report,
  input,
}: {
  report: CommercializationReportRecord;
  input: CommercializationReportPdfInput & { reportContext: NonNullable<CommercializationReportPdfInput['reportContext']> };
}) {
  const createReport = useCreateCommercializationReport();
  const [runningMode, setRunningMode] = useState<ReportReviewMode | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ReportOrchestrationArtifacts | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [cacheHit, setCacheHit] = useState(false);
  const [lastReview, setLastReview] = useState<{
    mode: ReportReviewMode;
    hash: string;
    artifacts: ReportOrchestrationArtifacts;
    cost: number;
    version: number;
  } | null>(null);

  const runReview = async (mode: ReportReviewMode) => {
    setRunningMode(mode);
    setError('');
    setResult(null);
    setCost(null);
    setSavedVersion(null);
    setCacheHit(false);
    const metered = createMeteredReportAgentRunner();
    try {
      const currentHash = await hashReportContext(input.reportContext);
      const persistedCache = input.snapshot.agentReview;
      const persistedCoversMode = persistedCache?.mode === mode
        || (persistedCache?.mode === 'full' && mode === 'standard');
      const localCoversMode = lastReview?.mode === mode
        || (lastReview?.mode === 'full' && mode === 'standard');
      if (lastReview
        && localCoversMode
        && lastReview.hash === currentHash
        && isReusableReview(lastReview.artifacts)) {
        setResult(lastReview.artifacts);
        setCost(0);
        setCacheHit(true);
        setSavedVersion(lastReview.version);
        return;
      }
      if (persistedCache
        && persistedCoversMode
        && persistedCache.reportContextHash === currentHash
        && isReusableReview(persistedCache.artifacts)) {
        setResult(persistedCache.artifacts);
        setCost(0);
        setCacheHit(true);
        setSavedVersion(report.version);
        return;
      }
      const generatedSections = buildGeneratedReportSections(input);
      const artifacts = await orchestrateReportAgents({
        mode,
        context: input.reportContext,
        generatedSections,
        pageText: buildPageText(generatedSections),
        runner: metered.runner,
        render: async ({ draft }) => renderAgentReviewedReport({
          baseInput: input,
          draft,
        }),
      });
      const estimatedCostUsd = estimateReportAgentCost(metered.usage);
      setResult(artifacts);
      setCost(estimatedCostUsd);

      if (artifacts.finalDraft) {
        const revisedSnapshot: CommercializationReportSnapshot = {
          ...applyAgentDraftToSnapshot(input.snapshot, artifacts.finalDraft),
          agentReview: {
            mode,
            runAt: new Date().toISOString(),
            reportContextHash: artifacts.state.reportContextHash,
            exportStatus: artifacts.state.exportStatus,
            qualityScore: artifacts.state.qualityScore,
            estimatedCostUsd,
            usage: metered.usage.map(item => ({
              role: item.role,
              model: item.model,
              inputTokens: item.inputTokens,
              outputTokens: item.outputTokens,
            })),
            artifacts: artifacts as unknown as Record<string, unknown>,
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
        setLastReview({
          mode,
          hash: artifacts.state.reportContextHash,
          artifacts,
          cost: estimatedCostUsd,
          version: saved.version,
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The full agent review could not be completed.');
    } finally {
      setRunningMode(null);
    }
  };

  const releaseTone = result?.state.exportStatus === 'client_ready'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : result?.state.exportStatus === 'blocked'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : 'border-amber-200 bg-amber-50 text-amber-900';

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-slate-700" aria-hidden />
            <h2 className="font-semibold text-slate-950">Multi-agent report writer</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Write the report to a professional standard with the full multi-agent pipeline. Use the quicker standard review while editing, or the full release review before sending a report outside your team.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <CircleDollarSign className="size-3.5" aria-hidden />
            Standard: approximately $0.08-$0.30. Full release: approximately $0.40-$1.25.
            An unchanged report reuses its last review at no additional API cost.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => runReview('full')} disabled={Boolean(runningMode) || createReport.isPending}>
            <ShieldAlert className="size-4" aria-hidden />
            {runningMode === 'full' ? 'Writing report…' : 'Write report (full multi-agent)'}
          </Button>
          <Button variant="outline" onClick={() => runReview('standard')} disabled={Boolean(runningMode) || createReport.isPending}>
            <Bot className="size-4" aria-hidden />
            {runningMode === 'standard' ? 'Running standard review…' : 'Run standard review'}
          </Button>
        </div>
      </div>

      {runningMode && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {runningMode === 'standard'
            ? 'Four focused passes are running through OpenAI. This usually takes under a minute; keep this page open.'
            : 'The complete independent release review is running through OpenAI. This usually takes one to three minutes; keep this page open.'}
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
                Review complete: {result.state.exportStatus.replace(/_/g, ' ')}
              </span>
            </div>
            <span className="text-xs font-semibold">
              Quality {result.state.qualityScore ?? 'N/A'}/100
              {cost !== null ? ` · API cost $${cost.toFixed(2)}` : ''}
            </span>
          </div>
          <p className="mt-1 text-xs">
            {result.state.completedAgents.length} specialist passes completed
            {savedVersion ? ` · saved as draft version ${savedVersion}` : ' · no revised version was saved'}
            {cacheHit ? ' · reused cached review' : ''}
            {result.state.defects.filter(defect => defect.status === 'open').length
              ? ` · ${result.state.defects.filter(defect => defect.status === 'open').length} open defects`
              : ''}
          </p>
          {result.state.deterministicBlockers.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {result.state.deterministicBlockers.slice(0, 5).map(blocker => (
                <li key={blocker}>• {blocker}</li>
              ))}
            </ul>
          )}
          {result.state.deterministicBlockers.length === 0
            && result.state.defects.some(defect => defect.status === 'open') && (
              <p className="mt-2 text-xs">
                Open readiness gaps remain in the saved draft. They do not prevent internal review, but must be resolved before external release.
              </p>
            )}
        </div>
      )}
    </section>
  );
}
