import { AlertTriangle, CheckCircle2, CloudCog, Database, RefreshCw, ShieldCheck, WalletCards, XCircle } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { useConceptImageUsage, useLibraryStatus, useRagStatus, useWorkspaceOperationalHealth } from '../lib/hooks';

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
  const health = useWorkspaceOperationalHealth();
  const rag = useRagStatus();
  const library = useLibraryStatus();
  const imageUsage = useConceptImageUsage();

  const refresh = () => {
    void health.refetch();
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
        <Button variant="outline" onClick={refresh} disabled={health.isFetching || rag.isFetching || library.isFetching}>
          <RefreshCw className={`size-4 ${health.isFetching || rag.isFetching ? 'animate-spin' : ''}`} />
          Refresh checks
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><Database className="size-5 text-slate-500" />Workspace data</CardTitle>
                <CardDescription>Supabase connectivity and processing exceptions.</CardDescription>
              </div>
              <HealthBadge healthy={Boolean(healthData?.databaseOnline) && !health.error} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-slate-500">Unresolved prototype links</span><strong>{healthData?.unresolvedLineageCount ?? '—'}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Failed pending imports</span><strong>{healthData?.failedPendingImports ?? '—'}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Failed image runs this month</span><strong>{healthData?.failedImageGenerationsThisMonth ?? '—'}</strong></div>
            <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
              Last workspace activity: {healthData?.latestAuditEventAt ? new Date(healthData.latestAuditEventAt).toLocaleString() : 'No audit event recorded'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><CloudCog className="size-5 text-slate-500" />Evidence Assist</CardTitle>
                <CardDescription>Railway research API and literature index.</CardDescription>
              </div>
              <HealthBadge healthy={rag.isSuccess && library.isSuccess} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
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
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><WalletCards className="size-5 text-slate-500" />Variable AI usage</CardTitle>
                <CardDescription>Concept-image spend against the enforced tenant cap.</CardDescription>
              </div>
              <HealthBadge healthy={!imageUsage.error && (budget === 0 || spend <= budget)} label={budget > 0 && spend > budget ? 'Cap reached' : 'Within limit'} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <span className="text-2xl font-bold text-slate-900">${spend.toFixed(2)}</span>
              <span className="text-sm text-slate-500">of {budget > 0 ? `$${budget.toFixed(2)}` : 'no cap configured'}</span>
            </div>
            <Progress value={usagePercent} />
            <p className="text-xs leading-5 text-slate-500">
              {imageUsage.data ? `Resets ${new Date(imageUsage.data.periodResetsAt).toLocaleDateString()}. Image generation is blocked server-side when the configured cap is exhausted.` : 'Usage is loading.'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-5 text-slate-500" />Recovery readiness</CardTitle>
          <CardDescription>The app can verify its own data path; provider backup retention and restore drills must be confirmed outside the app.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">Tenant boundaries</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">Database RLS and authenticated subdomain matching are enforced.</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Supabase backups</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">Verify retention and point-in-time recovery in the Supabase project before each release.</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Railway recovery</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">Keep deployment variables documented and run the health-check/rollback drill in the release checklist.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
