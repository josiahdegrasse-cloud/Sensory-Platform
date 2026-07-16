import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Beaker,
  Search,
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
  const currentSignal = summary.state === 'decision_recorded'
    ? summary.supports[0]
    : summary.headline;

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
          <header className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-950">{selected.name}</h2>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">ID {selected.id}</span>
                <DataProvenanceBadge provenance={usingLiveData ? 'live' : 'reference'} n={usingLiveData ? panelResponses : undefined} />
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{currentSignal}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ProjectStatusBadge label={summary.stateLabel} tone={STATE_TONE[summary.state]} />
              <ProjectStatusBadge label={`${strength.level} evidence`} tone={STRENGTH_TONE[strength.level]} />
            </div>
          </header>

          <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <dl className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <CompactMetric label="Overall liking" value={selected.score > 0 ? `${selected.score.toFixed(1)}/9` : '—'} />
              <CompactMetric label="Panel responses" value={String(panelResponses)} />
              <CompactMetric label="Machine sources" value={`${instrumentSources}/3`} />
            </dl>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link to={actionHref}>
                {summary.nextActionLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="border border-slate-200 bg-white" aria-labelledby="sensory-graphs-heading">
          <header className="border-b border-slate-200 px-5 py-4">
            <h3 id="sensory-graphs-heading" className="text-sm font-bold text-slate-900">Sensory results</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Liking, descriptors, intensity, panelist language, and comparisons for the selected prototype.
            </p>
          </header>
          <div className="space-y-5 p-5">
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
        </section>

        {summary.experiment && (
          <section className="border border-slate-200 bg-white">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-3xl">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Beaker className="size-4" />
                  Controlled experiment
                </h3>
                <p className="mt-2 text-sm font-semibold text-slate-900">{summary.experiment.name}</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{summary.experiment.result}</p>
                {summary.experiment.learningStatus === 'approved' && summary.experiment.learningSummary && (
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    Approved learning: {summary.experiment.learningSummary}
                  </p>
                )}
              </div>
              {experimentHref && (
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link to={experimentHref}>Open experiment <ArrowRight className="size-4" /></Link>
                </Button>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dd className="text-sm font-bold text-slate-900">{value}</dd>
      <dt className="text-xs text-slate-500">{label}</dt>
    </div>
  );
}
