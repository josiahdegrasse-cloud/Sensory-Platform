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
}

interface Emotions {
  positive: number;
  negative: number;
}

// ─── Binomial significance threshold (one-tailed, p=0.5 null) ────────────────

function binomProb(n: number, p: number): number {
  return Math.pow(0.5, n) * (() => {
    let c = 1;
    for (let i = 0; i < Math.min(p, n - p); i++) c = c * (n - i) / (i + 1);
    return c;
  })();
}

function pValueOneTailed(count: number, n: number): number {
  let p = 0;
  for (let k = count; k <= n; k++) p += binomProb(n, k);
  return p;
}

function sigLabel(count: number, n: number): string {
  const p = pValueOneTailed(count, n);
  if (p <= 0.01) return "**";
  if (p <= 0.05) return "*";
  return "";
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
  const canShowSignificance = canShowInferentialStatistics(activePanelistN, !usingLiveData);
  const critP05 = (() => {
    for (let k = activePanelistN; k >= 0; k--) {
      if (pValueOneTailed(k, activePanelistN) > 0.05) return k + 1;
    }
    return activePanelistN + 1;
  })();

  const dataWithSig = activeCataAttributes.map(a => ({
    ...a,
    sig: sigLabel(a.count, activePanelistN),
  }));

  return (
      <Card>
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
            {canShowSignificance
              ? ` Significance threshold: ≥${critP05}/${activePanelistN} (binomial, p=0.5, α=0.05).`
              : ' Inferential significance is not shown for this evidence set.'}
          </p>
          <SampleContext name={activeSampleName} id={activeSampleId} />
        </CardHeader>
        <CardContent>
          <div className="bg-white p-4 rounded-lg border-2 border-slate-200">
            <h3 className="font-bold text-slate-900 mb-3">
              Top Attributes (CATA)
              <span className="ml-2 text-xs font-normal text-slate-500">* p&lt;0.05 &nbsp; ** p&lt;0.01 &nbsp; (binomial test vs chance, n={activePanelistN})</span>
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(300, dataWithSig.length * 28)} key={`cata-chart-container-${activeSampleId}`}>
              <BarChart
                data={dataWithSig}
                layout="vertical"
                margin={{ left: 100, right: 40 }}
                id={`cata-chart-${activeSampleId}`}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, activePanelistN]} />
                <YAxis type="category" dataKey="attribute" width={90} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      const p = pValueOneTailed(d.count, activePanelistN);
                      return (
                        <div className="bg-white p-3 shadow-lg rounded-lg border">
                          <p className="font-bold text-slate-900">{d.attribute}</p>
                          <p className="text-sm text-slate-700">Selected by {d.count}/{activePanelistN} ({d.percentage.toFixed(0)}%)</p>
                          <p className="text-sm text-slate-700">
                            p = {p < 0.001 ? "<0.001" : p.toFixed(3)}{" "}
                            {d.sig ? <span className="font-bold text-emerald-700">{d.sig}</span> : "(n.s.)"}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" fill={STATUS.info} isAnimationActive={false}>
                  {dataWithSig.map((entry) => (
                    <Cell
                      key={`cell-${entry.id}`}
                      fill={canShowSignificance && entry.sig === "**" ? STATUS.goDark : canShowSignificance && entry.sig === "*" ? STATUS.info : CHART_CHROME.muted}
                    />
                  ))}
                  <LabelList
                    dataKey="sig"
                    position="right"
                    formatter={(value: string) => canShowSignificance ? value : ''}
                    style={{ fontSize: 13, fontWeight: 700, fill: STATUS.goDark }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 text-xs text-slate-500">
              {canShowSignificance
                ? 'Green bars are statistically significant above chance. Grey bars are not significant.'
                : usingLiveData
                  ? 'A minimum of 5 live responses is required before inferential significance is displayed.'
                  : 'Reference/demo descriptor frequencies are descriptive only and must not be presented as client findings.'}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
                  <span className="text-sm font-semibold text-emerald-900">Strong Agreement (≥70%)</span>
                </div>
                <div className="text-xs text-emerald-700">
                  {activeCataAttributes.filter(a => a.count >= activePanelistN * 0.7).map(a => a.attribute).join(", ") || "None"}
                </div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                  <span className="text-sm font-semibold text-blue-900">Moderate (50–70%)</span>
                </div>
                <div className="text-xs text-blue-700">
                  {activeCataAttributes.filter(a => a.count >= activePanelistN * 0.5 && a.count < activePanelistN * 0.7).map(a => a.attribute).join(", ") || "None"}
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                  <span className="text-sm font-semibold text-slate-900">Not significant (&lt;50%)</span>
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
            <div className="h-[380px] min-w-0 sm:h-[460px] lg:h-[520px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={activeIntensityData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="attribute" />
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
                const color = value >= hi ? "emerald" : value >= mid ? "blue" : "slate";
                return (
                  <div key={attribute} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize font-medium text-slate-700">{label}</span>
                      <Badge className={`bg-${color}-600 px-1.5 py-0 text-[11px] text-white`}>
                        {value.toFixed(1)}/{INTENSITY_SCALE_MAX}
                      </Badge>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-200">
                      <div
                        className={`h-1.5 rounded-full bg-${color}-600 transition-all`}
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
  const canShowIntervals = canShowInferentialStatistics(n, !usingLiveData);
  const dataWithSem = activeHedonicData.map(d => ({
    ...d,
    sem: d.sd / Math.sqrt(n),
    ci95: 1.96 * d.sd / Math.sqrt(n),
  }));

  return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Heart className="size-5 text-rose-600" />
              Overall liking scores (9-point scale)
            </CardTitle>
            <DataProvenanceBadge provenance={usingLiveData ? 'live' : 'reference'} n={n} />
          </div>
          <p className="text-sm text-slate-700">
            Consumer acceptance ratings: 1 = Dislike Extremely, 9 = Like Extremely · n={n} panelists
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
                        <p className="text-sm text-slate-700">SEM: ±{d.sem.toFixed(2)} (n={n})</p>
                        <p className="text-sm text-emerald-700 font-medium">95% CI: {(d.score - d.ci95).toFixed(2)} – {(d.score + d.ci95).toFixed(2)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                {canShowIntervals && <ErrorBar dataKey="ci95" width={4} strokeWidth={2} stroke={CHART_CHROME.axis} />}
                {dataWithSem.map((entry) => (
                  <Cell key={`hedonic-bar-${entry.id}`} fill={getHedonicColor(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2 text-center">
            {canShowIntervals
              ? `Error bars show descriptive 95% confidence intervals (n=${n}). Confirm the study design before interpreting differences as meaningful.`
              : usingLiveData
                ? 'Confidence intervals are hidden until at least 5 live responses are available.'
                : 'Reference/demo liking scores are shown for method orientation only.'}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {activeHedonicData.map(item => {
              const color = item.score >= 7 ? "emerald" : item.score >= 5 ? "amber" : "rose";
              const interpretation =
                item.score >= 7 ? "Liked" :
                item.score >= 5 ? "Neither like nor dislike" :
                "Disliked";

              return (
                <div key={item.category} className={`min-w-0 rounded-lg border border-${color}-200 bg-${color}-50 p-3`}>
                  <div className={`text-xs text-${color}-700 mb-1`}>{item.category}</div>
                  <div className={`text-3xl font-bold text-${color}-900`}>{item.score.toFixed(1)}</div>
                  <div className={`text-xs text-${color}-600 mt-1`}>{interpretation}</div>
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
