import { useState, useEffect } from "react";
import { useFoodType, sampleMatchesFoodType } from "../contexts/food-type-context";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { CheckCircle2, XCircle, AlertTriangle, TrendingUp, Eye, EyeOff, Activity, Award, Zap, ClipboardCheck } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, BarChart, Bar, LineChart, Line, Legend, ReferenceArea, ReferenceLine } from "recharts";
import { ENHANCED_SENSORY_DATA } from "../data/enhanced-sensory";
import { METHOD_COMPARISON } from "../data/validation-data";
import { DecisionLog, appendDecision } from "./decision-log";
import { useAuth } from "../contexts/auth-context";

interface SampleDecision {
  sampleId: string;
  sampleName: string;
  issfScore: number;
  confidenceScore: number;
  decision: "GO" | "TWEAK" | "STOP";
  recommendation: string;
  costSavings: number;
  timeline: string;
  riskLevel: "low" | "medium" | "high";
  details: string[];
  dimensionScores: { hedonic: number; texture: number; cata: number; emotional: number };
}

function IssfGauge({ score, confidence }: { score: number; confidence: number }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="text-right">
      <div className="text-5xl font-bold text-slate-900">{score.toFixed(0)}</div>
      <div className="text-sm text-slate-600">ISSF Score</div>
      <div className="relative w-36 mt-3 mb-5 ml-auto">
        <div className="flex h-4 rounded-full overflow-hidden shadow-inner">
          <div className="bg-rose-300" style={{ width: "55%" }} />
          <div className="bg-amber-300" style={{ width: "20%" }} />
          <div className="bg-emerald-300" style={{ width: "25%" }} />
        </div>
        <div
          className="absolute top-0 w-1 h-4 bg-slate-900 rounded shadow-md"
          style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
        />
        <span className="absolute text-xs text-slate-400" style={{ left: "55%", top: "18px", transform: "translateX(-50%)" }}>55</span>
        <span className="absolute text-xs text-slate-400" style={{ left: "75%", top: "18px", transform: "translateX(-50%)" }}>75</span>
      </div>
      <div className="text-xs text-slate-500">±{confidence.toFixed(0)}% confidence</div>
    </div>
  );
}

