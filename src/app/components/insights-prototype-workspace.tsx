import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Beaker,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  FlaskConical,
  Heart,
  Search,
  ShieldAlert,
  Tags,
} from 'lucide-react';
import { Button } from './ui/button';
import { ProjectStatusBadge } from './project-status-badge';
import { DataProvenanceBadge } from './data-provenance-badge';
import { ProductListItem, ProductListPanel } from './product-list';
import type { InsightsEvidenceStrength } from '../lib/insights';
import type { ProductEvidenceState, ProductEvidenceSummary } from '../lib/product-evidence';
import type { SemanticTone } from '../lib/project-status';

const STRENGTH_TONE: Record<InsightsEvidenceStrength['level'], SemanticTone> = {
  Insufficient: 'critical',
  Limited: 'warning',
  Moderate: 'info',
  Strong: 'success',
};

const STATE_TONE: Record<ProductEvidenceState, SemanticTone> = {
  collecting: 'warning',
  ready_for_decision: 'info',
  decision_recorded: 'success',
  experiment_in_progress: 'info',
  confirmation_required: 'warning',
  capture_learning: 'warning',
  learning_approved: 'success',
};

export interface InsightsPrototypeOption {
  id: string;
  name: string;
  score: number;
  responseCount: number;
  evidenceLabel: string;
  signalLabel: string;
  signalTone: 'success' | 'warning' | 'neutral';
}

interface EvidenceItem {
  kind: 'panel' | 'liking' | 'descriptors' | 'instrumental';
  label: string;
  detail: string;
  value: string;
  source: string;
  supports: string;
  status: 'recorded' | 'partial' | 'missing';
}

