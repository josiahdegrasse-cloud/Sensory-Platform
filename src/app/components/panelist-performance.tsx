import { CHART_CHROME, STATUS } from '../styles/tokens';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  Users, AlertTriangle, ChevronDown, ChevronUp, Activity,
  Award, Star, Shield, UserCheck, TrendingUp, FlaskConical,
} from 'lucide-react';
import {
  computePanelistMetrics, suggestTrainingTier,
  repeatabilityLabel, fRatioLabel, deviationLabel,
  TRAINING_LEVELS, TRAINING_LEVEL_LABELS,
  type PanelistMetrics, type TrainingLevel,
} from '../utils/panelist-metrics';
import { useAllResponses, useProducts, usePanelists, useUpdatePanelistTrainingLevel } from '../lib/hooks';
import type { PanelistInfo } from '../lib/database';
import type { QuestionnaireResponse } from '../data/mock-users';

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_COLOR: Record<TrainingLevel, string> = {
  screened: 'bg-slate-100 text-slate-700 border-slate-300',
  trained: 'bg-blue-100 text-blue-800 border-blue-300',
  certified: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  expert: 'bg-amber-100 text-amber-800 border-amber-300',
};

const TIER_ICON: Record<TrainingLevel, React.ReactNode> = {
  screened: <UserCheck className="size-3" />,
  trained: <Shield className="size-3" />,
  certified: <Award className="size-3" />,
  expert: <Star className="size-3" />,
};

