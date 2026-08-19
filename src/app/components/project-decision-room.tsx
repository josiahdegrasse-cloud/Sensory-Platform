import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  FileText,
  GitBranch,
  Lock,
  Search,
  ShieldCheck,
  TestTube2,
  TriangleAlert,
} from 'lucide-react';
import type { AuditEventRecord } from '../lib/database';
import type {
  DecisionRoomAction,
  DecisionRoomEligibility,
  DecisionRoomLineageItem,
  DecisionRoomLineageStatus,
  DecisionRoomPrototype,
} from '../lib/project-decision-room';
import { ProjectStatusBadge } from './project-status-badge';
import { Input } from './ui/input';

interface ProjectDecisionRoomProps {
  prototypes: DecisionRoomPrototype[];
  selectedPrototype: DecisionRoomPrototype | null;
  onSelectPrototype: (prototypeKey: string) => void;
  lineage: DecisionRoomLineageItem[];
  eligibility: DecisionRoomEligibility | null;
  nextAction: DecisionRoomAction | null;
  projectEvents: AuditEventRecord[];
  projectScopedEvents: boolean;
  batchCount: number;
}

const STATUS_LABELS: Record<DecisionRoomLineageStatus, string> = {
  complete: 'Recorded',
  ready: 'Ready',
  in_progress: 'In progress',
  needs_review: 'Review',
  blocked: 'Blocked',
  not_started: 'Not started',
  not_applicable: 'Not required',
};

