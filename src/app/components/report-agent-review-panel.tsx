import { useQuery } from '@tanstack/react-query';
import { Bot, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';
import { hashReportContext } from '../lib/report-agents';
import type { CommercializationReportPdfInput } from '../utils/commercialization-report-export';

export function ReportAgentReviewPanel({
  input,
}: {
  input: CommercializationReportPdfInput & { reportContext: NonNullable<CommercializationReportPdfInput['reportContext']> };
}) {
  const review = input.snapshot.agentReview;
  const previousHash = review?.reportContextHash;
  const { data: currentHash } = useQuery({
    queryKey: ['report-context-hash', input.reportContext],
    queryFn: () => hashReportContext(input.reportContext),
    enabled: Boolean(previousHash),
  });
  const contextChanged = Boolean(previousHash) && currentHash !== undefined && previousHash !== currentHash;

  if (!review) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <div>
            <h2 className="font-semibold text-amber-950">No agent generation record</h2>
            <p className="mt-1 text-sm text-amber-900">
              This older version was not created by the complete Ollama workflow. Use New version in the report header to generate a replacement.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const status = review.status ?? 'partial';
  const completeWorkflow = review.mode === 'full_release_review' || review.mode === 'full';
  const statusClass = status === 'passed'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : status === 'blocked'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : 'border-amber-200 bg-amber-50 text-amber-900';
  const runTimestamp = review.runTimestamp ?? review.runAt;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-slate-700" />
            <h2 className="font-semibold text-slate-900">Ollama generation record</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {completeWorkflow
              ? 'The complete document was generated through the specialist agent workflow and deterministic release QC.'
              : 'This legacy version used the earlier partial drafting workflow. Generate a new version to run the complete specialist workflow.'}
          </p>
        </div>
        <div className={`rounded-md border px-3 py-2 text-sm font-semibold capitalize ${statusClass}`}>
          {status.replace(/_/g, ' ')} · {review.qualityScore ?? 0}/100
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-y border-slate-200 py-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Specialist stages</p>
          <p className="mt-1 font-semibold text-slate-900">{review.agentsRun?.length ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Verified literature sources</p>
          <p className="mt-1 font-semibold text-slate-900">{input.snapshot.literatureCitations?.length ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Generated</p>
          <p className="mt-1 flex items-center gap-1.5 font-semibold text-slate-900">
            <Clock3 className="size-4 text-slate-500" />
            {runTimestamp ? new Date(runTimestamp).toLocaleString() : 'Timestamp unavailable'}
          </p>
        </div>
      </div>

      {contextChanged && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          New project evidence is available. Use New version in the report header to regenerate the complete document.
        </div>
      )}

      {!completeWorkflow && !contextChanged && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Use Generate new version in the report header to replace this legacy draft with a complete agent-generated document.
        </div>
      )}

      {(review.criticalBlockers?.length ?? 0) > 0 && (
        <div className="mt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-rose-900">
            <ShieldAlert className="size-4" />Release blockers
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-rose-800">
            {review.criticalBlockers?.slice(0, 5).map(blocker => <li key={blocker}>- {blocker}</li>)}
          </ul>
        </div>
      )}

      {(review.criticalBlockers?.length ?? 0) === 0 && (
        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" />No agent-reported critical blockers remain on this saved version.
        </p>
      )}
    </section>
  );
}
