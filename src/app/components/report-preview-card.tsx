import { Link } from 'react-router';
import { ArrowRight, FileText, Check, Circle, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { ProjectStatusBadge, toneSolidClasses } from './project-status-badge';
import type { ProjectStatusSummary, ReportStatus, SemanticTone } from '../lib/project-status';

type ManifestState = 'present' | 'partial' | 'missing';

const MANIFEST_ICONS: Record<ManifestState, { icon: typeof Check; className: string }> = {
  present: { icon: Check, className: 'text-emerald-600' },
  partial: { icon: AlertTriangle, className: 'text-amber-600' },
  missing: { icon: Circle, className: 'text-slate-300' },
};

function ManifestRow({ state, label, note }: { state: ManifestState; label: string; note?: string }) {
  const { icon: Icon, className } = MANIFEST_ICONS[state];
  return (
    <li className="flex items-start gap-2 text-xs">
      <Icon className={`size-3.5 shrink-0 mt-0.5 ${className}`} aria-hidden />
      <span className={state === 'missing' ? 'text-slate-500' : 'text-slate-700'}>
        {label}
        {note && <span className="text-slate-500"> · {note}</span>}
      </span>
    </li>
  );
}

const STATUS_CONFIG: Record<ReportStatus, { label: string; tone: SemanticTone; cta: string }> = {
  'not-ready': { label: 'Not ready', tone: 'neutral', cta: 'Generate report' },
  draft: { label: 'Draft', tone: 'info', cta: 'Open draft' },
  review: { label: 'Ready for review', tone: 'warning', cta: 'Review report' },
  approved: { label: 'Approved', tone: 'success', cta: 'Open report' },
};

/**
 * The final stage of the project workflow, surfaced as a payoff the user can
 * watch fill up: status, the unlock path when it isn't ready, and a manifest
 * of the evidence the report will contain.
 */
export function ReportPreviewCard({ status, className }: { status: ProjectStatusSummary; className?: string }) {
  const config = STATUS_CONFIG[status.reportStatus];
  const reportStage = status.stages.find(stage => stage.id === 'report');
  const canOpen = status.reportStatus !== 'not-ready' || reportStage?.state === 'current';
  const hasDecision = status.decisionStatus === 'GO' || status.decisionStatus === 'TWEAK' || status.decisionStatus === 'STOP';

  return (
    <Card className={`border border-slate-200 bg-white ${className ?? ''}`}>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-200">
              <FileText className="size-4 text-slate-500" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900">Commercialization report</h3>
              <p className="text-[11px] text-slate-500">The final deliverable of this project</p>
            </div>
          </div>
          <ProjectStatusBadge label={config.label} tone={config.tone} showIcon={false} />
        </div>

        {status.reportStatus === 'not-ready' && reportStage && (
          <p className="text-xs text-slate-500 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            {reportStage.detail}
          </p>
        )}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">What it will include</p>
          <ul className="space-y-1.5">
            <ManifestRow
              state={status.responseCompleted > 0 ? 'present' : 'missing'}
              label="Sensory panel data"
              note={status.responseCompleted > 0 ? `n=${status.responseCompleted}, live` : 'no responses yet'}
            />
            <ManifestRow
              state={status.datasetsPresent === status.datasetsExpected ? 'present' : status.datasetsPresent > 0 ? 'partial' : 'missing'}
              label="Instrumental data"
              note={`${status.datasetsPresent} of ${status.datasetsExpected} datasets`}
            />
            <ManifestRow
              state={hasDecision ? 'present' : 'missing'}
              label="Decision rationale"
              note={hasDecision ? `${status.decisionStatus}${status.issfScore !== null ? `, ISSF ${status.issfScore.toFixed(0)}` : ''}` : 'no decision logged'}
            />
            <ManifestRow
              state={status.conceptName ? 'present' : 'missing'}
              label="Concept test results"
              note={status.conceptName ?? 'not run'}
            />
            <ManifestRow
              state={hasDecision ? 'present' : 'missing'}
              label="Final recommendation"
            />
          </ul>
        </div>

        {canOpen ? (
          <Link
            to="/report?create=1"
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors hover:opacity-90 ${toneSolidClasses(config.tone === 'neutral' ? 'info' : config.tone)}`}
          >
            {config.cta} <ArrowRight className="size-3.5" />
          </Link>
        ) : (
          <div
            aria-disabled
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500"
          >
            {config.cta}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