function TierBadge({ level }: { level: TrainingLevel }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${TIER_COLOR[level]}`}>
      {TIER_ICON[level]}
      {TRAINING_LEVEL_LABELS[level]}
    </span>
  );
}

// ── Metric colour helpers ─────────────────────────────────────────────────────

function repColor(r: number | null) {
  if (r === null) return 'text-slate-400';
  if (r >= 0.85) return 'text-emerald-700';
  if (r >= 0.75) return 'text-blue-700';
  if (r >= 0.60) return 'text-amber-700';
  return 'text-rose-700';
}

function fColor(f: number | null) {
  if (f === null) return 'text-slate-400';
  if (f >= 4.0) return 'text-emerald-700';
  if (f >= 2.5) return 'text-blue-700';
  if (f >= 1.5) return 'text-amber-700';
  return 'text-rose-700';
}

function devColor(d: number | null) {
  if (d === null) return 'text-slate-400';
  if (d < 1.0) return 'text-emerald-700';
  if (d < 1.5) return 'text-blue-700';
  if (d < 2.5) return 'text-amber-700';
  return 'text-rose-700';
}

// ── Scale usage mini bars ─────────────────────────────────────────────────────

function ScaleMiniBar({ distribution }: { distribution: number[] }) {
  const max = Math.max(...distribution, 1);
  return (
    <div className="flex items-end gap-0.5 h-6">
      {distribution.map((count, i) => (
        <div key={i} className="flex flex-col items-center gap-0" style={{ width: '10%' }}>
          <div
            className="w-full rounded-sm bg-blue-400"
            style={{ height: `${(count / max) * 20}px`, minHeight: count > 0 ? '2px' : '0' }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Attribute deviation bar ───────────────────────────────────────────────────

function AttributeDevBars({ deviations }: { deviations: PanelistMetrics['attributeDeviations'] }) {
  const keys = ['overall', 'appearance', 'aroma', 'flavor', 'texture'] as const;
  return (
    <div className="space-y-1">
      {keys.map(key => {
        const val = deviations[key];
        if (val === undefined) return null;
        const pct = Math.min(100, (val / 4) * 100);
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 w-20 capitalize">{key}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${val < 1.0 ? 'bg-emerald-500' : val < 1.5 ? 'bg-blue-500' : val < 2.5 ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-600 w-8 text-right">{val.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Expanded detail ───────────────────────────────────────────────────────────

function PanelistDetail({
  metrics,
  panelist,
  suggested,
  onUpdateTier,
}: {
  metrics: PanelistMetrics;
  panelist: PanelistInfo;
  suggested: TrainingLevel;
  onUpdateTier: (level: TrainingLevel) => void;
}) {
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-4">

      {/* Attribute deviations */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Deviation per Dimension</p>
        <AttributeDevBars deviations={metrics.attributeDeviations} />
      </div>

      {/* Scale usage */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Scale Usage (1–9)</p>
          <span className="text-[10px] text-slate-500">
            Range: {metrics.scaleUsageRange?.toFixed(0) ?? '—'} · SD: {metrics.scaleUsageSD?.toFixed(1) ?? '—'}
          </span>
        </div>
        <div className="flex items-end gap-0.5 h-8 bg-slate-50 rounded px-1 pt-1">
          {metrics.scaleDistribution.map((count, i) => {
            const max = Math.max(...metrics.scaleDistribution, 1);
            return (
              <div key={i} className="flex flex-col items-center flex-1">
                <div
                  className="w-full rounded-sm bg-blue-400 transition-all"
                  style={{ height: `${(count / max) * 24}px`, minHeight: count > 0 ? '2px' : '0' }}
                  title={`Score ${i + 1}: ${count}×`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-0.5 px-1">
          {[1,2,3,4,5,6,7,8,9].map(n => <span key={n} className="text-[9px] text-slate-400 flex-1 text-center">{n}</span>)}
        </div>
      </div>

      {/* Session drift */}
      {metrics.driftData.length >= 2 && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Score Drift vs. Panel</p>
          <ResponsiveContainer width="100%" height={70}>
            <LineChart data={metrics.driftData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="session" tick={{ fontSize: 9 }} />
              <YAxis domain={[1, 9]} tick={{ fontSize: 9 }} />
              <RechartsTooltip
                contentStyle={{ fontSize: 10, padding: '4px 8px' }}
                formatter={(v: number, name: string) => [v.toFixed(1), name === 'myMean' ? 'Panelist' : 'Panel avg']}
                labelFormatter={(l: number) => `Session ${l}`}
              />
              <ReferenceLine y={5} stroke={CHART_CHROME.grid} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="panelMean" stroke={CHART_CHROME.muted} strokeWidth={1} dot={false} name="panelMean" />
              <Line type="monotone" dataKey="myMean" stroke={STATUS.info} strokeWidth={2} dot={{ r: 2 }} name="myMean" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-0.5">
            <span className="flex items-center gap-1 text-[10px] text-blue-600"><span className="w-3 h-0.5 bg-blue-500 inline-block" />Panelist</span>
            <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-3 h-0.5 bg-slate-400 inline-block" />Panel avg</span>
          </div>
        </div>
      )}

      {/* Calibration */}
      {metrics.calibrationDeviation !== null && (
        <div className="p-2 rounded-lg bg-purple-50 border border-purple-200">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-3.5 text-purple-600" />
            <span className="text-xs font-semibold text-purple-900">Calibration Score</span>
            <span className={`text-xs font-bold ml-auto ${metrics.calibrationDeviation < 0.5 ? 'text-emerald-700' : metrics.calibrationDeviation < 1.0 ? 'text-amber-700' : 'text-rose-700'}`}>
              {metrics.calibrationDeviation.toFixed(2)} avg deviation from reference
            </span>
          </div>
        </div>
      )}

      {/* Training tier selector */}
      <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
        <div className="flex-1">
          <p className="text-[10px] text-slate-500 mb-1">Training tier</p>
          <Select value={panelist.trainingLevel} onValueChange={v => onUpdateTier(v as TrainingLevel)}>
            <SelectTrigger className="h-7 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRAINING_LEVELS.map(lvl => (
                <SelectItem key={lvl} value={lvl} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    {TIER_ICON[lvl]}
                    {TRAINING_LEVEL_LABELS[lvl]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {suggested !== panelist.trainingLevel && (
          <div className="text-right">
            <p className="text-[10px] text-slate-500 mb-1">AI suggests</p>
            <button
              onClick={() => onUpdateTier(suggested)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-2"
            >
              <TrendingUp className="size-2.5" />
              {TRAINING_LEVEL_LABELS[suggested]}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Panelist card ─────────────────────────────────────────────────────────────

function PanelistCard({
  panelist,
  metrics,
  onUpdateTier,
}: {
  panelist: PanelistInfo;
  metrics: PanelistMetrics;
  onUpdateTier: (userId: string, level: TrainingLevel) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const suggested = useMemo(() => suggestTrainingTier(metrics), [metrics]);
  const initials = panelist.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${metrics.rogueFlag ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200 bg-white hover:border-blue-200'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 text-sm truncate">{panelist.name}</div>
            <div className="text-[11px] text-slate-400 font-mono">{panelist.panelistId ?? 'no ID set'}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <TierBadge level={panelist.trainingLevel} />
          {metrics.rogueFlag && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-full border border-rose-300">
              <AlertTriangle className="size-2.5" />
              Review Required
            </span>
          )}
        </div>
      </div>

      {/* Metric pills */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {[
          { label: 'Sessions', value: String(metrics.completedCount), colorClass: 'text-slate-700', sub: null },
          {
            label: 'Repeatability',
            value: metrics.repeatability !== null ? `${(metrics.repeatability * 100).toFixed(0)}%` : '—',
            colorClass: repColor(metrics.repeatability),
            sub: metrics.repeatability !== null ? repeatabilityLabel(metrics.repeatability) : null,
          },
          {
            label: 'F-Ratio',
            value: metrics.discriminationFRatio !== null ? metrics.discriminationFRatio.toFixed(1) : '—',
            colorClass: fColor(metrics.discriminationFRatio),
            sub: metrics.discriminationFRatio !== null ? fRatioLabel(metrics.discriminationFRatio) : null,
          },
          {
            label: 'Deviation',
            value: metrics.meanDeviation !== null ? metrics.meanDeviation.toFixed(2) : '—',
            colorClass: devColor(metrics.meanDeviation),
            sub: metrics.meanDeviation !== null ? deviationLabel(metrics.meanDeviation) : null,
          },
        ].map(({ label, value, colorClass, sub }) => (
          <div key={label} className="bg-slate-50 rounded-lg p-1.5 text-center">
            <div className={`text-sm font-bold ${colorClass}`}>{value}</div>
            <div className="text-[9px] text-slate-400 leading-tight">{label}</div>
            {sub && <div className="text-[9px] font-medium text-slate-500">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Scale usage mini */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide">Scale 1–9</span>
          {metrics.scaleUsageRange !== null && metrics.scaleUsageRange < 4 && (
            <span className="text-[9px] text-amber-600 font-semibold">Narrow range</span>
          )}
        </div>
        <ScaleMiniBar distribution={metrics.scaleDistribution} />
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 mt-1 pt-1 border-t border-slate-100"
      >
        {expanded ? <><ChevronUp className="size-3" />Less</> : <><ChevronDown className="size-3" />Details & Training</>}
      </button>

      {expanded && (
        <PanelistDetail
          metrics={metrics}
          panelist={panelist}
          suggested={suggested}
          onUpdateTier={level => onUpdateTier(panelist.id, level)}
        />
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

type TierFilter = 'all' | TrainingLevel | 'flagged';

export function PanelistPerformancePanel() {
  const { data: panelists = [] } = usePanelists();
  const { data: allResponses = [] } = useAllResponses();
  const { data: products = [] } = useProducts();
  const updateTierMutation = useUpdatePanelistTrainingLevel();

  const [tierFilter, setTierFilter] = useState<TierFilter>('all');

  const calibrationProductIds = useMemo(
    () => new Set(products.filter(p => p.isCalibration).map(p => p.id)),
    [products],
  );

  const referenceScoresByProduct = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    products.filter(p => p.isCalibration && p.referenceScores).forEach(p => {
      map[p.id] = p.referenceScores as unknown as Record<string, number>;
    });
    return map;
  }, [products]);

  const metricsMap = useMemo(() => {
    const map = new Map<string, PanelistMetrics>();
    panelists.forEach(p => {
      map.set(p.id, computePanelistMetrics(allResponses as QuestionnaireResponse[], p.id, calibrationProductIds, referenceScoresByProduct));
    });
    return map;
  }, [panelists, allResponses, calibrationProductIds, referenceScoresByProduct]);

  const handleUpdateTier = (userId: string, level: TrainingLevel) => {
    updateTierMutation.mutate({ userId, level });
  };

  // ── Summary stats ─────────────────────────────────────────────────────────────
  const allMetrics = [...metricsMap.values()];
  const repValues = allMetrics.map(m => m.repeatability).filter((r): r is number => r !== null);
  const avgRepeatability = repValues.length > 0 ? repValues.reduce((a, b) => a + b, 0) / repValues.length : null;
  const flaggedCount = allMetrics.filter(m => m.rogueFlag).length;
  const certifiedPlusCount = panelists.filter(p => p.trainingLevel === 'certified' || p.trainingLevel === 'expert').length;

  // ── Filter ────────────────────────────────────────────────────────────────────
  const filteredPanelists = panelists.filter(p => {
    if (tierFilter === 'all') return true;
    if (tierFilter === 'flagged') return metricsMap.get(p.id)?.rogueFlag ?? false;
    return p.trainingLevel === tierFilter;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5 text-slate-600" />
          Panel Intelligence ({panelists.length})
        </CardTitle>
        <p className="text-sm text-slate-500">Performance metrics, training tiers, and calibration scores for all panelists</p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Activity className="size-4 text-blue-500" />, value: avgRepeatability !== null ? `${(avgRepeatability * 100).toFixed(0)}%` : '—', label: 'Avg. Repeatability', sub: avgRepeatability !== null ? repeatabilityLabel(avgRepeatability) : 'Need replicates' },
            { icon: <AlertTriangle className="size-4 text-rose-500" />, value: String(flaggedCount), label: 'Flagged Panelists', sub: flaggedCount > 0 ? 'Review Required' : 'All Clear' },
            { icon: <Award className="size-4 text-emerald-500" />, value: String(certifiedPlusCount), label: 'Certified / Expert', sub: panelists.length > 0 ? `${Math.round((certifiedPlusCount / panelists.length) * 100)}% of panel` : '—' },
          ].map(({ icon, value, label, sub }) => (
            <div key={label} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              {icon}
              <div>
                <div className="text-lg font-bold text-slate-900 leading-none">{value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                <div className="text-[10px] text-slate-400">{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tier filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            ['all', 'All'],
            ['screened', 'Screened'],
            ['trained', 'Trained'],
            ['certified', 'Certified'],
            ['expert', 'Expert'],
            ['flagged', 'Flagged'],
          ] as [TierFilter, string][]).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setTierFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                tierFilter === f
                  ? f === 'flagged' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {label}
              {f !== 'all' && f !== 'flagged' && (
                <span className="ml-1 opacity-60">{panelists.filter(p => p.trainingLevel === f).length}</span>
              )}
              {f === 'flagged' && flaggedCount > 0 && <span className="ml-1">{flaggedCount}</span>}
            </button>
          ))}
        </div>

        {/* Panelist cards */}
        {filteredPanelists.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users className="size-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{panelists.length === 0 ? 'No panelists yet' : 'No panelists match filter'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredPanelists.map(p => {
              const metrics = metricsMap.get(p.id);
              if (!metrics) return null;
              return (
                <PanelistCard
                  key={p.id}
                  panelist={p}
                  metrics={metrics}
                  onUpdateTier={handleUpdateTier}
                />
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-4 flex-wrap">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Legend</span>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /><span className="text-[10px] text-slate-500">Excellent</span></div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /><span className="text-[10px] text-slate-500">Good</span></div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /><span className="text-[10px] text-slate-500">Acceptable</span></div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /><span className="text-[10px] text-slate-500">Poor / Review</span></div>
          <div className="ml-auto text-[10px] text-slate-400">Repeatability: Pearson r (run1 vs run2) · F-Ratio: ANOVA across products · Deviation: mean |score − panel mean|</div>
        </div>
      </CardContent>
    </Card>
  );
}
