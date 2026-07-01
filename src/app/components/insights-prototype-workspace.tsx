import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ProjectStatusBadge } from './project-status-badge';
import { DataProvenanceBadge } from './data-provenance-badge';
import { ProductListItem, ProductListPanel } from './product-list';
import type { InsightsEvidenceStrength } from '../lib/insights';
import type { SemanticTone } from '../lib/project-status';

const STRENGTH_TONE: Record<InsightsEvidenceStrength['level'], SemanticTone> = {
  Insufficient: 'critical',
  Limited: 'warning',
  Moderate: 'info',
  Strong: 'success',
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
  label: string;
  detail: string;
  value: string;
  complete: boolean;
  warning?: boolean;
}

export function InsightsPrototypeWorkspace({
  prototypes,
  selectedId,
  onSelect,
  panelResponses,
  instrumentSources,
  usingLiveData,
  strength,
  keyStrength,
  keyConcern,
  overviewEvidence,
  likingContent,
  descriptorContent,
  intensityContent,
  commentsContent,
}: {
  prototypes: InsightsPrototypeOption[];
  selectedId: string;
  onSelect: (sampleId: string) => void;
  panelResponses: number;
  instrumentSources: number;
  usingLiveData: boolean;
  strength: InsightsEvidenceStrength;
  keyStrength: string;
  keyConcern: string;
  overviewEvidence: EvidenceItem[];
  likingContent: ReactNode;
  descriptorContent: ReactNode;
  intensityContent: ReactNode;
  commentsContent: ReactNode;
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
  const claimReadiness = strength.representative
    ? strength.level === 'Strong'
      ? 'Ready with study context attached'
      : 'Use with qualification'
    : 'Still collecting';
  const snapshotHeadline = usingLiveData
    ? keyStrength
    : instrumentSources > 0
      ? 'Machine data is linked. Panel preference is the next evidence layer.'
      : 'No trained panel results have been collected for this sample yet.';
  const nextStep = usingLiveData
    ? keyConcern
    : 'Collect trained panel responses to support liking, preference, and purchase-related claims.';

  return (
    <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <ProductListPanel
        title="Project prototypes"
        description="Find and rank samples without losing your place."
        className="lg:sticky lg:top-24"
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
          {visiblePrototypes.map(prototype => {
            const selectedPrototype = prototype.id === selectedId;
            return (
              <ProductListItem
                  key={prototype.id}
                  active={selectedPrototype}
                  onClick={() => onSelect(prototype.id)}
                  title={prototype.name}
                  meta={`${prototype.responseCount > 0 ? `n=${prototype.responseCount}` : 'No live panel'} · ${prototype.evidenceLabel}`}
                  metric={prototype.score > 0 ? prototype.score.toFixed(1) : '—'}
                  metricLabel="score"
                  signal={prototype.signalLabel}
                  signalTone={prototype.signalTone}
                />
            );
          })}
          {visiblePrototypes.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-slate-500">
              No prototypes match “{prototypeQuery}”.
            </div>
          )}
      </ProductListPanel>

      <div className="min-w-0 space-y-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Viewing food sample</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold text-blue-950">{selected.name}</h3>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                  ID {selected.id}
                </span>
                <DataProvenanceBadge provenance={usingLiveData ? 'live' : 'reference'} n={usingLiveData ? panelResponses : undefined} />
              </div>
              <p className="mt-2 text-sm leading-6 text-blue-950">{snapshotHeadline}</p>
            </div>
            <div className="grid shrink-0 grid-cols-3 gap-2 text-center">
              <OverviewMetric label="Overall liking" value={selected.score > 0 ? `${selected.score.toFixed(1)}/9` : '—'} />
              <CoveragePill label="Panel responses" value={String(panelResponses)} ready={panelResponses > 0} />
              <CoveragePill label="Machine sources" value={`${instrumentSources}/3`} ready={instrumentSources > 0} />
            </div>
          </div>
        </div>

        <Card className="border border-slate-200">
          <CardHeader className="border-b border-slate-200 pb-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-baseline gap-2">
                <CardTitle className="text-sm">Product development brief</CardTitle>
                <p className="truncate text-xs text-slate-500">A decision-first read before the sensory evidence.</p>
              </div>
              <ProjectStatusBadge label={`${strength.level} evidence`} tone={STRENGTH_TONE[strength.level]} />
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <dl className="grid gap-x-4 gap-y-2.5 md:grid-cols-3">
              <BriefItem label="Protect" value={keyStrength} tone="success" />
              <BriefItem label="Improve or validate" value={keyConcern} tone="warning" />
              <BriefItem label="Next decision" value={`${claimReadiness}. ${nextStep}`} tone="info" />
            </dl>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 pt-1">
          <h3 className="text-sm font-bold text-slate-900">Liking and sensory identity</h3>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="grid gap-4 2xl:grid-cols-2">
          <div className="min-w-0">{likingContent}</div>
          <div className="min-w-0">{descriptorContent}</div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <h3 className="text-sm font-bold text-slate-900">Intensity and panelist language</h3>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0">{intensityContent}</div>
          <div className="min-w-0">{commentsContent}</div>
        </div>

        <Card className="border border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Evidence completeness</CardTitle>
              <p className="text-xs text-slate-500">What is ready, what is still missing.</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {overviewEvidence.map(item => (
                  <div key={item.label} className="grid grid-cols-[1rem_minmax(0,1fr)_auto] gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {item.warning
                      ? <AlertTriangle className="mt-0.5 size-4 text-amber-600" aria-hidden />
                      : item.complete
                        ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" aria-hidden />
                        : <CircleHelp className="mt-0.5 size-4 text-slate-500" aria-hidden />}
                    <div>
                      <p className="text-xs font-bold text-slate-900">{item.label}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.detail}</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BriefItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'info';
}) {
  const iconClasses = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200',
    info: 'bg-blue-50 text-blue-700 ring-blue-200',
  }[tone];
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : CircleHelp;
  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2.5">
      <span className={`flex size-6 items-center justify-center rounded-md ring-1 ${iconClasses}`}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div>
        <dt className="text-xs font-bold text-slate-700">{label}</dt>
        <dd className="mt-0.5 text-[13px] leading-5 text-slate-700">{value}</dd>
      </div>
    </div>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function CoveragePill({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${ready ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
      <p className={`text-lg font-bold ${ready ? 'text-emerald-800' : 'text-slate-900'}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}