function PathToGoPanel({
  selected,
  selectedSensory,
  weights,
}: {
  selected: SampleDecision;
  selectedSensory: (typeof ENHANCED_SENSORY_DATA)[number];
  weights: { hedonic: number; texture: number; cata: number; emotional: number };
}) {
  const gap = Math.max(0, 75 - selected.issfScore);

  if (selected.decision === "GO") {
    const dims = [
      { label: "Hedonic", score: selected.dimensionScores.hedonic },
      { label: "Texture", score: Math.max(0, Math.min(100, selected.dimensionScores.texture)) },
      { label: "CATA", score: selected.dimensionScores.cata },
      { label: "Emotional", score: selected.dimensionScores.emotional },
    ];
    return (
      <div className="bg-white p-4 rounded-lg border-2 border-emerald-200 mb-4">
        <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600" />
          Dimension Strengths
        </h3>
        <div className="space-y-3">
          {dims.map(({ label, score }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-20 text-sm text-slate-700">{label}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-3">
                <div className="bg-emerald-500 h-3 rounded-full" style={{ width: `${score}%` }} />
              </div>
              <span className="w-10 text-right text-sm font-bold text-emerald-600">{score.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const offNoteCompounds = selectedSensory.gcmsOlfactometry.filter(
    (c) =>
      c.odourIntensity >= 3 &&
      (c.odour.toLowerCase().includes("rancid") ||
        c.odour.toLowerCase().includes("cardboard") ||
        c.odour.toLowerCase().includes("fermented"))
  );
  const worstOffNote = [...offNoteCompounds].sort((a, b) => b.odourIntensity - a.odourIntensity)[0];

  const chalky = selectedSensory.intensity.chalky ?? 0;
  const grainy = selectedSensory.intensity.grainy ?? 0;

  const actionMap: Record<string, string> = {
    hedonic: "Rebalance flavor harmony — adjust sweetness-saltiness-umami to lift overall acceptability",
    texture:
      chalky > grainy
        ? `Reduce chalkiness (${chalky.toFixed(1)}/10) — lower processing shear or increase fat:protein ratio`
        : `Reduce graininess (${grainy.toFixed(1)}/10) — refine particle size distribution`,
    cata: "Boost positive flavor character — amplify butter/milk notes via dairy fat fraction or Maillard reaction",
    emotional: "Elevate indulgence cues — increase perceived richness and aroma warmth through ingredient adjustment",
  };

  const dimData = [
    { key: "hedonic", label: "Hedonic", score: selected.dimensionScores.hedonic, weight: weights.hedonic },
    { key: "texture", label: "Texture", score: Math.max(0, Math.min(100, selected.dimensionScores.texture)), weight: weights.texture },
    { key: "cata", label: "CATA", score: selected.dimensionScores.cata, weight: weights.cata },
    { key: "emotional", label: "Emotional", score: selected.dimensionScores.emotional, weight: weights.emotional },
  ];

  const paths = dimData
    .map((dim) => {
      const improvementNeeded = dim.weight > 0 ? (gap * 100) / dim.weight : Infinity;
      const targetScore = dim.score + improvementNeeded;
      return { ...dim, improvementNeeded, targetScore, feasible: targetScore <= 100 };
    })
    .filter((d) => d.feasible);

  const bestPath = [...paths].sort((a, b) => a.improvementNeeded - b.improvementNeeded)[0];

  return (
    <div className="bg-white p-4 rounded-lg border-2 border-amber-200 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Zap className="size-4 text-amber-600" />
          Path to GO
        </h3>
        <div className="text-right">
          <div className="text-2xl font-bold text-amber-600">+{gap.toFixed(1)}</div>
          <div className="text-xs text-slate-500">points to threshold</div>
        </div>
      </div>

      {worstOffNote && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg">
          <div className="text-xs font-bold text-rose-700 mb-1">CRITICAL — Eliminate Off-Note First</div>
          <div className="font-medium text-slate-900 text-sm">{worstOffNote.compound}</div>
          <div className="text-sm text-slate-600">
            {worstOffNote.odour} · intensity {worstOffNote.odourIntensity.toFixed(1)}/5
            {worstOffNote.concentration != null && ` · ${worstOffNote.concentration.toFixed(1)} ppm`}
          </div>
          <div className="text-xs text-slate-500 mt-1">Removing this off-note eliminates the 5pt GC-O penalty</div>
        </div>
      )}

      {bestPath && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-amber-700">FASTEST PATH TO GO</span>
            <Badge className="bg-amber-600 text-white text-xs px-2 py-0">+{bestPath.improvementNeeded.toFixed(0)} pts</Badge>
          </div>
          <div className="font-bold text-slate-900 text-sm">
            Improve {bestPath.label}: {bestPath.score.toFixed(0)} → {bestPath.targetScore.toFixed(0)}/100
          </div>
          <div className="text-sm text-slate-600 mt-1">{actionMap[bestPath.key] ?? "Improve this dimension to reach the GO threshold"}</div>
        </div>
      )}

      <div className="space-y-2">
        {dimData.map((dim) => {
          const needed = dim.weight > 0 ? (gap * 100) / dim.weight : Infinity;
          const target = dim.score + needed;
          const feasible = target <= 100;
          return (
            <div key={dim.key} className="flex items-center gap-3">
              <span className="w-20 text-sm text-slate-700">{dim.label}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${dim.score >= 75 ? "bg-emerald-400" : dim.score >= 50 ? "bg-amber-400" : "bg-rose-400"}`}
                  style={{ width: `${dim.score}%` }}
                />
              </div>
              <span className={`w-28 text-right text-xs font-medium ${feasible ? "text-amber-700" : "text-slate-400"}`}>
                {feasible ? `+${needed.toFixed(0)} pts → GO` : "not feasible solo"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Stage4Enhanced() {
  const { user } = useAuth();
  const { foodType, subCategory } = useFoodType();
  const [selectedSample, setSelectedSample] = useState<string>(ENHANCED_SENSORY_DATA[0]?.sampleId ?? "S1");
  const [showRawData, setShowRawData] = useState(false);
  const [showQualitative, setShowQualitative] = useState(true);
  const [showWeightConfig, setShowWeightConfig] = useState(false);
  const [weights, setWeights] = useState({ hedonic: 30, texture: 25, cata: 25, emotional: 15 });
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [auditNote, setAuditNote] = useState("");
  const [logRefreshKey, setLogRefreshKey] = useState(0);
  const [confirmPending, setConfirmPending] = useState(false);

  const filteredSensoryData = ENHANCED_SENSORY_DATA.filter(s => {
    const ft = sampleMatchesFoodType(s.sampleId, s.sampleName);
    if (foodType !== 'all' && ft !== foodType) return false;
    if (subCategory && !s.sampleName.toLowerCase().includes(subCategory.toLowerCase())) return false;
    return true;
  });

  useEffect(() => {
    if (filteredSensoryData.length > 0 && !filteredSensoryData.find(s => s.sampleId === selectedSample)) {
      setSelectedSample(filteredSensoryData[0].sampleId);
    }
  }, [foodType, subCategory]);

  // Calculate actual correlations and decisions for each sample
  const sampleDecisions: SampleDecision[] = filteredSensoryData.map(sample => {
    // Calculate composite ISSF score based on:
    // 1. Instrumental-panel alignment
    // 2. Hedonic score
    // 3. Absence of off-notes (GC-Olfactometry)
    // 4. Texture quality
    // 5. CATA positive attributes
    
    const hedonicNormalized = (sample.hedonic.overall / 9) * 100; // 0-100 scale
    
    // Check for critical off-notes using GC-Olfactometry (odour intensity ≥3)
    const hasOffNotes = sample.gcmsOlfactometry.some(compound => 
      (compound.odourIntensity >= 3 && (
        compound.odour.toLowerCase().includes("rancid") || 
        compound.odour.toLowerCase().includes("cardboard") ||
        compound.odour.toLowerCase().includes("fermented")
      )) ||
      (compound.concentration && compound.threshold && compound.concentration > compound.threshold)
    );
    
    // GC-O penalty factor (5% as per ISSF spec)
    const gcoPenalty = hasOffNotes ? 5 : 0;
    
    // Texture quality (based on creaminess, low graininess/chalkiness)
    const textureScore = (((sample.intensity.creamy ?? 5) / 10) * 100) -
                         (((sample.intensity.grainy ?? 0) + (sample.intensity.chalky ?? 0)) / 20 * 50);
    
    // CATA positive attributes using actual lexicon
    const positiveAttributes = (sample.cata["Butter"] || 0) + (sample.cata["Milk"] || 0) + 
                               (sample.cata["Cheese"] || 0) + (sample.cata["Nutty"] || 0);
    const cataScore = (positiveAttributes / (14 * 4)) * 100; // normalized
    
    // Emotional profile
    const emotionalScore = ((sample.emotions.positive / 5) - (sample.emotions.negative / 5)) * 50 + 50; // 0-100
    
    // Composite ISSF score (weighted average with GC-O penalty)
    const issfScore = (hedonicNormalized * weights.hedonic / 100) +
                      (textureScore * weights.texture / 100) +
                      (cataScore * weights.cata / 100) +
                      (emotionalScore * weights.emotional / 100) -
                      gcoPenalty;
    
    // Apply penalty cap for critical off-notes (odour intensity ≥4)
    const hasCriticalDefect = sample.gcmsOlfactometry.some(c => c.odourIntensity >= 4);
    const finalIssfScore = hasCriticalDefect ? Math.min(issfScore, 55) : issfScore;
    
    // Calculate confidence based on various factors
    const hasTrainedRef = !!sample.trainedPanelReference;
    const baseConfidence = hasTrainedRef ? 
      Math.max(0, 100 - Math.abs(finalIssfScore - sample.trainedPanelReference.overallQuality)) :
      80;
    
    // Factor in olfactometry-panel agreement
    const olfactometryAgreement = 88; // From inter-rater stats
    const adjustedConfidence = (baseConfidence * 0.7) + (olfactometryAgreement * 0.3);
    
    const offNoteConfidence = hasOffNotes ? 95 : adjustedConfidence; // High confidence if clear off-notes detected
    const confidenceScore = Math.min(offNoteConfidence, 98);
    
    // Decision logic (with escalation path)
    let decision: "GO" | "TWEAK" | "STOP";
    let recommendation: string;
    let costSavings: number;
    let timeline: string;
    let riskLevel: "low" | "medium" | "high";
    
    if (finalIssfScore >= 75 && !hasOffNotes && confidenceScore >= 70) {
      decision = "GO";
      recommendation = "Product ready for next development stage. Mixed panel methodology confirms quality.";
      costSavings = 33000;
      timeline = "1 week";
      riskLevel = "low";
    } else if (finalIssfScore < 55 || hasCriticalDefect) {
      decision = "STOP";
      recommendation = hasCriticalDefect ? 
        "Critical defects detected (GC-O intensity ≥4). Major reformulation required - do not proceed." :
        "Product does not meet minimum quality threshold. Major reformulation required.";
      costSavings = 33000;
      timeline = "1 week";
      riskLevel = "low";
    } else {
      // 55-75 range OR low confidence
      if (confidenceScore < 70) {
        decision = "TWEAK";
        recommendation = "ISSF confidence <70%. Moderate quality - targeted improvements recommended before re-testing.";
        costSavings = 33000;
        timeline = "2 weeks";
        riskLevel = "medium";
      } else {
        decision = "TWEAK";
        recommendation = "Moderate quality. Minor reformulation recommended, then re-test with ISSF.";
        costSavings = 33000;
        timeline = "2 weeks";
        riskLevel = "medium";
      }
    }
    
    // Generate details
    const details: string[] = [];
    details.push(`ISSF Score: ${finalIssfScore.toFixed(1)}/100 (Confidence: ${confidenceScore.toFixed(0)}%)`);
    details.push(`Hedonic: ${sample.hedonic.overall.toFixed(1)}/9 | Texture: ${textureScore.toFixed(0)}/100`);
    
    if (sample.trainedPanelReference) {
      const delta = Math.abs(finalIssfScore - sample.trainedPanelReference.overallQuality);
      details.push(`Validated: Trained panel = ${sample.trainedPanelReference.overallQuality} (Δ = ${delta.toFixed(1)})`);
    }
    
    // GC-O off-notes
    if (hasOffNotes) {
      sample.gcmsOlfactometry.forEach(compound => {
        if (compound.odourIntensity >= 3 && (
          compound.odour.toLowerCase().includes("rancid") || 
          compound.odour.toLowerCase().includes("cardboard") ||
          compound.odour.toLowerCase().includes("fermented")
        )) {
          details.push(`Off-note — ${compound.compound}: ${compound.concentration?.toFixed(1) || 'detected'} ppm (intensity: ${compound.odourIntensity.toFixed(1)}/5) - ${compound.odour}`);
        }
      });
    }
    
    // Key positive attributes
    if (sample.cata["Butter"] && sample.cata["Butter"] >= 9) {
      details.push(`High buttery note: ${sample.cata["Butter"]}/14 panelists`);
    }
    if ((sample.intensity.smooth ?? 0) >= 7.5) {
      details.push(`Excellent smoothness: ${(sample.intensity.smooth ?? 0).toFixed(1)}/10`);
    }
    
    return {
      sampleId: sample.sampleId,
      sampleName: sample.sampleName,
      issfScore: finalIssfScore,
      confidenceScore,
      decision,
      recommendation,
      costSavings,
      timeline,
      riskLevel,
      details,
      dimensionScores: {
        hedonic: hedonicNormalized,
        texture: Math.max(0, Math.min(100, textureScore)),
        cata: cataScore,
        emotional: emotionalScore,
      },
    };
  });

  const selected = sampleDecisions.find(d => d.sampleId === selectedSample);
  const selectedSensory = ENHANCED_SENSORY_DATA.find(s => s.sampleId === selectedSample);

  // Stats
  const stats = {
    go: sampleDecisions.filter(d => d.decision === "GO").length,
    tweak: sampleDecisions.filter(d => d.decision === "TWEAK").length,
    stop: sampleDecisions.filter(d => d.decision === "STOP").length,
    totalSavings: sampleDecisions.reduce((sum, d) => sum + d.costSavings, 0),
    avgConfidence: Math.round(sampleDecisions.reduce((sum, d) => sum + d.confidenceScore, 0) / sampleDecisions.length),
    lowRisk: sampleDecisions.filter(d => d.riskLevel === "low").length,
  };

  const getDecisionIcon = (decision: string) => {
    if (decision === "GO") return (
      <span className="flex items-center gap-1">
        <span className="font-bold text-emerald-600">▲</span>
        <CheckCircle2 className="size-5 text-emerald-600" />
      </span>
    );
    if (decision === "STOP") return (
      <span className="flex items-center gap-1">
        <span className="font-bold text-rose-600">■</span>
        <XCircle className="size-5 text-rose-600" />
      </span>
    );
    return (
      <span className="flex items-center gap-1">
        <span className="font-bold text-amber-600">◆</span>
        <AlertTriangle className="size-5 text-amber-600" />
      </span>
    );
  };

  const getDecisionBadge = (decision: string) => {
    if (decision === "GO") return <Badge className="bg-emerald-600 text-white text-base px-4 py-1">▲ GO</Badge>;
    if (decision === "STOP") return <Badge className="bg-rose-600 text-white text-base px-4 py-1">■ STOP</Badge>;
    return <Badge className="bg-amber-600 text-white text-base px-4 py-1">◆ TWEAK</Badge>;
  };

  // Scatter data: ISSF Score vs Hedonic
  const scatterData = sampleDecisions.map((d, index) => {
    const sensory = ENHANCED_SENSORY_DATA.find(s => s.sampleId === d.sampleId);
    return {
      id: `scatter-${d.sampleId}-${index}`,
      sampleId: d.sampleId,
      name: `${d.sampleName}-${index}`,
      sample: d.sampleName,
      issf: d.issfScore,
      hedonic: sensory ? sensory.hedonic.overall : 0,
      decision: d.decision,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Final Decision</h1>
          <p className="text-sm text-slate-500 mt-1">
            Validated against {METHOD_COMPARISON.pearsonR.toFixed(2)} correlation with trained panel (n=127)
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowWeightConfig(!showWeightConfig)} variant="outline" size="sm">
            {showWeightConfig ? <EyeOff className="size-4 mr-2" /> : <Eye className="size-4 mr-2" />}
            Score Weights
          </Button>
          <Button onClick={() => setShowQualitative(!showQualitative)} variant="outline" size="sm">
            {showQualitative ? <EyeOff className="size-4 mr-2" /> : <Eye className="size-4 mr-2" />}
            Panelist Quotes
          </Button>
          <Button onClick={() => setShowRawData(!showRawData)} variant="outline" size="sm">
            {showRawData ? <EyeOff className="size-4 mr-2" /> : <Eye className="size-4 mr-2" />}
            Raw Data
          </Button>
          <Button
            onClick={() => setConfirmPending(true)}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ClipboardCheck className="size-4 mr-2" />
            Confirm Decision
          </Button>
          <Button onClick={() => setShowAuditTrail(v => !v)} variant="outline" size="sm">
            <ClipboardCheck className="size-4 mr-2" />
            Audit Trail
          </Button>
        </div>
      </div>

      {/* Weight Configuration */}
      {showWeightConfig && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4 text-blue-600" />
              ISSF Score Weights
              <span className="ml-auto text-xs text-slate-500 font-normal">
                Total: <span className={
                  weights.hedonic + weights.texture + weights.cata + weights.emotional === 95
                    ? 'text-emerald-600 font-bold'
                    : 'text-amber-600 font-bold'
                }>{weights.hedonic + weights.texture + weights.cata + weights.emotional}%</span>
                {' '}+ 5% GC-O penalty reserve = 100%
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-6">
              {([
                { key: 'hedonic', label: 'Hedonic Score', color: 'rose' },
                { key: 'texture', label: 'Texture Quality', color: 'blue' },
                { key: 'cata', label: 'CATA Attributes', color: 'purple' },
                { key: 'emotional', label: 'Emotional Profile', color: 'emerald' },
              ] as const).map(({ key, label, color }) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">{label}</label>
                    <span className={`text-lg font-bold text-${color}-600`}>{weights[key]}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={95}
                    step={5}
                    value={weights[key]}
                    onChange={e => setWeights(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>0%</span>
                    <span>95%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Default: Hedonic 30%, Texture 25%, CATA 25%, Emotional 15% (sums to 95%; 5% reserved for GC-O penalty cap)
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setWeights({ hedonic: 30, texture: 25, cata: 25, emotional: 15 })}
              >
                Reset to Default
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch Decision Summary */}
      <Card className="shadow-sm">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-slate-800">Batch Decision Summary</span>
            <span className="text-xs text-slate-500">{sampleDecisions.length} prototypes analyzed</span>
          </div>
          <div className="flex rounded-lg overflow-hidden h-9 shadow-inner">
            {stats.go > 0 && (
              <div
                className="bg-emerald-500 flex items-center justify-center text-white text-sm font-bold gap-1 transition-all cursor-pointer hover:bg-emerald-600"
                style={{ width: `${(stats.go / sampleDecisions.length) * 100}%` }}
                title="Click to select first GO sample"
                onClick={() => {
                  const first = sampleDecisions.find(d => d.decision === "GO");
                  if (first) setSelectedSample(first.sampleId);
                }}
              >
                ▲ {stats.go}
              </div>
            )}
            {stats.tweak > 0 && (
              <div
                className="bg-amber-500 flex items-center justify-center text-white text-sm font-bold gap-1 transition-all cursor-pointer hover:bg-amber-600"
                style={{ width: `${(stats.tweak / sampleDecisions.length) * 100}%` }}
                title="Click to select first TWEAK sample"
                onClick={() => {
                  const first = sampleDecisions.find(d => d.decision === "TWEAK");
                  if (first) setSelectedSample(first.sampleId);
                }}
              >
                ◆ {stats.tweak}
              </div>
            )}
            {stats.stop > 0 && (
              <div
                className="bg-rose-500 flex items-center justify-center text-white text-sm font-bold gap-1 transition-all cursor-pointer hover:bg-rose-600"
                style={{ width: `${(stats.stop / sampleDecisions.length) * 100}%` }}
                title="Click to select first STOP sample"
                onClick={() => {
                  const first = sampleDecisions.find(d => d.decision === "STOP");
                  if (first) setSelectedSample(first.sampleId);
                }}
              >
                ■ {stats.stop}
              </div>
            )}
          </div>
          <div className="mt-4 grid grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-emerald-600">{stats.go}</div>
              <div className="text-xs text-slate-500 mt-0.5">GO</div>
              <div className="text-xs text-slate-400">advance now</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">{stats.tweak}</div>
              <div className="text-xs text-slate-500 mt-0.5">TWEAK</div>
              <div className="text-xs text-slate-400">minor fix</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-rose-600">{stats.stop}</div>
              <div className="text-xs text-slate-500 mt-0.5">STOP</div>
              <div className="text-xs text-slate-400">reformulate</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{stats.avgConfidence}%</div>
              <div className="text-xs text-slate-500 mt-0.5">Confidence</div>
              <div className="text-xs text-slate-400">avg certainty</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600">${(stats.totalSavings / 1000).toFixed(0)}k</div>
              <div className="text-xs text-slate-500 mt-0.5">R&D Savings</div>
              <div className="text-xs text-slate-400">vs full panel</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ISSF Score vs Hedonic */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-blue-600" />
            ISSF Score vs. Hedonic Liking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350} key="issf-hedonic-container">
            <ScatterChart 
              margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
              id="issf-hedonic-scatter"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <ReferenceArea x1={0} x2={55} y1={0} y2={9} fill="#fecaca" fillOpacity={0.25} />
              <ReferenceArea x1={55} x2={75} y1={0} y2={9} fill="#fde68a" fillOpacity={0.25} />
              <ReferenceArea x1={75} x2={100} y1={0} y2={9} fill="#a7f3d0" fillOpacity={0.25} />
              <ReferenceLine x={55} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "STOP", position: "insideTopLeft", fill: "#b91c1c", fontSize: 10 }} />
              <ReferenceLine x={75} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "GO", position: "insideTopRight", fill: "#065f46", fontSize: 10 }} />
              <XAxis
                type="number" 
                dataKey="issf" 
                name="ISSF Score" 
                domain={[0, 100]}
                label={{ value: 'ISSF Score (0-100)', position: 'insideBottom', offset: -10 }}
              />
              <YAxis 
                type="number" 
                dataKey="hedonic" 
                name="Hedonic" 
                domain={[0, 9]}
                label={{ value: 'Hedonic Liking (1-9)', angle: -90, position: 'insideLeft' }}
              />
              <RechartsTooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 shadow-xl rounded-lg border border-slate-200">
                        <p className="font-bold text-slate-900">{data.sample}</p>
                        <p className="text-sm text-slate-700">ISSF: {data.issf.toFixed(1)}</p>
                        <p className="text-sm text-slate-700">Hedonic: {data.hedonic.toFixed(1)}/9</p>
                        <p className="text-sm font-bold capitalize">{data.decision}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter
                key="scatter-issf-hedonic"
                data={scatterData}
                dataKey="issf"
                isAnimationActive={false}
                style={{ cursor: 'pointer' }}
                shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isSelected = payload.sampleId === selectedSample;
                  let color = "#10b981";
                  if (payload.decision === "STOP") color = "#ef4444";
                  if (payload.decision === "TWEAK") color = "#f59e0b";
                  const s = isSelected ? 9 : 6;
                  const shapeKey = `shape-${payload.id || payload.sample}`;
                  const handleClick = () => setSelectedSample(payload.sampleId);
                  if (payload.decision === "GO") {
                    return (
                      <g key={shapeKey} onClick={handleClick} style={{ cursor: 'pointer' }}>
                        {isSelected && <circle cx={cx} cy={cy} r={15} fill="none" stroke="#1d4ed8" strokeWidth={2.5} />}
                        <polygon points={`${cx},${cy - s} ${cx + s * 0.9},${cy + s * 0.5} ${cx - s * 0.9},${cy + s * 0.5}`} fill={color} stroke="#fff" strokeWidth={1} />
                      </g>
                    );
                  }
                  if (payload.decision === "STOP") {
                    return (
                      <g key={shapeKey} onClick={handleClick} style={{ cursor: 'pointer' }}>
                        {isSelected && <circle cx={cx} cy={cy} r={13} fill="none" stroke="#1d4ed8" strokeWidth={2.5} />}
                        <rect x={cx - s} y={cy - s} width={s * 2} height={s * 2} fill={color} stroke="#fff" strokeWidth={1} />
                      </g>
                    );
                  }
                  return (
                    <g key={shapeKey} onClick={handleClick} style={{ cursor: 'pointer' }}>
                      {isSelected && <circle cx={cx} cy={cy} r={14} fill="none" stroke="#1d4ed8" strokeWidth={2.5} />}
                      <polygon points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`} fill={color} stroke="#fff" strokeWidth={1} />
                    </g>
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
              <span className="text-sm text-slate-700">GO ({stats.go})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-amber-500"></div>
              <span className="text-sm text-slate-700">TWEAK ({stats.tweak})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-rose-500"></div>
              <span className="text-sm text-slate-700">STOP ({stats.stop})</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-6">
        {/* Sample List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prototypes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[1200px] overflow-y-auto">
              {sampleDecisions.map(sample => (
                <button
                  key={sample.sampleId}
                  onClick={() => setSelectedSample(sample.sampleId)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedSample === sample.sampleId
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-sm">{sample.sampleName}</span>
                    {getDecisionIcon(sample.decision)}
                  </div>
                  <div className="text-xs text-slate-600">{sample.issfScore.toFixed(0)}/100</div>
                  <div className="text-xs text-slate-500">±{sample.confidenceScore.toFixed(0)}%</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <div className="col-span-3 space-y-6">
          {selected && selectedSensory && (
            <>
              <Card className={`border-2 ${
                selected.decision === "GO" ? "border-emerald-400 bg-emerald-50" :
                selected.decision === "STOP" ? "border-rose-400 bg-rose-50" :
                "border-amber-400 bg-amber-50"
              }`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{selected.sampleName}</h2>
                      <div className="mt-2">{getDecisionBadge(selected.decision)}</div>
                    </div>
                    <IssfGauge score={selected.issfScore} confidence={selected.confidenceScore} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-white p-4 rounded-lg border-2 border-slate-200 mb-4">
                    <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <Activity className="size-5 text-blue-600" />
                      Recommendation
                    </h3>
                    <p className="text-base text-slate-800 mb-3">{selected.recommendation}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <Badge className="bg-blue-600">Timeline: {selected.timeline}</Badge>
                      <Badge className="bg-emerald-600">Savings: ${(selected.costSavings / 1000).toFixed(0)}k</Badge>
                      <Badge className={
                        selected.riskLevel === "low" ? "bg-emerald-600" :
                        selected.riskLevel === "medium" ? "bg-amber-600" : "bg-rose-600"
                      }>
                        Risk: {selected.riskLevel.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border-2 border-slate-200 mb-4">
                    <h3 className="font-bold text-slate-900 mb-2">Key Findings</h3>
                    <ul className="space-y-2">
                      {selected.details.map((detail, idx) => (
                        <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                          <span className="text-slate-400">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <PathToGoPanel selected={selected} selectedSensory={selectedSensory} weights={weights} />

                  {/* Multi-dimensional profile */}
                  <div className="bg-white p-4 rounded-lg border-2 border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-3">Sensory Profile</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-600 mb-2">Taste (E-Tongue)</div>
                        <div className="space-y-1">
                          {Object.entries(selectedSensory.taste).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between text-xs">
                              <span className="capitalize text-slate-700">{key}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-slate-200 rounded-full h-2">
                                  <div 
                                    className="bg-purple-600 h-2 rounded-full" 
                                    style={{ width: `${(value / 10) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-slate-600 w-8 text-right">{value.toFixed(1)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-600 mb-2">Texture (Panelist Intensity)</div>
                        <div className="space-y-1">
                          {Object.entries(selectedSensory.intensity).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between text-xs">
                              <span className="capitalize text-slate-700">{key}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-slate-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full" 
                                    style={{ width: `${(value / 10) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-slate-600 w-8 text-right">{value.toFixed(1)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Qualitative Insights */}
              {showQualitative && selectedSensory.trainedPanelReference && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Award className="size-5 text-amber-600" />
                      Validation: Trained Panel Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="text-xs text-blue-700 mb-1">ISSF Score</div>
                        <div className="text-3xl font-bold text-blue-900">{selected.issfScore.toFixed(1)}</div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="text-xs text-purple-700 mb-1">Trained Panel Score</div>
                        <div className="text-3xl font-bold text-purple-900">{selectedSensory.trainedPanelReference.overallQuality}</div>
                      </div>
                      <div className={`p-4 rounded-lg border ${
                        Math.abs(selected.issfScore - selectedSensory.trainedPanelReference.overallQuality) < 10 ?
                        "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
                      }`}>
                        <div className="text-xs text-slate-700 mb-1">Difference (Δ)</div>
                        <div className="text-3xl font-bold text-slate-900">
                          {Math.abs(selected.issfScore - selectedSensory.trainedPanelReference.overallQuality).toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-700">
                        <strong>Agreement:</strong> {selected.decision === selectedSensory.trainedPanelReference.recommendation ? 
                          <span className="text-emerald-600"><CheckCircle2 className="size-3.5 inline mr-1" />Both methods agree: {selected.decision}</span> :
                          <span className="text-amber-600">△ ISSF: {selected.decision} | Trained: {selectedSensory.trainedPanelReference.recommendation}</span>
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Raw Data */}
              {showRawData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Raw Instrumental Data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-50 p-4 rounded-lg font-mono text-xs">
                      <pre>{JSON.stringify(selectedSensory, null, 2)}</pre>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirm Decision dialog */}
      {confirmPending && selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Confirm Decision</h2>
            <p className="text-sm text-slate-600">
              You are logging a <strong>{selected.decision}</strong> decision for <strong>{selected.sampleName}</strong>{" "}
              (ISSF {selected.issfScore.toFixed(1)}, confidence {selected.confidenceScore.toFixed(0)}%) to the audit trail.
            </p>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Optional note (rationale, batch ID, etc.)
              </label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="e.g. Approved for pilot batch #2024-11-A after steering review"
                value={auditNote}
                onChange={e => setAuditNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setConfirmPending(false); setAuditNote(""); }}>
                Cancel
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  appendDecision({
                    sampleId: selected.sampleId,
                    sampleName: selected.sampleName,
                    decision: selected.decision,
                    issfScore: selected.issfScore,
                    confidence: selected.confidenceScore,
                    user: user?.name ?? "Admin",
                    note: auditNote.trim(),
                  });
                  setLogRefreshKey(k => k + 1);
                  setShowAuditTrail(true);
                  setConfirmPending(false);
                  setAuditNote("");
                }}
              >
                Log Decision
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Audit trail panel */}
      {showAuditTrail && <DecisionLog refreshKey={logRefreshKey} />}
    </div>
  );
}