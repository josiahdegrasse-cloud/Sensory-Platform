import { AlertTriangle, CheckCircle2, FileWarning, ShieldCheck } from 'lucide-react';
import { Badge } from './ui/badge';
import type { ReportReadiness } from '../lib/report-context-builder';

function toneClass(ok: boolean) {
  return ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800';
}

function ReadinessItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass(ok)}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

export function ReportReadinessPanel({ readiness }: { readiness: ReportReadiness }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-slate-950">
            <ShieldCheck className="size-4 text-slate-600" />
            Report readiness
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Export and approval checks rebuilt from the saved report, evidence bundle, QC pipeline, and agent review metadata.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={readiness.exportReady ? 'bg-emerald-600' : 'bg-amber-600'}>
            {readiness.exportReady ? 'Export ready' : 'Export blocked'}
          </Badge>
          <Badge className={readiness.approvalReady ? 'bg-emerald-600' : 'bg-slate-500'}>
            {readiness.approvalReady ? 'Approval ready' : 'Approval gated'}
          </Badge>
          <Badge variant="outline" className="capitalize">Agent: {readiness.agentStatus.replace(/_/g, ' ')}</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <ReadinessItem label="Evidence bundle" value={readiness.evidenceBundleStatus} ok={readiness.evidenceBundleStatus !== 'missing'} />
        <ReadinessItem label="Sensory" value={readiness.sensoryStatus} ok={readiness.evidenceProvenance.sensory === 'live'} />
        <ReadinessItem label="Instrumental" value={readiness.instrumentalStatus} ok={readiness.evidenceProvenance.instrumental !== 'none'} />
        <ReadinessItem label="Concept" value={readiness.conceptStatus} ok={readiness.evidenceProvenance.concept === 'live'} />
        <ReadinessItem label="Purchase intent" value={readiness.purchaseIntentStatus} ok={readiness.evidenceProvenance.purchaseIntent === 'live'} />
      </div>

      {(readiness.exportBlockers.length > 0 || readiness.approvalBlockers.length > 0 || readiness.qcWarnings.length > 0) && (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-rose-900"><FileWarning className="size-4" />Export blockers</h3>
            {readiness.exportBlockers.length === 0 ? (
              <p className="mt-2 text-xs text-rose-700">None.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-rose-800">
                {readiness.exportBlockers.slice(0, 5).map(blocker => <li key={blocker}>• {blocker}</li>)}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900"><AlertTriangle className="size-4" />Approval blockers</h3>
            {readiness.approvalBlockers.length === 0 ? (
              <p className="mt-2 text-xs text-amber-700">None.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-amber-800">
                {readiness.approvalBlockers.slice(0, 5).map(blocker => <li key={blocker}>• {blocker}</li>)}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-900"><CheckCircle2 className="size-4" />QC warnings</h3>
            {readiness.qcWarnings.length === 0 ? (
              <p className="mt-2 text-xs text-blue-700">None.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-blue-800">
                {readiness.qcWarnings.slice(0, 5).map(warning => <li key={warning}>• {warning}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
