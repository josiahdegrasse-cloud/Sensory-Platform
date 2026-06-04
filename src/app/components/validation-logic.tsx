import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Slider } from "./ui/slider";
import { CheckCircle2, XCircle, AlertCircle, Info, Database } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { useAllResponses, useProducts } from "../lib/hooks";
import { detectFoodType, getFoodTypeProfile } from "../lib/food-intelligence";

const correlationMatrix = [
  { instrumental: 'E-Tongue Sourness',   sensory: 'Panel Sourness',   r: 0.94, p: 0.001, significant: true, strength: 'Very Strong' },
  { instrumental: 'E-Tongue Bitterness', sensory: 'Panel Bitterness', r: 0.81, p: 0.008, significant: true, strength: 'Strong' },
  { instrumental: 'E-Tongue Umami',      sensory: 'Panel Umami',      r: 0.92, p: 0.002, significant: true, strength: 'Very Strong' },
  { instrumental: 'Salt Content',        sensory: 'Panel Saltiness',  r: 0.95, p: 0.001, significant: true, strength: 'Very Strong' },
  { instrumental: 'Fat Content',         sensory: 'Panel Creaminess', r: 0.89, p: 0.004, significant: true, strength: 'Strong' },
  { instrumental: 'Protein + Yeast',     sensory: 'Panel Cheesyness', r: 0.88, p: 0.005, significant: true, strength: 'Strong' },
];

function avg(nums: number[]) {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}

function computeConvergence(scores: number[]): number {
  if (scores.length < 2) return 100;
  const mean = avg(scores);
  const sd = Math.sqrt(scores.reduce((acc, v) => acc + (v - mean) ** 2, 0) / scores.length);
  return Math.max(0, Math.min(100, Math.round(100 * (1 - sd / 4.5))));
}

function getCorrelationColor(r: number) {
  const absR = Math.abs(r);
  if (absR >= 0.9) return 'bg-emerald-600 text-white';
  if (absR >= 0.8) return 'bg-emerald-500 text-white';
  if (absR >= 0.7) return 'bg-yellow-500 text-slate-900';
  if (absR >= 0.5) return 'bg-orange-400 text-white';
  return 'bg-slate-300 text-slate-800';
}

function computeFoodDecision(
  convergence: number,
  hedonicMean: number,
  threshold: number,
  riskAttributeHits: number,
  successAttributeHits: number,
  profile: ReturnType<typeof getFoodTypeProfile>,
) {
  const panelScore = Math.min(100, convergence * (profile.decisionWeights.panelAcceptance / 30));
  const hedonicScore = Math.min(100, (hedonicMean / 9) * 100);
  const offNoteRisk = Math.max(0, 100 - riskAttributeHits * 15);
  const successBoost = Math.min(20, successAttributeHits * 5);

  const composite =
    panelScore * (profile.decisionWeights.panelAcceptance / 100) +
    hedonicScore * (profile.decisionWeights.instrumentalFit / 100) +
    offNoteRisk * (profile.decisionWeights.offNoteRisk / 100) +
    successBoost * (profile.decisionWeights.nutrition / 100);

  if (convergence >= threshold && hedonicMean >= 6.5 && riskAttributeHits === 0) return 'go';
  if (convergence < 70 || hedonicMean < 5) return 'stop';
  return 'tweak';
}

