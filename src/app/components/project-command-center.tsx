import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Activity, FolderKanban } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { StageEmptyState } from './stage-empty-state';
import { useFoodType } from '../contexts/food-type-context';
import { useAuditEvents, useImportBatches, useWorkspaceSettings } from '../lib/hooks';
import { useProjectStatus } from '../lib/use-project-status';
import { ProjectStatusBadge, toneTextClasses } from './project-status-badge';
import { ProjectJourneyNav } from './project-journey-nav';
import { NextActionCard } from './next-action-card';
import { ReportPreviewCard } from './report-preview-card';
import { DataProvenanceBadge } from './data-provenance-badge';
import type { AuditEventRecord } from '../lib/database';
import type { ProjectStatusSummary } from '../lib/project-status';

/**
 * Evidence strip: six quiet, equal cells. Deliberately not the hero-metric
 * template — slate values at text-lg, provenance under each number so every
 * figure says where it came from.
 */
function EvidenceCell({ label, value, sub, valueClassName, title }: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  valueClassName?: string;
  title?: string;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0" title={title}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`text-lg font-semibold leading-tight ${valueClassName ?? 'text-slate-900'}`}>{value}</span>
      {sub}
    </div>
  );
}

function EvidenceStrip({ status }: { status: ProjectStatusSummary }) {
  const muted = 'text-slate-400';
  return (
    <Card className="border border-slate-200 bg-white">
      <CardContent className="py-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          <EvidenceCell
            label="Panel responses"
            value={status.responseTarget > 0 ? `${status.responseCompleted}/${status.responseTarget}` : '—'}
            valueClassName={status.responseCompleted === 0 ? muted : undefined}
            sub={status.responseCompleted > 0 && <DataProvenanceBadge provenance="live" n={status.responseCompleted} />}
          />
          <EvidenceCell
            label="ISSF score"
            value={status.issfScore !== null ? status.issfScore.toFixed(0) : '—'}
            valueClassName={status.issfScore === null ? muted : undefined}
          />
          <EvidenceCell
            label="Decision"
            value={status.decisionStatus}
            valueClassName={status.decisionStatus === 'Not started' ? muted : toneTextClasses(status.decisionTone)}
          />
          <EvidenceCell
            label="Confidence"
            value={status.confidence ?? '—'}
            valueClassName={status.confidence === null ? muted : status.confidence === 'High' ? 'text-emerald-700' : status.confidence === 'Low' ? 'text-amber-700' : undefined}
            title={status.confidenceFactors.join('\n')}
          />
          <EvidenceCell
            label="Winning concept"
            value={status.conceptName ?? '—'}
            valueClassName={status.conceptName ? 'text-slate-900 text-sm self-center' : muted}
          />
          <EvidenceCell
            label="Data completeness"
            value={`${status.datasetsPresent}/${status.datasetsExpected} sets`}
            valueClassName={status.datasetsPresent === 0 ? muted : undefined}
            sub={status.datasetsPresent > 0 && <DataProvenanceBadge provenance="imported" />}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function humanizeEventType(eventType: string): string {
  const text = eventType.replace(/[._-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function RecentActivity({ events, projectScoped }: { events: AuditEventRecord[]; projectScoped: boolean }) {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Activity className="size-4 text-slate-400" aria-hidden />
            Recent activity
            {!projectScoped && <span className="text-[11px] font-normal text-slate-400">(workspace-wide)</span>}
          </h3>
          <Link to="/settings" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
            View full audit log
          </Link>
        </div>
        {events.length === 0 ? (
          <p className="text-xs text-slate-400">No tracked activity yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map(event => (
              <li key={event.id} className="flex items-baseline justify-between gap-3 py-1.5 text-xs">
                <span className="text-slate-700 min-w-0 truncate">
                  {humanizeEventType(event.eventType)}
                  {event.actorName && <span className="text-slate-400"> · {event.actorName}</span>}
                </span>
                <span className="shrink-0 text-slate-400">
                  {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function NoProjectState() {
  return (
    <StageEmptyState
      icon={FolderKanban}
      headline="No project selected"
      body="Pick a project from the dashboard, or import instrument data to start a new one."
      cta={{ label: 'Back to dashboard', to: '/' }}
      secondaryCta={{ label: 'Import data', to: '/stage1' }}
    />
  );
}

/**
 * The home base for one project: identity, where it sits in the workflow,
 * the evidence collected so far, the next best action, and the report payoff.
 * Reached via /project (current selection) or /project/:batchId.
 */
export function ProjectCommandCenter() {
  const { batchId } = useParams<{ batchId: string }>();
  const { foodType, subCategory, setSelection } = useFoodType();
  const { data: importBatches = [] } = useImportBatches();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { data: auditEvents = [] } = useAuditEvents();

  const routedBatch = batchId ? importBatches.find(batch => batch.id === batchId) ?? null : null;

  // Visiting /project/:batchId pins the global selection to that project so the
  // sidebar and every stage page agree on which project is open.
  useEffect(() => {
    if (routedBatch && subCategory !== `batch:${routedBatch.id}`) {
      setSelection(routedBatch.foodTypeSlug, `batch:${routedBatch.id}`);
    }
    // setSelection is a stable-enough setter; re-running on selection echo is harmless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routedBatch?.id]);

  const effectiveFoodType = routedBatch?.foodTypeSlug ?? foodType;
  const effectiveBatchId = routedBatch?.id
    ?? (subCategory?.startsWith('batch:') ? subCategory.replace('batch:', '') : null);
  const status = useProjectStatus(effectiveFoodType, effectiveBatchId);
  const batch = routedBatch ?? (effectiveBatchId ? importBatches.find(b => b.id === effectiveBatchId) ?? null : null);

  const { projectEvents, projectScoped } = useMemo(() => {
    const needles = [effectiveBatchId, status.projectName, effectiveFoodType].filter(Boolean) as string[];
    const matched = auditEvents.filter(event => {
      const haystack = `${event.entityId ?? ''} ${JSON.stringify(event.metadata)}`;
      return needles.some(needle => haystack.includes(needle));
    });
    return matched.length > 0
      ? { projectEvents: matched.slice(0, 5), projectScoped: true }
      : { projectEvents: auditEvents.slice(0, 5), projectScoped: false };
  }, [auditEvents, effectiveBatchId, effectiveFoodType, status.projectName]);

  if (!effectiveFoodType || effectiveFoodType === 'all') {
    return (
      <div className="max-w-5xl mx-auto">
        <NoProjectState />
      </div>
    );
  }

  const contextLine = [
    status.foodTypeLabel,
    workspaceSettings?.organizationName,
    batch && `Imported ${new Date(batch.createdAt).toLocaleDateString()}`,
    batch && `${batch.sampleCount} sample${batch.sampleCount === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors">
          <ArrowLeft className="size-3.5" aria-hidden /> All projects
        </Link>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-slate-900">{status.projectName}</h1>
          <ProjectStatusBadge label={status.statusLabel} tone={status.statusTone} />
        </div>
        <p className="mt-1 text-sm text-slate-500">{contextLine}</p>
      </div>

      <Card className="border border-slate-200 bg-white">
        <CardContent className="py-3">
          <ProjectJourneyNav stages={status.stages} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <NextActionCard projectName={status.projectName} action={status.nextAction} />
          {status.warnings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {status.warnings.map(warning => (
                <ProjectStatusBadge key={warning} label={warning} tone="warning" className="font-medium" />
              ))}
            </div>
          )}
          <details className="rounded-lg border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
              Project evidence at a glance
              <span className="ml-2 font-normal text-slate-500">Responses, decision, confidence, concepts, and imported data</span>
            </summary>
            <div className="border-t border-slate-100"><EvidenceStrip status={status} /></div>
          </details>
          <RecentActivity events={projectEvents} projectScoped={projectScoped} />
        </div>
        <ReportPreviewCard status={status} />
      </div>
    </div>
  );
}
