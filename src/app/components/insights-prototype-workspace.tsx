import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, CheckCircle2, CircleHelp } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ProjectStatusBadge } from './project-status-badge';
import { DataProvenanceBadge } from './data-provenance-badge';
import type { InsightsEvidenceStrength } from '../lib/insights';
import type { NextAction, SemanticTone } from '../lib/project-status';
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
  nextAction,
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
  nextAction: NextAction;
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
  const leader = prototypes.find(prototype => prototype.signalLabel === 'Leading prototype');
  const runnerUp = rankedLivePrototypes.find(prototype => prototype.id !== leader?.id);
  const leaderDelta = leader && runnerUp ? leader.score - runnerUp.score : 0;

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
            <p className="text-xs font-semibold text-slate-500">Project leader</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{leader.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {leaderDelta > 0 ? `${leaderDelta.toFixed(1)} points above the next sample` : 'No score separation established'}
            </p>
          </div>
        )}
      </aside>

      <div className="min-w-0">
        <Card className="border border-slate-200 bg-white">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Selected prototype</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <CardTitle className="text-2xl text-slate-950">{selected.name}</CardTitle>
                  <ProjectStatusBadge label={`${strength.level} evidence`} tone={STRENGTH_TONE[strength.level]} />
                  <DataProvenanceBadge provenance={usingLiveData ? 'live' : 'reference'} n={usingLiveData ? panelResponses : undefined} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {panelResponses} panel response{panelResponses === 1 ? '' : 's'} · {instrumentSources} of 3 instrument sources linked
                </p>
              </div>
              <Button asChild size="sm">
                <Link to={nextAction.path}>{nextAction.label}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 pt-0 md:grid-cols-3">
            <DecisionFinding label="Decision" value={nextAction.description} emphasis tone="info" />
            <DecisionFinding label="Primary strength" value={keyStrength} tone="success" />
            <DecisionFinding label="Decision risk" value={keyConcern} tone="warning" />
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-5">
            <TabsTrigger value="overview" className="py-2 data-[state=active]:bg-white data-[state=active]:text-blue-700">Decision evidence</TabsTrigger>
            <TabsTrigger value="liking" className="py-2 data-[state=active]:bg-white data-[state=active]:text-blue-700">Liking</TabsTrigger>
            <TabsTrigger value="descriptors" className="py-2 data-[state=active]:bg-white data-[state=active]:text-blue-700">Descriptors</TabsTrigger>
            <TabsTrigger value="intensity" className="py-2 data-[state=active]:bg-white data-[state=active]:text-blue-700">Intensity</TabsTrigger>
            <TabsTrigger value="comments" className="py-2 data-[state=active]:bg-white data-[state=active]:text-blue-700">Comments</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <Card className="border border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Performance and interpretation</CardTitle>
                  <p className="text-xs text-slate-500">Selected prototype scores on the 9-point liking scale.</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {likingMetrics.map(metric => (
                      <div key={metric.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3">
                        <span className="text-xs font-medium text-slate-700">{metric.label}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, (metric.score / 9) * 100)}%` }} />
                        </div>
                        <span className="text-right text-xs font-bold tabular-nums text-slate-900">{metric.score.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <OverviewMetric label="Overall liking" value={selected.score > 0 ? `${selected.score.toFixed(1)}/9` : 'Not available'} />
                    <OverviewMetric label="Emotional balance" value={emotionalBalance.toFixed(1)} />
                    <OverviewMetric label="Average intensity" value={`${averageIntensity.toFixed(1)}/${intensityMax}`} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Evidence behind the recommendation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-slate-100">
                    {overviewEvidence.map(item => (
                      <div key={item.label} className="grid grid-cols-[1rem_minmax(0,1fr)_auto] gap-2 py-3 first:pt-0 last:pb-0">
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

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="border border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top sensory descriptors</CardTitle>
                </CardHeader>
                <CardContent>
                  {descriptors.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {descriptors.slice(0, 6).map(descriptor => (
                        <span key={descriptor.label} className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                          {descriptor.label} {descriptor.percentage.toFixed(0)}%
                        </span>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500">No descriptor evidence is available.</p>}
                </CardContent>
              </Card>

              <Card className="border border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Comments that could affect the decision</CardTitle>
                </CardHeader>
                <CardContent>
                  {comments.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {comments.slice(0, 2).map((comment, index) => (
                        <p key={`${comment}-${index}`} className="py-2 text-xs leading-relaxed text-slate-600 first:pt-0 last:pb-0">“{comment}”</p>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500">No open-text comments are available for this prototype.</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="liking" className="mt-4">{likingContent}</TabsContent>
          <TabsContent value="descriptors" className="mt-4">{descriptorContent}</TabsContent>
          <TabsContent value="intensity" className="mt-4">{intensityContent}</TabsContent>
          <TabsContent value="comments" className="mt-4">{commentsContent}</TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function DecisionFinding({ label, value, emphasis = false, tone }: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone: 'info' | 'success' | 'warning';
}) {
  const classes = {
    info: 'border-blue-200 bg-blue-50',
    success: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
  }[tone];
  return (
    <div className={cn('rounded-lg border p-4', classes)}>
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <p className={cn('mt-2 leading-relaxed text-slate-800', emphasis ? 'text-base font-bold text-slate-950' : 'text-sm font-medium')}>
        {value}
      </p>
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
