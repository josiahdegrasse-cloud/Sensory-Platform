// Presentational panels for the Final Decision (Stage 4) screen, extracted from
// stage4-enhanced.tsx to keep the container component focused on data + state.
import { CheckCircle2, Zap } from "lucide-react";
import { Badge } from "./ui/badge";
import type { EnhancedSensoryProfile } from "../data/enhanced-sensory";
import type { GoStopTweakDecision } from "../utils/go-stop-tweak-engine";

type SampleDecision = GoStopTweakDecision;

export function IssfGauge({ score, confidence, stopThreshold, goThreshold }: {
  score: number;
  confidence: number;
  stopThreshold: number;
  goThreshold: number;
}) {
  const pct = Math.max(0, Math.min(100, score));
  const tweakWidth = Math.max(0, goThreshold - stopThreshold);
  const goWidth = Math.max(0, 100 - goThreshold);
  return (
    <div className="text-right">
      <div className="text-5xl font-bold text-slate-900">{score.toFixed(0)}</div>
      <div className="text-sm text-slate-600">ISSF Score</div>
      <div className="relative w-36 mt-3 mb-5 ml-auto">
        <div className="flex h-4 rounded-full overflow-hidden shadow-inner">
          <div className="bg-rose-300" style={{ width: `${stopThreshold}%` }} />
          <div className="bg-amber-300" style={{ width: `${tweakWidth}%` }} />
          <div className="bg-emerald-300" style={{ width: `${goWidth}%` }} />
        </div>
        <div
          className="absolute top-0 w-1 h-4 bg-slate-900 rounded shadow-md"
          style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
        />
        <span className="absolute text-xs text-slate-400" style={{ left: `${stopThreshold}%`, top: "18px", transform: "translateX(-50%)" }}>{stopThreshold}</span>
        <span className="absolute text-xs text-slate-400" style={{ left: `${goThreshold}%`, top: "18px", transform: "translateX(-50%)" }}>{goThreshold}</span>
      </div>
      <div className="text-xs text-slate-500">±{confidence.toFixed(0)}% confidence</div>
    </div>
  );
}

export function PathToGoPanel({
  selected,
  selectedSensory,
  weights,
  goThreshold,
}: {
  selected: SampleDecision;
  selectedSensory: EnhancedSensoryProfile;
  weights: { hedonic: number; texture: number; cata: number; emotional: number };
  goThreshold: number;
}) {
  const gap = Math.max(0, goThreshold - selected.issfScore);

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
