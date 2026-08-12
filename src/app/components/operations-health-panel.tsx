import { AlertTriangle, CheckCircle2, ChevronDown, CloudCog, Database, RefreshCw, ShieldCheck, WalletCards, XCircle } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { useConceptImageUsage, useLibraryStatus, usePrototypeLineageIssues, useRagStatus, useWorkspaceOperationalHealth } from '../lib/hooks';
import { projectPath } from '../lib/project-journey-routes';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { useState } from 'react';

function HealthBadge({ healthy, label }: { healthy: boolean; label?: string }) {
  return healthy ? (
    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
      <CheckCircle2 className="size-3.5" />{label ?? 'Operational'}
    </Badge>
  ) : (
    <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
      <XCircle className="size-3.5" />{label ?? 'Needs attention'}
    </Badge>
  );
}

export function OperationsHealthPanel() {
  const [lineageOpen, setLineageOpen] = useState(false);
  const health = useWorkspaceOperationalHealth();
  const lineage = usePrototypeLineageIssues();
  const rag = useRagStatus();
  const library = useLibraryStatus();
  const imageUsage = useConceptImageUsage();

  const refreshing = health.isFetching || lineage.isFetching || rag.isFetching || library.isFetching || imageUsage.isFetching;
  const lastUpdatedAt = Math.max(health.dataUpdatedAt, rag.dataUpdatedAt, library.dataUpdatedAt, imageUsage.dataUpdatedAt);
  const checkFailed = Boolean(health.error || rag.error || library.error || imageUsage.error);

  const refresh = () => {
    void health.refetch();
    void lineage.refetch();
    void rag.refetch();
    void library.refetch();
    void imageUsage.refetch();
  };

  const spend = imageUsage.data?.spend ?? 0;
  const budget = imageUsage.data?.budget ?? 0;
  const usagePercent = budget > 0 ? Math.min(100, (spend / budget) * 100) : 0;
  const healthData = health.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Operations and cost controls</h2>
          <p className="mt-1 text-sm text-slate-500">Live tenant-scoped checks for data, research, imports, lineage, and variable AI spend.</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Checking…' : 'Refresh checks'}
          </Button>
          <p className={`text-xs ${checkFailed ? 'text-rose-700' : 'text-slate-500'}`} aria-live="polite">
            {checkFailed
              ? 'One or more operational checks failed. Review the checks below.'
              : lastUpdatedAt > 0
                ? `Last checked ${new Date(lastUpdatedAt).toLocaleString()}`
                : 'Checks have not completed yet.'}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white lg:grid lg:grid-cols-3 lg:divide-x lg:divide-slate-200">
        <section className="border-b border-slate-200 p-5 lg:border-b-0">
          <header>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Database className="size-4 text-slate-500" />Workspace data</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Supabase connectivity and processing exceptions.</p>
              </div>
              <HealthBadge healthy={Boolean(healthData?.databaseOnline) && !health.error} />
            </div>
          </header>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-slate-500">Lineage records needing evidence</span><strong>{healthData?.unresolvedLineageCount ?? '—'}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Failed pending imports</span><strong>{healthData?.failedPendingImports ?? '—'}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Failed image runs this month</span><strong>{healthData?.failedImageGenerationsThisMonth ?? '—'}</strong></div>
            <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
              Last workspace activity: {healthData?.latestAuditEventAt ? new Date(healthData.latestAuditEventAt).toLocaleString() : 'No audit event recorded'}
            </p>
            {(healthData?.unresolvedLineageCount ?? 0) > 0 && (
              <Collapsible open={lineageOpen} onOpenChange={setLineageOpen} className="rounded-md border border-amber-200 bg-amber-50">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-amber-900">
                  Review affected records
                  <ChevronDown className={`size-4 transition-transform ${lineageOpen ? 'rotate-180' : ''}`} aria-hidden />
                </CollapsibleTrigger>
                <CollapsibleContent className="max-h-64 space-y-2 overflow-y-auto border-t border-amber-200 p-2">
                  {(lineage.data ?? []).map(issue => (
                    <div key={`${issue.entityType}-${issue.entityId}`} className="rounded-md bg-white p-2 text-xs text-slate-700">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">{issue.entityType.replace(/_/g, ' ')} · {issue.sampleKey ?? 'No sample key'}</p>
                          <p className="mt-0.5 leading-4">{issue.reason}</p>
                        </div>
                        {issue.projectId && (
                          <Link
                            to={projectPath(issue.projectId, issue.entityType === 'decision' ? 'decision' : 'data')}
                            className="shrink-0 font-semibold text-blue-700 hover:underline"
                          >
                            Review
                          </Link>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">Record {issue.entityId.slice(0, 8)}</p>
                    </div>
                  ))}
                  {!lineage.isLoading && (lineage.data?.length ?? 0) === 0 && (
                    <p className="p-2 text-xs text-amber-900">The queue changed. Refresh checks to confirm the current count.</p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </section>

        <section className="border-b border-slate-200 p-5 lg:border-b-0">
          <header>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CloudCog className="size-4 text-slate-500" />Evidence Assist</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Research API and Supabase literature index.</p>
              </div>
              <HealthBadge healthy={rag.isSuccess && library.isSuccess} />
            </div>
          </header>
          <div className="mt-5 space-y-3 text-sm">
            {rag.isSuccess ? (
              <>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Indexed documents</span><strong>{rag.data.document_count}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Search chunks</span><strong>{rag.data.chunk_count.toLocaleString()}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Report writer</span><strong>{rag.data.llm_enabled ? rag.data.llm_provider : 'Deterministic'}</strong></div>
              </>
            ) : (
              <p className="rounded-md bg-rose-50 p-3 text-rose-700">The research service did not answer its authenticated health check.</p>
            )}
            {library.data && library.data.errorDocuments > 0 && (
              <p className="flex gap-2 rounded-md bg-amber-50 p-3 text-amber-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{library.data.errorDocuments} literature item(s) require review.</p>
            )}
          </div>
        </section>

        <section className="p-5">
          <header>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><WalletCards className="size-4 text-slate-500" />Variable AI usage</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Concept-image spend against the enforced tenant cap.</p>
              </div>
              <HealthBadge healthy={!imageUsage.error && (budget === 0 || spend <= budget)} label={budget > 0 && spend > budget ? 'Cap reached' : 'Within limit'} />
            </div>
          </header>
          <div className="mt-5 space-y-3">
            <div className="flex items-end justify-between gap-3">
              <span className="text-2xl font-bold text-slate-900">${spend.toFixed(2)}</span>
              <span className="text-sm text-slate-500">of {budget > 0 ? `$${budget.toFixed(2)}` : 'no cap configured'}</span>
            </div>
            <Progress value={usagePercent} />
            <p className="text-xs leading-5 text-slate-500">
              {imageUsage.data ? `Resets ${new Date(imageUsage.data.periodResetsAt).toLocaleDateString()}. Image generation is blocked server-side when the configured cap is exhausted.` : 'Usage is loading.'}
            </p>
            <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-amber-700">
              Report-agent token use is recorded in each report. A shared monthly report cap remains unavailable until durable AI jobs can be added to the restored database and research service.
            </p>
          </div>
        </section>
      </div>

      <section className="border-t border-slate-200 pt-5">
        <div className="max-w-3xl">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck className="size-4 text-slate-500" />Recovery readiness</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">The app can verify its data path; provider retention and restore drills are confirmed outside the app.</p>
        </div>
        <div className="mt-4 grid divide-y divide-slate-200 border-y border-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="py-3 md:pr-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CheckCircle2 className="size-4 text-emerald-700" />Tenant boundaries</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Database RLS and authenticated subdomain matching are enforced.</p>
          </div>
          <div className="py-3 md:px-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><AlertTriangle className="size-4 text-amber-700" />Supabase backups</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Verify retention and point-in-time recovery before each release.</p>
          </div>
          <div className="py-3 md:pl-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><AlertTriangle className="size-4 text-amber-700" />Research API recovery</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Document environment variables and run the authenticated health-check and rollback drill.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
