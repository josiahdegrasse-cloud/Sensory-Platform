import type { GoStopTweakDecision } from '../../utils/go-stop-tweak-engine';
import type { IssfContribution, MethodologyEvidence, RawMetric } from './types';

// ════════════════════════════════════════════════════════════════════════════
// Methodology reproduction. Turns the dimension scores + production weights into
// a per-dimension weighted-contribution table so a technical reviewer can
// recreate the weighted sensory base, and explains the instrument-signal blend
// and gate adjustments that produce the final ISSF.
// ════════════════════════════════════════════════════════════════════════════

// Production weights (mirrors DEFAULT_WEIGHTS in report-evidence.ts) and the
// engine's blend: ISSF = 0.86·(weighted sensory base) + 0.14·(instrument signal) − gate penalties.
export const ISSF_DIMENSION_WEIGHTS = { hedonic: 30, texture: 25, cata: 25, emotional: 15 };
export const ISSF_SENSORY_BLEND = 0.86;
export const ISSF_INSTRUMENT_BLEND = 0.14;

const DIMENSION_LABELS: Record<string, string> = {
  hedonic: 'Sensory acceptance',
  texture: 'Texture',
  cata: 'Descriptor profile',
  emotional: 'Emotional response',
};

export function buildMethodology(input: {
  dimensions: Record<string, number>;
  storedIssf: number;
  methodId: string;
  methodVersion: string;
  thresholds: { go: number; stop: number; readiness: number };
  confidenceBasis: string[];
  weakestDimensionLabel: string;
  weakestScore: number;
  instrumentSignal: number | null;
  gatePenalty: number;
  confidenceCalculation: MethodologyEvidence['confidenceCalculation'];
}): MethodologyEvidence {
  const weights = ISSF_DIMENSION_WEIGHTS as Record<string, number>;
  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
  const contributions: IssfContribution[] = Object.entries(input.dimensions).map(([dim, score]) => {
    const weightPct = (weights[dim] ?? 0) / totalWeight;
    return {
      dimension: DIMENSION_LABELS[dim] ?? dim,
      score: Number(score),
      weightPct: Math.round(weightPct * 1000) / 10,
      contribution: Math.round(Number(score) * weightPct * 10) / 10,
    };
  });
  const weightedBase = Math.round(contributions.reduce((s, c) => s + c.contribution, 0) * 10) / 10;
  const reproducedIssf = input.instrumentSignal === null
    ? weightedBase
    : Math.round((weightedBase * ISSF_SENSORY_BLEND + input.instrumentSignal * ISSF_INSTRUMENT_BLEND - input.gatePenalty) * 10) / 10;

  return {
    methodId: input.methodId,
    methodVersion: input.methodVersion,
    weights,
    thresholds: input.thresholds,
    contributions,
    weightedBase,
    instrumentSignal: input.instrumentSignal,
    gatePenalty: input.gatePenalty,
    formula: input.instrumentSignal === null
      ? 'Instrument signal unavailable; the stored ISSF cannot be fully reproduced from the report snapshot.'
      : `ISSF = (${weightedBase.toFixed(1)} × 0.86) + (${input.instrumentSignal.toFixed(1)} × 0.14) − ${input.gatePenalty.toFixed(1)} = ${reproducedIssf.toFixed(1)}`,
    reproducedIssf,
    storedIssf: input.storedIssf,
    confidenceBasis: input.confidenceBasis,
    confidenceCalculation: input.confidenceCalculation,
    conditionalReason: `${input.weakestDimensionLabel} (${input.weakestScore}/100) is below the ${input.thresholds.readiness}/100 readiness line. A sub-readiness critical dimension caps the outcome at conditional advancement: the sensory screening supports continued development, but not unrestricted GO or launch.`,
  };
}