function lineageStatusClasses(status: DecisionRoomLineageStatus) {
  if (status === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'ready' || status === 'in_progress') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (status === 'needs_review') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (status === 'blocked') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function decisionTone(decision: DecisionRoomPrototype['decision']) {
  if (decision?.decision === 'GO') return 'success' as const;
  if (decision?.decision === 'TWEAK') return 'warning' as const;
  if (decision?.decision === 'STOP') return 'critical' as const;
  return 'neutral' as const;
}

function eligibilityClasses(tone: DecisionRoomEligibility['tone']) {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-950';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-950';
  if (tone === 'critical') return 'border-rose-200 bg-rose-50 text-rose-950';
  return 'border-slate-200 bg-slate-50 text-slate-900';
}

function PrototypeList({
  prototypes,
  selectedId,
  onSelect,
}: {
  prototypes: DecisionRoomPrototype[];
  selectedId: string | null;
  onSelect: (prototypeKey: string) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return prototypes;
    return prototypes.filter(item => `${item.sampleName} ${item.sampleId}`.toLowerCase().includes(normalized));
  }, [prototypes, query]);

  return (
    <aside className="border-b border-slate-200 bg-slate-50/70 lg:border-b-0 lg:border-r" aria-label="Project prototypes">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-950">Prototypes</h2>
          <span className="text-xs tabular-nums text-slate-500">{prototypes.length}</span>
        </div>
        <label htmlFor="prototype-search" className="relative mt-3 block">
          <span className="sr-only">Search prototypes</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            id="prototype-search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search name or ID"
            className="h-10 bg-white pl-9 text-sm"
          />
        </label>
      </div>
      <div className="max-h-72 overflow-y-auto p-2 lg:max-h-[43rem]">
        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-slate-500">No matching prototypes.</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map(item => {
              const selected = item.key === selectedId;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.key)}
                    aria-pressed={selected}
                    className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      selected
                        ? 'border-blue-300 bg-white shadow-sm'
                        : 'border-transparent hover:border-slate-200 hover:bg-white'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-950">{item.sampleName}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">ID {item.sampleId} · {item.instrumentSourceCount}/3 sources</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <ProjectStatusBadge
                        label={item.decision?.decision ?? 'No decision'}
                        tone={decisionTone(item.decision)}
                        showIcon={false}
                        className="px-1.5 py-0 text-[10px] leading-4"
                      />
                      <ChevronRight className={`size-4 ${selected ? 'text-blue-700' : 'text-slate-300'}`} aria-hidden />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function EvidenceLineage({ items }: { items: DecisionRoomLineageItem[] }) {
  return (
    <section className="mt-6" aria-labelledby="evidence-lineage-heading">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="evidence-lineage-heading" className="text-sm font-semibold text-slate-950">Evidence lineage</h2>
          <p className="mt-0.5 text-xs text-slate-500">What is linked to this prototype, and what remains project-wide.</p>
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Traceable record</span>
      </div>
      <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
        {items.map(item => {
          const StatusIcon = item.status === 'blocked'
            ? Lock
            : item.status === 'needs_review'
              ? TriangleAlert
              : item.status === 'complete'
                ? CheckCircle2
                : Circle;
          return (
            <Link
              key={item.id}
              to={item.route}
              className="grid min-h-20 gap-2 px-1 py-3 transition-colors hover:bg-slate-50 sm:grid-cols-[130px_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <StatusIcon className="size-4 text-slate-500" aria-hidden />
                {item.label}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">{item.artifact}</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.detail}</span>
              </span>
              <span className="flex items-center gap-2 sm:justify-end">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{item.scope}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${lineageStatusClasses(item.status)}`}>
                  {STATUS_LABELS[item.status]}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ActivityList({ events, projectScoped }: { events: AuditEventRecord[]; projectScoped: boolean }) {
  return (
    <section className="border-t border-slate-200 pt-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Activity className="size-4 text-slate-500" aria-hidden /> Recent activity
        </h2>
        {!projectScoped && <span className="text-[10px] font-medium uppercase tracking-wide text-amber-700">Workspace-wide</span>}
      </div>
      {events.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No tracked activity yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {events.slice(0, 4).map(event => (
            <li key={event.id} className="py-2.5 text-xs">
              <p className="font-medium capitalize text-slate-700">{event.eventType.replace(/[._-]+/g, ' ')}</p>
              <p className="mt-0.5 text-slate-500">
                {event.actorName ? `${event.actorName} · ` : ''}{formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RDWorkspace({
  prototype,
  lineage,
  eligibility,
  nextAction,
  projectEvents,
  projectScopedEvents,
}: {
  prototype: DecisionRoomPrototype;
  lineage: DecisionRoomLineageItem[];
  eligibility: DecisionRoomEligibility;
  nextAction: DecisionRoomAction;
  projectEvents: AuditEventRecord[];
  projectScopedEvents: boolean;
}) {
  const decision = prototype.decision;
  return (
    <>
      <main className="min-w-0 p-4 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">{prototype.sampleName}</h2>
              <ProjectStatusBadge label={decision?.decision ?? 'Decision required'} tone={decisionTone(decision)} showIcon={false} />
            </div>
            <p className="mt-1 text-sm text-slate-500">Prototype ID {prototype.sampleId}</p>
            {prototype.supersededDecision && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                <GitBranch className="size-3.5" aria-hidden />
                Supersedes {prototype.supersededDecision.decision} from {new Date(prototype.supersededDecision.timestamp).toLocaleDateString()}
              </p>
            )}
          </div>
          <dl className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50">
            <div className="px-3 py-2 text-center">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">ISSF</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">{decision ? decision.issfScore.toFixed(1) : '—'}</dd>
            </div>
            <div className="px-3 py-2 text-center">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Evidence</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">{decision ? `${decision.confidence.toFixed(0)}%` : '—'}</dd>
            </div>
            <div className="px-3 py-2 text-center">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Responses</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">{prototype.responseCount}</dd>
            </div>
          </dl>
        </div>

        {!prototype.decisionFormulation && prototype.currentFormulation && (
          <div className="mt-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p><span className="font-semibold">Formulation lineage needs review.</span> A current version exists, but the confirmed decision does not point to it.</p>
          </div>
        )}

        <EvidenceLineage items={lineage} />
      </main>

      <aside className="border-t border-slate-200 bg-white p-4 sm:p-5 lg:border-l lg:border-t-0" aria-label="Prototype action panel">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <TestTube2 className="size-4" aria-hidden /> Next controlled action
        </div>
        <h2 className="mt-3 text-lg font-semibold text-slate-950">{nextAction.label}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{nextAction.description}</p>
        <Link
          to={nextAction.route}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          Continue <ArrowRight className="size-4" aria-hidden />
        </Link>

        <div className={`mt-6 rounded-lg border p-3 ${eligibilityClasses(eligibility.tone)}`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {eligibility.blockers.length > 0 ? <Lock className="size-4" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
            {eligibility.label}
          </h3>
          <p className="mt-1.5 text-xs leading-5 opacity-80">{eligibility.detail}</p>
          {(eligibility.blockers.length > 0 || eligibility.warnings.length > 0) && (
            <ul className="mt-3 space-y-1.5 border-t border-current/15 pt-3 text-xs leading-5">
              {[...eligibility.blockers, ...eligibility.warnings].map(item => <li key={item}>• {item}</li>)}
            </ul>
          )}
        </div>

        <ActivityList events={projectEvents} projectScoped={projectScopedEvents} />
      </aside>
    </>
  );
}

export function ProjectDecisionRoom({
  prototypes,
  selectedPrototype,
  onSelectPrototype,
  lineage,
  eligibility,
  nextAction,
  projectEvents,
  projectScopedEvents,
  batchCount,
}: ProjectDecisionRoomProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" aria-labelledby="decision-room-title">
      <header className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <div>
          <h2 id="decision-room-title" className="text-base font-semibold text-slate-950">Project decision room</h2>
          <p className="mt-0.5 text-xs text-slate-500">{prototypes.length} prototype{prototypes.length === 1 ? '' : 's'} across {batchCount} active batch{batchCount === 1 ? '' : 'es'}</p>
        </div>
      </header>

      {prototypes.length === 0 || !selectedPrototype || !eligibility || !nextAction ? (
        <div className="p-8 text-center">
          <FileText className="mx-auto size-6 text-slate-400" aria-hidden />
          <h3 className="mt-3 text-sm font-semibold text-slate-950">No prototype records found</h3>
          <p className="mt-1 text-sm text-slate-500">Import instrumental sample data to build the project decision room.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)_310px]">
          <PrototypeList prototypes={prototypes} selectedId={selectedPrototype.key} onSelect={onSelectPrototype} />
          <RDWorkspace
            prototype={selectedPrototype}
            lineage={lineage}
            eligibility={eligibility}
            nextAction={nextAction}
            projectEvents={projectEvents}
            projectScopedEvents={projectScopedEvents}
          />
        </div>
      )}
    </section>
  );
}