export function InsightsPrototypeWorkspace({
  prototypes,
  selectedId,
  onSelect,
  panelResponses,
  instrumentSources,
  usingLiveData,
  strength,
  summary,
  nextActionHref,
  experimentHref,
  overviewEvidence,
  likingContent,
  descriptorContent,
  intensityContent,
  commentsContent,
  comparisonContent,
}: {
  prototypes: InsightsPrototypeOption[];
  selectedId: string;
  onSelect: (sampleId: string) => void;
  panelResponses: number;
  instrumentSources: number;
  usingLiveData: boolean;
  strength: InsightsEvidenceStrength;
  summary: ProductEvidenceSummary;
  nextActionHref: string;
  experimentHref: string | null;
  overviewEvidence: EvidenceItem[];
  likingContent: ReactNode;
  descriptorContent: ReactNode;
  intensityContent: ReactNode;
  commentsContent: ReactNode;
  comparisonContent?: ReactNode;
}) {
  const [prototypeQuery, setPrototypeQuery] = useState('');
  const [prototypeSort, setPrototypeSort] = useState<'priority' | 'liking' | 'responses' | 'name'>('priority');
  const selected = prototypes.find(prototype => prototype.id === selectedId) ?? prototypes[0];
  const visiblePrototypes = useMemo(() => {
    const normalizedQuery = prototypeQuery.trim().toLowerCase();
    return [...prototypes]
      .filter(prototype => (
        !normalizedQuery
        || prototype.name.toLowerCase().includes(normalizedQuery)
        || prototype.id.toLowerCase().includes(normalizedQuery)
        || prototype.evidenceLabel.toLowerCase().includes(normalizedQuery)
      ))
      .sort((a, b) => {
        if (prototypeSort === 'liking') return b.score - a.score;
        if (prototypeSort === 'responses') return b.responseCount - a.responseCount;
        if (prototypeSort === 'name') return a.name.localeCompare(b.name);
        const priority = (prototype: InsightsPrototypeOption) => {
          if (prototype.signalLabel === 'Highest current liking') return 0;
          if (prototype.responseCount > 0 && prototype.signalTone === 'warning') return 1;
          if (prototype.responseCount > 0) return 2;
          return 3;
        };
        return priority(a) - priority(b) || b.score - a.score;
      });
  }, [prototypeQuery, prototypeSort, prototypes]);

  if (!selected) return null;

  const rankedLivePrototypes = prototypes
    .filter(prototype => prototype.responseCount > 0)
    .sort((a, b) => b.score - a.score);
  const leader = prototypes.find(prototype => prototype.signalLabel === 'Highest current liking');
  const runnerUp = rankedLivePrototypes.find(prototype => prototype.id !== leader?.id);
  const leaderDelta = leader && runnerUp ? leader.score - runnerUp.score : 0;
  const actionHref = summary.state.includes('experiment') || ['confirmation_required', 'capture_learning', 'learning_approved'].includes(summary.state)
    ? experimentHref ?? nextActionHref
    : nextActionHref;

  return (
    <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <ProductListPanel
        title="Project prototypes"
        description="Select a sample to see its evidence and next gate."
        className="lg:sticky lg:top-24 lg:self-start"
        listLabel="Project prototypes"
        controls={(
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                value={prototypeQuery}
                onChange={event => setPrototypeQuery(event.target.value)}
                placeholder="Search prototypes"
                aria-label="Search prototypes"
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <select
              value={prototypeSort}
              onChange={event => setPrototypeSort(event.target.value as typeof prototypeSort)}
              aria-label="Sort prototypes"
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="priority">Sort: action priority</option>
              <option value="liking">Sort: highest liking</option>
              <option value="responses">Sort: most responses</option>
              <option value="name">Sort: name</option>
            </select>
          </>
        )}
        footer={leader && (
          <>
            <p className="text-xs font-semibold text-slate-500">Highest current liking</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{leader.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {leaderDelta > 0 ? `${leaderDelta.toFixed(1)} points above the next sample` : 'No score separation established'}
            </p>
          </>
        )}
      >
        {visiblePrototypes.map(prototype => (
          <ProductListItem
            key={prototype.id}
            active={prototype.id === selectedId}
            onClick={() => onSelect(prototype.id)}
            title={prototype.name}
            meta={`${prototype.responseCount > 0 ? `n=${prototype.responseCount}` : 'No live panel'} · ${prototype.evidenceLabel}`}
            metric={prototype.score > 0 ? prototype.score.toFixed(1) : '—'}
            metricLabel="score"
            signal={prototype.signalLabel}
            signalTone={prototype.signalTone}
          />
        ))}
        {visiblePrototypes.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-slate-500">
            No prototypes match “{prototypeQuery}”.
          </div>
        )}
      </ProductListPanel>

      <div className="min-w-0 space-y-4">
        <section className="border border-slate-200 bg-white">
          <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-950">{selected.name}</h2>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">ID {selected.id}</span>
                <DataProvenanceBadge provenance={usingLiveData ? 'live' : 'reference'} n={usingLiveData ? panelResponses : undefined} />
              </div>
              <p className="mt-1 text-sm text-slate-600">Product evidence workspace</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ProjectStatusBadge label={summary.stateLabel} tone={STATE_TONE[summary.state]} />
              <ProjectStatusBadge label={`${strength.level} evidence`} tone={STRENGTH_TONE[strength.level]} />
            </div>
          </header>

          <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)]">
            <div>
              <p className="text-xs font-semibold text-slate-500">What the evidence says now</p>
              <h3 className="mt-1 text-lg font-bold leading-7 text-slate-950">{summary.headline}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{summary.detail}</p>
            </div>
            <dl className="grid grid-cols-3 divide-x divide-slate-200 border border-slate-200 bg-slate-50">
              <EvidenceMetric label="Overall liking" value={selected.score > 0 ? `${selected.score.toFixed(1)}/9` : '—'} />
              <EvidenceMetric label="Panel responses" value={String(panelResponses)} />
              <EvidenceMetric label="Machine sources" value={`${instrumentSources}/3`} />
            </dl>
          </div>

          <div className="grid border-t border-slate-200 lg:grid-cols-3">
            <BoundaryColumn
              icon={CheckCircle2}
              title="Evidence supports"
              items={summary.supports}
              className="border-b border-slate-200 lg:border-b-0 lg:border-r"
              iconClassName="text-emerald-700"
            />
            <BoundaryColumn
              icon={ShieldAlert}
              title="Evidence does not support"
              items={summary.doesNotSupport}
              className="border-b border-slate-200 lg:border-b-0 lg:border-r"
              iconClassName="text-amber-700"
            />
            <div className="p-5">
              <p className="text-xs font-semibold text-slate-500">Next gate</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{summary.nextActionLabel}</p>
              <Button asChild className="mt-4 w-full justify-between">
                <Link to={actionHref}>
                  {summary.nextActionLabel}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="evidence-record-heading" className="overflow-hidden border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 id="evidence-record-heading" className="text-sm font-bold text-slate-900">Proof of evidence</h3>
              <p className="mt-0.5 max-w-2xl text-xs leading-5 text-slate-600">
                Every conclusion above points back to a project-linked record for this exact sample.
              </p>
            </div>
            <ProjectStatusBadge label={`${strength.level} evidence`} tone={STRENGTH_TONE[strength.level]} />
          </div>
          <div className="hidden grid-cols-[minmax(0,11rem)_minmax(0,1.5fr)_minmax(0,1fr)_auto] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-2 text-[11px] font-semibold text-slate-500 md:grid">
            <span>Evidence source</span>
            <span>Observed in this sample</span>
            <span>What it supports</span>
            <span>Record</span>
          </div>
          <div className="divide-y divide-slate-200">
            {overviewEvidence.map(item => <EvidenceRecordRow key={item.label} item={item} />)}
          </div>
          <div className="grid gap-1 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
            <p className="text-xs font-bold text-slate-700">Evidence use</p>
            <p className="text-xs leading-5 text-slate-600">{strength.note}</p>
          </div>
        </section>

        {(summary.formulation.current || summary.experiment) && (
          <section className="border border-slate-200 bg-white">
            <header className="border-b border-slate-200 px-5 py-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Beaker className="size-4" />
                Formulation to performance
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Ingredient changes and measured performance remain separate until a controlled experiment links them.
              </p>
            </header>
            <div className="grid lg:grid-cols-2">
              <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
                <p className="text-xs font-semibold text-slate-500">Formulation comparison</p>
                {summary.formulation.current ? (
                  <>
                    <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-900">
                      {summary.formulation.previous ? `v${summary.formulation.previous.versionNumber}` : 'First recorded version'}
                      <ArrowRight className="size-4 text-slate-400" />
                      v{summary.formulation.current.versionNumber}
                    </div>
                    <ChangeList label="Added" items={summary.formulation.added} />
                    <ChangeList label="Removed" items={summary.formulation.removed} />
                    <ChangeList label="Reordered" items={summary.formulation.reordered} />
                    {summary.formulation.added.length + summary.formulation.removed.length + summary.formulation.reordered.length === 0 && (
                      <p className="mt-3 text-sm text-slate-600">No ingredient-list change is recorded between these versions.</p>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No formulation version is linked to this sample yet.</p>
                )}
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold text-slate-500">Controlled performance evidence</p>
                {summary.experiment ? (
                  <>
                    <p className="mt-2 text-sm font-bold text-slate-900">{summary.experiment.name}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{summary.experiment.result}</p>
                    {experimentHref && (
                      <Button asChild variant="outline" size="sm" className="mt-3">
                        <Link to={experimentHref}>Open experiment <ArrowRight className="size-4" /></Link>
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    No controlled experiment links the formulation change to a measured outcome. Treat the ingredient comparison as context, not causal proof.
                  </p>
                )}
              </div>
            </div>
            {summary.experiment && (
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Reusable learning</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {summary.experiment.learningStatus === 'approved'
                        ? summary.experiment.learningSummary
                        : 'This result is not reusable across projects until its learning summary, applicability, and limitations are approved.'}
                    </p>
                    {summary.experiment.learningStatus === 'approved' && summary.experiment.learningLimitations.length > 0 && (
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        Limitations: {summary.experiment.learningLimitations.join('; ')}
                      </p>
                    )}
                  </div>
                  <ProjectStatusBadge
                    label={summary.experiment.learningStatus === 'approved' ? 'Approved for reuse' : 'Not approved for reuse'}
                    tone={summary.experiment.learningStatus === 'approved' ? 'success' : 'warning'}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        <details className="border border-slate-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
            <span>
              Explore sensory detail
              <span className="ml-2 font-normal text-slate-500">Liking, descriptors, intensity, language, and sample comparisons</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-slate-500" aria-hidden />
          </summary>
          <div className="space-y-5 border-t border-slate-200 p-5">
            <div className="grid gap-4 2xl:grid-cols-2">
              <div className="min-w-0">{likingContent}</div>
              <div className="min-w-0">{descriptorContent}</div>
            </div>
            <div className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
              <div className="min-w-0">{intensityContent}</div>
              <div className="min-w-0">{commentsContent}</div>
            </div>
            {comparisonContent}
          </div>
        </details>
      </div>
    </div>
  );
}

function BoundaryColumn({
  icon: Icon,
  title,
  items,
  className,
  iconClassName,
}: {
  icon: typeof CheckCircle2;
  title: string;
  items: string[];
  className?: string;
  iconClassName: string;
}) {
  return (
    <div className={`p-5 ${className ?? ''}`}>
      <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Icon className={`size-4 ${iconClassName}`} />
        {title}
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-700">
        {items.map(item => <li key={item} className="flex gap-2"><span className="text-slate-400">•</span><span>{item}</span></li>)}
      </ul>
    </div>
  );
}

function ChangeList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-[5rem_minmax(0,1fr)] gap-2 text-xs">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="leading-5 text-slate-700">{items.join(', ')}</span>
    </div>
  );
}

const EVIDENCE_ICONS = {
  panel: ClipboardCheck,
  liking: Heart,
  descriptors: Tags,
  instrumental: FlaskConical,
};

function EvidenceRecordRow({ item }: { item: EvidenceItem }) {
  const Icon = EVIDENCE_ICONS[item.kind];
  const recorded = item.status === 'recorded';
  const partial = item.status === 'partial';
  const statusLabel = recorded ? 'Recorded' : partial ? 'Partial' : 'Not recorded';
  const statusClasses = recorded
    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    : partial
      ? 'bg-blue-50 text-blue-800 ring-blue-200'
      : 'bg-slate-100 text-slate-700 ring-slate-200';
  const StatusIcon = recorded ? CheckCircle2 : CircleHelp;

  return (
    <div className="grid gap-3 px-5 py-3 md:grid-cols-[minmax(0,11rem)_minmax(0,1.5fr)_minmax(0,1fr)_auto] md:items-start md:gap-4">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900">{item.label}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{item.source}</p>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{item.value}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">{item.detail}</p>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-slate-500 md:hidden">What it supports</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-700 md:mt-0">{item.supports}</p>
      </div>
      <span className={`inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusClasses}`}>
        <StatusIcon className="size-3" aria-hidden />
        {statusLabel}
      </span>
    </div>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 text-center">
      <dd className="text-base font-bold text-slate-900">{value}</dd>
      <dt className="mt-0.5 text-[11px] text-slate-500">{label}</dt>
    </div>
  );
}
