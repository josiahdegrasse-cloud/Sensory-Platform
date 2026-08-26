import { CHART_CHROME, STATUS } from '../styles/tokens';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Cell, ErrorBar, LabelList
} from "recharts";
import { CheckSquare, TrendingUp, Heart, Smile, Frown, AlertCircle, MessageCircle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { DataProvenanceBadge } from './data-provenance-badge';
import { canShowInferentialStatistics } from '../lib/insights';
import {
  INTENSITY_SCALE_MAX,
  INTENSITY_SCALE_MIN,
  intensityScalePercentage,
} from '../lib/sensory-scales';

interface CataAttribute {
  id: string;
  attribute: string;
  count: number;
  percentage: number;
}

interface IntensityDatum {
  id: string;
  attribute: string;
  value: number;
  fullMark: number;
}

interface HedonicDatum {
  id: string;
  category: string;
  score: number;
  sd: number;
  n: number;
}

interface Emotions {
  positive: number;
  negative: number;
}

// Descriptive Wilson interval for a citation proportion. CATA has no universal
// 50% chance-selection null, so this view deliberately avoids significance
// claims unless a valid cross-product analysis is explicitly configured.
export function cataPrevalenceInterval(count: number, n: number): [number, number] {
  if (n <= 0) return [0, 0];
  const z = 1.96;
  const proportion = Math.max(0, Math.min(n, count)) / n;
  const denominator = 1 + (z ** 2) / n;
  const centre = (proportion + (z ** 2) / (2 * n)) / denominator;
  const spread = z * Math.sqrt((proportion * (1 - proportion) + (z ** 2) / (4 * n)) / n) / denominator;
  return [Math.max(0, centre - spread) * 100, Math.min(1, centre + spread) * 100];
}

export function studentTCritical95(n: number): number {
  const df = Math.max(1, Math.floor(n) - 1);
  const criticalByDf = [
    0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262,
    2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093,
    2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045,
    2.042,
  ];
  return criticalByDf[df] ?? 1.96;
}

// ─── CATA Tab ────────────────────────────────────────────────────────────────

interface CATATabProps {
  activeCataAttributes: CataAttribute[];
  activePanelistN: number;
  usingLiveData: boolean;
  activeSampleId: string;
  activeSampleName: string;
}

export function CATATab({ activeCataAttributes, activePanelistN, usingLiveData, activeSampleId, activeSampleName }: CATATabProps) {
  const chartData = activeCataAttributes.map(a => ({
    ...a,
    interval: cataPrevalenceInterval(a.count, activePanelistN),
  }));

  return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="size-5 text-blue-600" />
              Panelist-selected sensory descriptors
            </CardTitle>
            <DataProvenanceBadge provenance={usingLiveData ? 'live' : 'reference'} n={activePanelistN} />
          </div>
          <p className="text-sm text-slate-700">
            Frequency of attribute selection across {activePanelistN} {usingLiveData ? 'panelists' : 'reference observations'}.
            {' '}Percentages and intervals are descriptive; they are not significance tests.
          </p>
          <SampleContext name={activeSampleName} id={activeSampleId} />
        </CardHeader>
        <CardContent>
          <div className="bg-white p-4 rounded-lg border-2 border-slate-200">
            <h3 className="font-bold text-slate-900 mb-3">
              Descriptor citation prevalence
              <span className="ml-2 text-xs font-normal text-slate-500">share of the panel selecting each term</span>
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(320, chartData.length * 32)} key={`cata-chart-container-${activeSampleId}`}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 8, right: 32 }}
                id={`cata-chart-${activeSampleId}`}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, activePanelistN]} />
                <YAxis
                  type="category"
                  dataKey="attribute"
                  width={118}
                  interval={0}
                  tick={{ fill: CHART_CHROME.axis, fontSize: 12 }}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-3 shadow-lg rounded-lg border">
                          <p className="font-bold text-slate-900">{d.attribute}</p>
                          <p className="text-sm text-slate-700">Selected by {d.count}/{activePanelistN} ({d.percentage.toFixed(0)}%)</p>
                          <p className="text-sm text-slate-700">Descriptive 95% interval: {d.interval[0].toFixed(0)}%–{d.interval[1].toFixed(0)}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" fill={STATUS.info} isAnimationActive={false}>
                  {chartData.map((entry) => (
                    <Cell
                      key={`cell-${entry.id}`}
                      fill={entry.percentage >= 70 ? STATUS.goDark : entry.percentage >= 50 ? STATUS.info : CHART_CHROME.mutedDark}
                    />
                  ))}
                  <LabelList
                    dataKey="percentage"
                    position="right"
                    formatter={(value: number) => `${value.toFixed(0)}%`}
                    style={{ fontSize: 12, fontWeight: 700, fill: CHART_CHROME.axis }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 text-xs text-slate-500">
              {usingLiveData
                ? 'These are citation rates, not evidence that a descriptor is significant. Product comparisons require a matched CATA analysis and multiplicity control.'
                : 'Reference/demo descriptor frequencies are descriptive only and must not be presented as client findings.'}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
                  <span className="text-sm font-semibold text-emerald-900">Frequently selected (≥70%)</span>
                </div>
                <div className="text-xs text-emerald-700">
                  {activeCataAttributes.filter(a => a.count >= activePanelistN * 0.7).map(a => a.attribute).join(", ") || "None"}
                </div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                  <span className="text-sm font-semibold text-blue-900">Commonly selected (50–69%)</span>
                </div>
                <div className="text-xs text-blue-700">
                  {activeCataAttributes.filter(a => a.count >= activePanelistN * 0.5 && a.count < activePanelistN * 0.7).map(a => a.attribute).join(", ") || "None"}
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                  <span className="text-sm font-semibold text-slate-900">Less frequently selected (&lt;50%)</span>
                </div>
                <div className="text-xs text-slate-700">
                  {activeCataAttributes.filter(a => a.count < activePanelistN * 0.5).map(a => a.attribute).join(", ") || "None"}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
  );
}