export function ValidationLogic() {
  const [threshold, setThreshold] = useState([85]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  const { data: allResponses = [], isLoading: responsesLoading } = useAllResponses();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const loading = responsesLoading || productsLoading;

  const singleResponses = useMemo(
    () => allResponses.filter(r => !r.sessionType),
    [allResponses],
  );

  const activeProductIds = useMemo(
    () => new Set(singleResponses.map(r => r.productId)),
    [singleResponses],
  );

  const productsWithData = useMemo(
    () => products.filter(p => activeProductIds.has(p.id)),
    [products, activeProductIds],
  );

  const effectiveProductId = selectedProductId || productsWithData[0]?.id || '';

  const selectedProduct = useMemo(
    () => productsWithData.find(p => p.id === effectiveProductId),
    [productsWithData, effectiveProductId],
  );

  const foodProfile = useMemo(() => {
    if (!selectedProduct) return null;
    const detection = detectFoodType(selectedProduct.category, selectedProduct.name);
    return getFoodTypeProfile(detection.slug);
  }, [selectedProduct]);

  const productResponses = useMemo(
    () => singleResponses.filter(r => r.productId === effectiveProductId),
    [singleResponses, effectiveProductId],
  );

  const stats = useMemo(() => {
    const n = productResponses.length;
    if (n === 0) return null;

    const overallScores = productResponses.map(r => r.hedonicScores.overall);
    const convergence = computeConvergence(overallScores);

    const hedonicMeans = {
      overall:    avg(productResponses.map(r => r.hedonicScores.overall)),
      appearance: avg(productResponses.map(r => r.hedonicScores.appearance)),
      aroma:      avg(productResponses.map(r => r.hedonicScores.aroma)),
      flavor:     avg(productResponses.map(r => r.hedonicScores.flavor)),
      texture:    avg(productResponses.map(r => r.hedonicScores.texture)),
    };

    const cataCounts: Record<string, number> = {};
    productResponses.forEach(r =>
      r.cataAttributes.forEach(a => { cataCounts[a] = (cataCounts[a] || 0) + 1; }),
    );
    const topAttributes = Object.entries(cataCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const mean = avg(overallScores);
    const sd = overallScores.length < 2
      ? 0
      : Math.sqrt(overallScores.reduce((acc, v) => acc + (v - mean) ** 2, 0) / overallScores.length);

    return { n, convergence, hedonicMeans, topAttributes, cataCounts, sd, mean };
  }, [productResponses]);

  const riskAttributeHits = useMemo(() => {
    if (!stats || !foodProfile) return 0;
    return foodProfile.riskMarkers.filter(
      marker => (stats.cataCounts[marker] ?? 0) / stats.n > 0.25
    ).length;
  }, [stats, foodProfile]);

  const successAttributeHits = useMemo(() => {
    if (!stats || !foodProfile) return 0;
    return foodProfile.successMarkers.filter(
      marker => (stats.cataCounts[marker.toLowerCase()] ?? stats.cataCounts[marker] ?? 0) / stats.n > 0.30
    ).length;
  }, [stats, foodProfile]);

  const decision = useMemo(() => {
    if (!stats || !foodProfile) return null;
    return computeFoodDecision(
      stats.convergence, stats.hedonicMeans.overall, threshold[0],
      riskAttributeHits, successAttributeHits, foodProfile,
    );
  }, [stats, foodProfile, threshold, riskAttributeHits, successAttributeHits]);

  const convergence = stats?.convergence ?? 0;

  const decisionLabel = {
    go: 'GO — Proceed to launch',
    tweak: 'TWEAK — Targeted reformulation',
    stop: 'STOP — Reformulate & re-test',
  }[decision ?? 'tweak'] ?? '';

  const decisionDescription = useMemo(() => {
    if (!decision || !foodProfile) return '';
    if (decision === 'go') return `${foodProfile.label} meets acceptance criteria. Panel convergence and hedonic scores are within target range.`;
    if (decision === 'stop') return `${foodProfile.label} is below the acceptance threshold. Significant reformulation is required before re-evaluation.`;
    const hitMarkers = foodProfile.riskMarkers.filter(
      m => stats && (stats.cataCounts[m] ?? 0) / stats.n > 0.25
    );
    return hitMarkers.length > 0
      ? `Off-note risk detected: ${hitMarkers.join(', ')}. Address these before next evaluation.`
      : `Panel convergence or hedonic mean is below target. Review lowest-scoring attributes.`;
  }, [decision, foodProfile, stats]);

  return (
    <TooltipProvider>
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-medium text-slate-900">Validation Logic</h1>
          <p className="text-slate-500 mt-1">Panel convergence, food-type decision engine, and statistical correlations</p>
        </div>

        {loading && (
          <div className="text-slate-500 text-sm py-8 text-center">Loading panel data…</div>
        )}

        {!loading && productsWithData.length === 0 && (
          <Card className="shadow-md border-slate-200 mb-6">
            <CardContent className="pt-6 pb-6 text-center text-slate-500">
              <Database className="size-8 mx-auto mb-2 text-slate-300" />
              No panel responses recorded yet. Responses will appear once panelists submit evaluations.
            </CardContent>
          </Card>
        )}

        {!loading && productsWithData.length > 0 && (
          <div className="space-y-6">
            {/* Product selector + food type badge */}
            <Card className="shadow-md border-slate-200">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="text-sm font-semibold text-slate-700 shrink-0">Product</label>
                  <select
                    className="flex-1 min-w-[200px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={effectiveProductId}
                    onChange={e => setSelectedProductId(e.target.value)}
                  >
                    {productsWithData.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {stats && (
                    <Badge variant="outline" className="shrink-0 bg-blue-50 text-blue-700 border-blue-300">
                      n = {stats.n} panelists
                    </Badge>
                  )}
                  {foodProfile && (
                    <Badge variant="outline" className="shrink-0 bg-slate-50 text-slate-700 border-slate-300">
                      {foodProfile.label} profile
                    </Badge>
                  )}
                  <Badge variant="outline" className="shrink-0 bg-emerald-50 text-emerald-700 border-emerald-300 gap-1">
                    <Database className="size-3" />Live
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Hedonic stats */}
            {stats && (
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: 'Overall',    val: stats.hedonicMeans.overall },
                  { label: 'Appearance', val: stats.hedonicMeans.appearance },
                  { label: 'Aroma',      val: stats.hedonicMeans.aroma },
                  { label: 'Flavor',     val: stats.hedonicMeans.flavor },
                  { label: 'Texture',    val: stats.hedonicMeans.texture },
                ].map(({ label, val }) => (
                  <Card key={label} className="shadow-sm border-slate-200">
                    <CardContent className="pt-4 pb-4 text-center">
                      <div className="text-xs text-slate-500 mb-1">{label}</div>
                      <div className={`text-2xl font-bold ${val >= 7 ? 'text-emerald-600' : val >= 5 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {val.toFixed(1)}
                      </div>
                      <div className="text-xs text-slate-400">/ 9</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Decision engine */}
            <Card className="shadow-md border-slate-200">
              <CardHeader className="bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-xl">
                  {foodProfile ? `${foodProfile.label} Decision Engine` : 'Decision Engine'}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {foodProfile
                    ? `Acceptance criteria weighted for ${foodProfile.label.toLowerCase()} products`
                    : 'Food-type specific acceptance criteria'}
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-5">
                    {/* Threshold slider */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-slate-700">Convergence Threshold</label>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-300 font-bold text-base px-3 py-1">
                          {threshold[0]}%
                        </Badge>
                      </div>
                      <Slider value={threshold} onValueChange={setThreshold} min={70} max={95} step={1} className="mb-2" />
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>70% (minimum)</span>
                        <span>95% (maximum)</span>
                      </div>
                    </div>

                    {/* Stats summary */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Panel convergence</span>
                        <span className="font-bold text-slate-900">{convergence}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">SD (overall hedonic)</span>
                        <span className="font-mono text-slate-700">{stats?.sd.toFixed(2) ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Threshold</span>
                        <span className="font-bold text-slate-900">{threshold[0]}%</span>
                      </div>
                      {foodProfile && (
                        <>
                          <div className="pt-2 border-t border-slate-200 flex justify-between">
                            <span className="text-slate-600">Risk markers hit</span>
                            <span className={`font-bold ${riskAttributeHits > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {riskAttributeHits} / {foodProfile.riskMarkers.length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Success markers hit</span>
                            <span className={`font-bold ${successAttributeHits >= 2 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {successAttributeHits} / {foodProfile.successMarkers.length}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Top CATA attributes */}
                    {stats && stats.topAttributes.length > 0 && (
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-xs font-semibold text-slate-600 mb-2">Top Panel Attributes</div>
                        <div className="flex flex-wrap gap-1.5">
                          {stats.topAttributes.map(([attr, count]) => {
                            const isRisk = foodProfile?.riskMarkers.some(r => r.toLowerCase() === attr.toLowerCase());
                            const isSuccess = foodProfile?.successMarkers.some(s => s.toLowerCase() === attr.toLowerCase());
                            return (
                              <Badge
                                key={attr}
                                variant="outline"
                                className={`text-xs ${isRisk ? 'border-rose-300 bg-rose-50 text-rose-700' : isSuccess ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'bg-white'}`}
                              >
                                {attr} ({Math.round((count / stats.n) * 100)}%)
                              </Badge>
                            );
                          })}
                        </div>
                        {foodProfile && (
                          <div className="mt-2 flex gap-3 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />risk marker</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />success marker</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Decision panel */}
                  <div className={`p-6 rounded-xl border-2 ${
                    decision === 'go'   ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-300' :
                    decision === 'tweak' ? 'bg-gradient-to-br from-amber-50 to-white border-amber-300' :
                    decision === 'stop'  ? 'bg-gradient-to-br from-rose-50 to-white border-rose-300' :
                                          'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-3 mb-4">
                      {decision === 'go'   && <CheckCircle2 className="size-8 text-emerald-600" />}
                      {decision === 'tweak' && <AlertCircle  className="size-8 text-amber-600" />}
                      {decision === 'stop'  && <XCircle      className="size-8 text-rose-600" />}
                      {!decision && <AlertCircle className="size-8 text-slate-400" />}
                      <div>
                        <h3 className={`font-bold text-xl ${
                          decision === 'go' ? 'text-emerald-900' : decision === 'tweak' ? 'text-amber-900' : 'text-rose-900'
                        }`}>
                          {decisionLabel || 'Awaiting data'}
                        </h3>
                        {foodProfile && (
                          <p className="text-xs text-slate-500 mt-0.5">{foodProfile.label} product criteria</p>
                        )}
                      </div>
                    </div>

                    <p className={`text-sm mb-5 ${
                      decision === 'go' ? 'text-emerald-800' : decision === 'tweak' ? 'text-amber-800' : 'text-rose-800'
                    }`}>
                      {decisionDescription}
                    </p>

                    {foodProfile && (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-white/60 border border-slate-200">
                          <div className="text-xs font-semibold text-slate-700 mb-1.5">
                            {foodProfile.label} risk markers
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {foodProfile.riskMarkers.map(m => (
                              <span
                                key={m}
                                className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                                  stats && (stats.cataCounts[m] ?? 0) / stats.n > 0.25
                                    ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-white/60 border border-slate-200">
                          <div className="text-xs font-semibold text-slate-700 mb-1.5">
                            {foodProfile.label} success markers
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {foodProfile.successMarkers.map(m => (
                              <span
                                key={m}
                                className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                                  stats && (stats.cataCounts[m.toLowerCase()] ?? stats.cataCounts[m] ?? 0) / stats.n > 0.30
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                        {foodProfile && (
                          <div className="p-3 rounded-lg bg-white/60 border border-slate-200">
                            <div className="text-xs font-semibold text-slate-700 mb-1.5">Decision weights</div>
                            <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                              <span>Panel acceptance: <strong>{foodProfile.decisionWeights.panelAcceptance}%</strong></span>
                              <span>Off-note risk: <strong>{foodProfile.decisionWeights.offNoteRisk}%</strong></span>
                              <span>Instrumental fit: <strong>{foodProfile.decisionWeights.instrumentalFit}%</strong></span>
                              <span>Nutrition: <strong>{foodProfile.decisionWeights.nutrition}%</strong></span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-5 text-sm space-y-1.5 text-slate-700 border-t border-slate-200 pt-4">
                      <p>• Panel size: {stats?.n ?? 0} responses</p>
                      <p>• Mean hedonic: {stats?.mean.toFixed(2) ?? '—'} / 9</p>
                      <p>• Convergence: {convergence}% ({convergence >= threshold[0] ? 'above' : 'below'} threshold)</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statistical correlations */}
            <Card className="shadow-md border-slate-200">
              <CardHeader className="bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-xl flex items-center gap-2">
                  Statistical Correlations
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex">
                        <Info className="size-4 text-slate-400 hover:text-slate-600" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Reference correlations from research dataset. Instrumental vs panel attribute correlations.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <Badge variant="outline" className="ml-2 text-xs bg-purple-50 text-purple-700 border-purple-300">
                    Research Reference
                  </Badge>
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">Instrumental → Panel attribute correlations</p>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200 bg-slate-50">
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Instrumental</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Sensory</th>
                        <th className="text-center py-3 px-4 font-semibold text-slate-700">r</th>
                        <th className="text-center py-3 px-4 font-semibold text-slate-700">p</th>
                        <th className="text-center py-3 px-4 font-semibold text-slate-700">Strength</th>
                      </tr>
                    </thead>
                    <tbody>
                      {correlationMatrix.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-slate-700">{row.instrumental}</td>
                          <td className="py-3 px-4 text-slate-700">{row.sensory}</td>
                          <td className="py-3 px-4 text-center">
                            <Badge className={`font-mono font-semibold ${getCorrelationColor(row.r)}`}>{row.r.toFixed(3)}</Badge>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-xs text-slate-600">
                            {row.p.toFixed(3)}{row.significant && <span className="text-emerald-600 ml-1">*</span>}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant="outline" className={
                              row.strength === 'Very Strong' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                              row.strength === 'Strong'      ? 'bg-blue-50 text-blue-700 border-blue-300' :
                                                              'bg-slate-50 text-slate-700 border-slate-300'
                            }>{row.strength}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <div className="font-semibold text-blue-900">Model Type</div>
                    <div className="text-blue-700">Partial Least Squares Regression (PLSR)</div>
                  </div>
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-sm">
                    <div className="font-semibold text-purple-900">Validation</div>
                    <div className="text-purple-700">Leave-one-out cross-validation (n=10)</div>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3 text-sm text-slate-700">
                  <Info className="size-5 text-blue-600 shrink-0 mt-0.5" />
                  <span><strong className="text-slate-900">Note:</strong> * = statistically significant (p &lt; 0.05). r ≥ 0.90 indicates high predictive reliability.</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