// The stored ISSF must sit inside the band the blend can produce from the
// reproducible weighted base. Outside the band ⇒ the displayed scores cannot
// recreate the decision.
export function issfWithinReproducibleBand(weightedBase: number, storedIssf: number): boolean {
  const low = weightedBase * ISSF_SENSORY_BLEND;          // instrument signal = 0
  const high = weightedBase * ISSF_SENSORY_BLEND + ISSF_INSTRUMENT_BLEND * 100; // instrument signal = 100
  return storedIssf >= low - 0.5 && storedIssf <= high + 0.5;
}

export function isIssfReproduced(methodology: MethodologyEvidence): boolean {
  return methodology.instrumentSignal !== null
    && Math.abs(methodology.reproducedIssf - methodology.storedIssf) <= 0.15;
}

// ── Texture / dimension calculation explanation ─────────────────────────────
// Cheese positive texture cues; mirrors scoreTexture's positiveKeys so the
// explanation matches the score. Missing cues (firm, spreadable) score 0 and
// drag the positive average down — this is why a creamy/smooth product can still
// fall below the texture readiness line.
const TEXTURE_POSITIVE_KEYS: Record<string, string[]> = {
  cheese: ['creamy', 'smooth', 'firm', 'spreadable'],
  meat: ['juicy', 'tender', 'firm'],
  bread: ['soft', 'crusty', 'chewy', 'airy', 'springy'],
};
const TEXTURE_NEGATIVE_KEYS = ['grainy', 'chalky', 'dry', 'rubbery', 'gummy', 'sticky', 'dense'];

export interface TextureBreakdown {
  rawMetrics: RawMetric[];
  explanation: string;
}

export function buildTextureBreakdown(intensity: Record<string, number>, foodTypeSlug: string, score: number, threshold: number): TextureBreakdown {
  const positiveKeys = TEXTURE_POSITIVE_KEYS[foodTypeSlug] ?? TEXTURE_POSITIVE_KEYS.cheese;
  const present = (k: string) => Number.isFinite(intensity[k]) && Number(intensity[k]) > 0;

  const positiveMetrics: RawMetric[] = positiveKeys.map(key => ({
    label: `${key} (positive cue)`,
    value: present(key) ? Number(intensity[key]) : 'not captured',
    scale: '0–10',
    direction: 'higher_better',
    missing: !present(key),
  }));
  const negativeMetrics: RawMetric[] = TEXTURE_NEGATIVE_KEYS
    .filter(present)
    .map(key => ({ label: `${key} (negative cue)`, value: Number(intensity[key]), scale: '0–10', direction: 'lower_better' }));

  const captured = positiveKeys.filter(present);
  const missing = positiveKeys.filter(k => !present(k));
  const posAvg = positiveKeys.reduce((s, k) => s + (present(k) ? Number(intensity[k]) : 0), 0) / positiveKeys.length;
  const negAvg = TEXTURE_NEGATIVE_KEYS.reduce((s, k) => s + (present(k) ? Number(intensity[k]) : 0), 0) / TEXTURE_NEGATIVE_KEYS.length;
  const reproduced = Math.max(0, Math.min(100, (posAvg / 10) * 105 - (negAvg / 10) * 45));

  const explanation = missing.length
    ? `Texture ${score}/100 (threshold ${threshold}) = (${posAvg.toFixed(2)}/10 × 105) − (${negAvg.toFixed(2)}/10 × 45) = ${reproduced.toFixed(1)}. Creamy and smooth are high; missing ${missing.join(' and ')} count as 0 across the expected cues (${positiveKeys.join(', ')}). The low composite reflects missing structure evidence, not poor creaminess.`
    : `Texture ${score}/100 (threshold ${threshold}) = (${posAvg.toFixed(2)}/10 × 105) − (${negAvg.toFixed(2)}/10 × 45) = ${reproduced.toFixed(1)}, using positive cues (${positiveKeys.join(', ')}) net of negative cues.`;

  return { rawMetrics: [...positiveMetrics, ...negativeMetrics], explanation };
}
