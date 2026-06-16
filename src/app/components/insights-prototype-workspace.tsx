import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ProjectStatusBadge } from './project-status-badge';
import { DataProvenanceBadge } from './data-provenance-badge';
import type { InsightsEvidenceStrength } from '../lib/insights';
import type { SemanticTone } from '../lib/project-status';
import { cn } from './ui/utils';

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

interface LikingMetric {
  label: string;
  score: number;
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
  likingMetrics,
  descriptors,
  emotionalBalance,
  averageIntensity,
  intensityMax,
  comments,
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
  likingMetrics: LikingMetric[];
  descriptors: Array<{ label: string; percentage: number }>;
  emotionalBalance: number;
  averageIntensity: number;
  intensityMax: number;
  comments: string[];
  overviewEvidence: EvidenceItem[];
  likingContent: ReactNode;
  descriptorContent: ReactNode;
  intensityContent: ReactNode;
  commentsContent: ReactNode;
}) {
  const selected = prototypes.find(prototype => prototype.id === selectedId) ?? prototypes[0];
  if (!selected) return null;

  const rankedLivePrototypes = prototypes
    .filter(prototype => prototype.responseCount > 0)
    .sort((a, b) => b.score - a.score);
  const leader = prototypes.find(prototype => prototype.signalLabel === 'Highest current liking');
  const runnerUp = rankedLivePrototypes.find(prototype => prototype.id !== leader?.id);
  const leaderDelta = leader && runnerUp ? leader.score - runnerUp.score : 0;
  const claimReadiness = strength.representative
    ? strength.level === 'Strong'
      ? 'Yes, with the study context attached'
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
      <aside className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white lg:sticky lg:top-24">
        <div className="border-b border-slate-100 px-4 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Project prototypes</h2>
          <p className="mt-0.5 text-xs text-slate-500">Select a sample to update the evidence.</p>
        </div>
        <ul aria-label="Project prototypes" className="space-y-1 p-2">
          {prototypes.map(prototype => {
            const selectedPrototype = prototype.id === selectedId;
            return (
              <li key={prototype.id}>
                <button
                  type="button"
                  aria-current={selectedPrototype ? 'true' : undefined}
                  onClick={() => onSelect(prototype.id)}
                  className={cn(
                    'relative block w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                    selectedPrototype && 'bg-blue-50 ring-1 ring-inset ring-blue-200 hover:bg-blue-50',
                  )}
                >
                  <span className={cn('block pr-12 text-sm font-semibold', selectedPrototype ? 'text-blue-950' : 'text-slate-900')}>
                    {prototype.name}
                  </span>
                  <span className={cn('absolute right-3 top-3 text-lg font-bold tabular-nums', selectedPrototype ? 'text-blue-700' : 'text-slate-900')}>
                    {prototype.score > 0 ? prototype.score.toFixed(1) : '—'}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {prototype.responseCount > 0 ? `n=${prototype.responseCount}` : 'No live panel'} · {prototype.evidenceLabel}
                  </span>
                  <span className={cn(
                    'mt-2 block text-[11px] font-semibold',
                    prototype.signalTone === 'success' && 'text-emerald-700',
                    prototype.signalTone === 'warning' && 'text-amber-700',
                    prototype.signalTone === 'neutral' && 'text-slate-500',
                  )}>
                    {prototype.signalLabel}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {leader && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">Highest current liking</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{leader.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {leaderDelta > 0 ? `${leaderDelta.toFixed(1)} points above the next sample` : 'No score separation established'}
            </p>
          </div>
        )}
      </aside>

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

        <div className="grid gap-4 2xl:grid-cols-2">
          <div className="min-w-0">{likingContent}</div>
          <div className="min-w-0">{descriptorContent}</div>
        </div>

        <div className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0">{intensityContent}</div>
          <div className="min-w-0">{commentsContent}</div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Dashboard read</CardTitle>
              <p className="text-xs text-slate-500">The important interpretation, kept below the charts.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Evidence status</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-base font-bold text-slate-950">{claimReadiness}</p>
                  <ProjectStatusBadge label={`${strength.level} evidence`} tone={STRENGTH_TONE[strength.level]} />
                </div>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Recommended next step</p>
                <p className="mt-1 text-sm font-medium leading-6 text-blue-950">{nextStep}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Evidence completeness</CardTitle>
              <p className="text-xs text-slate-500">What is ready, what is still missing.</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {overviewEvidence.map(item => (
                  <div key={item.label} className="grid grid-cols-[1rem_minmax(0,1fr)_auto] gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    {item.warning
                      ? <AlertTriangle className="mt-0.5 size-4 text-amber-600" aria-hidden />
                      : item.complete
                        ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" aria-hidden />
                        : <CircleHelp className="mt-0.5 size-4 text-slate-400" aria-hidden />}
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
    </div>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="text-sm font-bold text-slate-950">{value}</p>
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