// ─── Intensity Tab ────────────────────────────────────────────────────────────

interface IntensityTabProps {
  activeIntensityData: IntensityDatum[];
  activePanelistN: number;
  usingLiveData: boolean;
  activeSampleId: string;
  activeSampleName: string;
}

export function IntensityTab({
  activeIntensityData,
  activePanelistN,
  usingLiveData,
  activeSampleId,
  activeSampleName,
}: IntensityTabProps) {
  return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-blue-600" />
              Sensory intensity ratings (1–9 scale)
            </CardTitle>
            <DataProvenanceBadge provenance={usingLiveData ? 'live' : 'reference'} n={activePanelistN} />
          </div>
          <p className="text-sm text-slate-700">
            Mean intensity scores from {activePanelistN} {usingLiveData ? 'panelists (live)' : 'semi-trained panelists'} on a fixed 1–9 frame.
          </p>
          <SampleContext name={activeSampleName} id={activeSampleId} />
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(220px,1fr)] lg:items-center">
            <div className="h-[360px] min-w-0 sm:h-[440px] lg:h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  data={activeIntensityData}
                  cy="46%"
                  margin={{ top: 16, right: 16, bottom: 24, left: 16 }}
                  outerRadius="72%"
                >
                  <PolarGrid />
                  <PolarAngleAxis
                    dataKey="attribute"
                    tickSize={26}
                    tick={{ fill: CHART_CHROME.axis, fontSize: 12, fontWeight: 500 }}
                  />
                  <PolarRadiusAxis angle={90} domain={[INTENSITY_SCALE_MIN, INTENSITY_SCALE_MAX]} tickCount={9} />
                  <Radar
                    name="Intensity"
                    dataKey="value"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.6}
                  />
                  <RechartsTooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5 lg:py-6">
              {activeIntensityData.map(({ attribute, value }) => {
                const label = attribute.replace(/([A-Z])/g, ' $1').trim();
                const hi = 7;
                const mid = 4;
                const badgeClass = value >= hi
                  ? 'bg-emerald-700 text-white'
                  : value >= mid
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-600 text-white';
                const barClass = value >= hi ? 'bg-emerald-600' : value >= mid ? 'bg-blue-600' : 'bg-slate-600';
                return (
                  <div key={attribute} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize font-medium text-slate-700">{label}</span>
                      <Badge className={`${badgeClass} px-1.5 py-0 text-[11px]`}>
                        {value.toFixed(1)}/{INTENSITY_SCALE_MAX}
                      </Badge>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-200">
                      <div
                        className={`h-1.5 rounded-full transition-all ${barClass}`}
                        style={{ width: `${intensityScalePercentage(value)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-slate-500" />
              <div className="text-sm text-slate-700">
                <strong>Evidence note:</strong> {usingLiveData
                  ? activePanelistN === 1
                    ? 'One response is directional only and should not be treated as representative.'
                    : `These means summarize ${activePanelistN} live responses. Review panel design before making broader claims.`
                  : 'This reference profile demonstrates the method and is not evidence collected from the active client panel.'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
  );
}

// ─── Hedonic Tab ──────────────────────────────────────────────────────────────

interface HedonicTabProps {
  activeHedonicData: HedonicDatum[];
  activeAvgHedonic: string;
  activePanelistN: number;
  usingLiveData: boolean;
  activeSampleId: string;
  activeSampleName: string;
}

function getHedonicColor(score: number): string {
  if (score >= 7) return STATUS.go;
  if (score >= 5) return STATUS.tweak;
  return STATUS.stop;
}

export function HedonicTab({
  activeHedonicData,
  activeAvgHedonic,
  activePanelistN,
  usingLiveData,
  activeSampleId,
  activeSampleName,
}: HedonicTabProps) {
  const n = activePanelistN;
  if (activeHedonicData.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Heart className="size-5 text-rose-600" />Overall liking scores (9-point scale)</CardTitle>
          <p className="text-sm text-slate-700">No panelist supplied a liking score for this sample. Missing answers are not converted to zero or a neutral midpoint.</p>
          <SampleContext name={activeSampleName} id={activeSampleId} />
        </CardHeader>
      </Card>
    );
  }
  const dataWithSem = activeHedonicData.map(d => ({
    ...d,
    sem: d.n > 0 ? d.sd / Math.sqrt(d.n) : 0,
    ci95: canShowInferentialStatistics(d.n, !usingLiveData) ? studentTCritical95(d.n) * d.sd / Math.sqrt(d.n) : 0,
    canShowInterval: canShowInferentialStatistics(d.n, !usingLiveData),
  }));
  const intervalCount = dataWithSem.filter(datum => datum.canShowInterval).length;

  return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Heart className="size-5 text-rose-600" />
              Overall liking scores (9-point scale)
            </CardTitle>
            <DataProvenanceBadge provenance={usingLiveData ? 'live' : 'reference'} n={n} />
          </div>
          <p className="text-sm text-slate-700">
            Panel liking ratings: 1 = Dislike Extremely, 9 = Like Extremely. Valid n is shown per metric and may differ from the total panel n={n}.
          </p>
          <SampleContext name={activeSampleName} id={activeSampleId} />
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dataWithSem}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis domain={[0, 9]} />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white p-3 shadow-lg rounded-lg border">
                        <p className="font-bold text-slate-900">{d.category}</p>
                        <p className="text-sm text-slate-700">Mean: {d.score.toFixed(2)} / 9</p>
                        <p className="text-sm text-slate-700">SD: ±{d.sd.toFixed(2)}</p>
                        <p className="text-sm text-slate-700">Valid responses: n={d.n}</p>
                        {d.canShowInterval && <>
                          <p className="text-sm text-slate-700">SEM: ±{d.sem.toFixed(2)}</p>
                          <p className="text-sm text-emerald-700 font-medium">Approximate 95% CI: {(d.score - d.ci95).toFixed(2)} – {(d.score + d.ci95).toFixed(2)}</p>
                        </>}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                {intervalCount > 0 && <ErrorBar dataKey="ci95" width={4} strokeWidth={2} stroke={CHART_CHROME.axis} />}
                {dataWithSem.map((entry) => (
                  <Cell key={`hedonic-bar-${entry.id}`} fill={getHedonicColor(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2 text-center">
            {intervalCount > 0
              ? 'Error bars show approximate descriptive 95% confidence intervals for metrics with at least 5 valid live responses. Confirm the study design before interpreting differences as meaningful.'
              : usingLiveData
                ? 'Confidence intervals are hidden until at least 5 live responses are available.'
                : 'Reference/demo liking scores are shown for method orientation only.'}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {activeHedonicData.map(item => {
              const tileClasses = item.score >= 7
                ? { shell: 'border-emerald-200 bg-emerald-50', label: 'text-emerald-800', value: 'text-emerald-950', note: 'text-emerald-700' }
                : item.score >= 5
                  ? { shell: 'border-amber-200 bg-amber-50', label: 'text-amber-800', value: 'text-amber-950', note: 'text-amber-700' }
                  : { shell: 'border-rose-200 bg-rose-50', label: 'text-rose-800', value: 'text-rose-950', note: 'text-rose-700' };
              const interpretation =
                item.score >= 7 ? "Liked" :
                item.score >= 5 ? "Neither like nor dislike" :
                "Disliked";

              return (
                <div key={item.category} className={`min-w-0 rounded-lg border p-3 ${tileClasses.shell}`}>
                  <div className={`mb-1 text-xs ${tileClasses.label}`}>{item.category} · n={item.n}</div>
                  <div className={`text-3xl font-bold ${tileClasses.value}`}>{item.score.toFixed(1)}</div>
                  <div className={`mt-1 text-xs ${tileClasses.note}`}>{interpretation}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-700">Average Score:</span>
                <span className="font-bold text-slate-900">{activeAvgHedonic}/9</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Highest Dimension:</span>
                <span className="font-bold text-slate-900">
                  {activeHedonicData.reduce((max, item) => item.score > max.score ? item : max).category}
                  ({activeHedonicData.reduce((max, item) => item.score > max.score ? item : max).score.toFixed(1)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Lowest Dimension:</span>
                <span className="font-bold text-slate-900">
                  {activeHedonicData.reduce((min, item) => item.score < min.score ? item : min).category}
                  ({activeHedonicData.reduce((min, item) => item.score < min.score ? item : min).score.toFixed(1)})
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
  );
}

function SampleContext({ name }: { name: string; id?: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold text-slate-500">Sample shown</span>
      <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 font-semibold text-blue-800">
        {name}
      </span>
    </div>
  );
}

// ─── Comments Tab ─────────────────────────────────────────────────────────────

interface CommentsTabProps {
  usingLiveData: boolean;
  matchingLiveData: { productId: string; n: number } | undefined;
  commentsByProduct: Record<string, string[]>;
}

export function CommentsTab({ usingLiveData, matchingLiveData, commentsByProduct }: CommentsTabProps) {
  return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-blue-600" />
            Panelist Comments
          </CardTitle>
          <p className="text-sm text-slate-700">
            Free-text feedback submitted by panelists for this sample
          </p>
        </CardHeader>
        <CardContent>
          {!usingLiveData || !matchingLiveData ? (
            <div className="py-12 text-center">
              <MessageCircle className="size-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No live responses for this sample yet.</p>
              <p className="text-sm text-slate-500 mt-1">Comments will appear once panelists submit evaluations.</p>
            </div>
          ) : (() => {
            const comments = commentsByProduct[matchingLiveData.productId] ?? [];
            if (comments.length === 0) {
              return (
                <div className="py-12 text-center">
                  <MessageCircle className="size-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No comments submitted yet.</p>
                  <p className="text-sm text-slate-500 mt-1">{matchingLiveData.n} panelist{matchingLiveData.n !== 1 ? 's' : ''} responded but left no comments.</p>
                </div>
              );
            }
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
                  <span className="text-xs text-slate-500">n={matchingLiveData.n} responses</span>
                </div>
                {comments.map((comment, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{comment}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>
  );
}

// ─── Emotional Tab ────────────────────────────────────────────────────────────

interface EmotionalTabProps {
  activeEmotions: Emotions;
  activeEmotionalBalance: string;
  activePanelistN: number;
  usingLiveData: boolean;
}

export function EmotionalTab({ activeEmotions, activeEmotionalBalance, activePanelistN, usingLiveData }: EmotionalTabProps) {
  return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-blue-600" />
              Emotional response indicators
            </CardTitle>
            <DataProvenanceBadge provenance={usingLiveData ? 'live' : 'reference'} n={activePanelistN} />
          </div>
          <p className="text-sm text-slate-700">
            17 positive + 8 negative emotions rated on 0-5 scale
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="p-6 bg-gradient-to-br from-emerald-50 to-white rounded-xl border-2 border-emerald-200">
              <div className="flex items-center gap-3 mb-4">
                <Smile className="size-10 text-emerald-600" />
                <div>
                  <div className="text-sm text-emerald-700">Positive Emotions</div>
                  <div className="text-4xl font-bold text-emerald-900">
                    {activeEmotions.positive.toFixed(1)}
                  </div>
                  <div className="text-xs text-emerald-600">Average of 17 attributes</div>
                </div>
              </div>
              <div className="text-xs text-emerald-700 space-y-1">
                <p>Includes: Happy, Satisfied, Pleased, Contented, Good, Calm, Secure, Comfortable,
                  Enthusiastic, Energetic, Active, Adventurous, Interested, Warm, Loving, Affectionate, Nostalgic</p>
              </div>
            </div>

            <div className="p-6 bg-gradient-to-br from-rose-50 to-white rounded-xl border-2 border-rose-200">
              <div className="flex items-center gap-3 mb-4">
                <Frown className="size-10 text-rose-600" />
                <div>
                  <div className="text-sm text-rose-700">Negative Emotions</div>
                  <div className="text-4xl font-bold text-rose-900">
                    {activeEmotions.negative.toFixed(1)}
                  </div>
                  <div className="text-xs text-rose-600">Average of 8 attributes</div>
                </div>
              </div>
              <div className="text-xs text-rose-700 space-y-1">
                <p>Includes: Worried, Disgusted, Bored, Aggressive, Guilty, Disappointed,
                  Sad, Unpleasant</p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-6">
            <h3 className="mb-3 font-bold text-blue-900">Emotional balance</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-sm text-slate-700 mb-1">Net Emotional Score</div>
                <div className="text-3xl font-bold text-slate-900">{activeEmotionalBalance}</div>
                <div className="text-xs text-slate-500 mt-1">Positive - Negative</div>
              </div>
              <div>
                <div className="text-sm text-slate-700 mb-1">Interpretation</div>
                <Badge className={parseFloat(activeEmotionalBalance) >= 2 ? "bg-emerald-600" :
                                 parseFloat(activeEmotionalBalance) >= 0 ? "bg-amber-600" : "bg-rose-600"}>
                  {parseFloat(activeEmotionalBalance) >= 2 ? "Highly Positive" :
                   parseFloat(activeEmotionalBalance) >= 0 ? "Neutral/Mixed" : "Negative"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <strong>Interpretation limit:</strong> Emotional balance describes the responses collected for this sample.
                {usingLiveData && activePanelistN === 1
                  ? ' One response is directional only and cannot establish consumer readiness.'
                  : ' It should not be used as a standalone commercialization or consumer-readiness claim.'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
  );
}
