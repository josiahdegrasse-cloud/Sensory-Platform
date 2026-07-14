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
  const displayedIssf = input.instrumentSignal === null
    ? weightedBase
    : Math.round((weightedBase * ISSF_SENSORY_BLEND + input.instrumentSignal * ISSF_INSTRUMENT_BLEND - input.gatePenalty) * 10) / 10;
  const precisionResidual = Math.round((input.storedIssf - displayedIssf) * 10) / 10;
  const displayPrecisionAdjustment = Math.abs(precisionResidual) <= 1.5 ? precisionResidual : 0;
  const reproducedIssf = Math.round((displayedIssf + displayPrecisionAdjustment) * 10) / 10;

  return {
    methodId: input.methodId,
    methodVersion: input.methodVersion,
    weights,
    thresholds: input.thresholds,
    contributions,
    weightedBase,
    instrumentSignal: input.instrumentSignal,
    gatePenalty: input.gatePenalty,
    displayPrecisionAdjustment,
    missingDataPolicy: 'Texture is scored over the cues the study actually measured (NFI-GST-2.0). Expected cues the study did not capture are excluded from the texture average — they remain labeled missing, are never represented as measured zero, and reduce the decision CONFIDENCE via the texture descriptor-coverage input instead of deflating the texture score.',
    formula: input.instrumentSignal === null
      ? 'Instrument signal unavailable; the stored ISSF cannot be fully reproduced from the report snapshot.'
      : `ISSF = (${weightedBase.toFixed(1)} × 0.86) + (${input.instrumentSignal.toFixed(1)} × 0.14) - ${input.gatePenalty.toFixed(1)}${displayPrecisionAdjustment === 0 ? '' : ` ${displayPrecisionAdjustment > 0 ? '+' : '-'} ${Math.abs(displayPrecisionAdjustment).toFixed(1)} displayed-precision reconciliation`} = ${reproducedIssf.toFixed(1)}`,
    reproducedIssf,
    storedIssf: input.storedIssf,
    confidenceBasis: input.confidenceBasis,
    confidenceCalculation: input.confidenceCalculation,
    conditionalReason: input.weakestScore < input.thresholds.readiness
      ? `${input.weakestDimensionLabel} (${Math.round(input.weakestScore)}/100) is below the ${input.thresholds.readiness}/100 readiness line. A sub-readiness critical dimension caps the outcome at conditional advancement: the sensory screening supports continued development, but not unrestricted GO or launch.`
      : input.weakestScore < input.thresholds.go
        ? `${input.weakestDimensionLabel} (${Math.round(input.weakestScore)}/100) is above the ${input.thresholds.readiness}/100 minimum readiness line but below the preferred GO target of ${input.thresholds.go}/100. It remains the lowest dimension and should be monitored while the separate concept, claims, and approval gates are completed.`
        : `All recorded sensory dimensions meet the ${input.thresholds.go}/100 GO target. The product GO supports launch preparation; concept, claims, packaging, and approval gates separately control which external claims are supportable.`,
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
// Positive texture cue vocabularies; mirrors scoreTexture's positiveKeys so
// the explanation matches the score. Under NFI-GST-2.0, the texture average
// uses only the cues the study measured; unmeasured cues are excluded (and
// lower confidence via descriptor coverage, not the texture score).
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

export function buildTextureBreakdown(
  intensity: Record<string, number>,
  foodTypeSlug: string,
  score: number,
  threshold: number,
  methodVersion = 'NFI-GST-2.0',
): TextureBreakdown {
  const positiveKeys = TEXTURE_POSITIVE_KEYS[foodTypeSlug] ?? TEXTURE_POSITIVE_KEYS.cheese;

  // Saved reports keep the explanation of the method that produced their
  // stored score. NFI-GST-1.x used the zero-fill completeness penalty; the
  // reproduction must match that stored arithmetic, not today's rule.
  if (!/NFI-GST-2/.test(methodVersion)) {
    return buildLegacyZeroFillBreakdown(intensity, positiveKeys, score, threshold);
  }

  // Mirrors the engine's "measured" test exactly: a measured 0 is evidence,
  // an absent key is missing evidence.
  const measured = (k: string) => Number.isFinite(intensity[k]);

  const positiveMetrics: RawMetric[] = positiveKeys.map(key => ({
    label: `${key} (positive cue)`,
    value: measured(key) ? Number(intensity[key]) : 'not captured',
    scale: '0–10',
    direction: 'higher_better',
    missing: !measured(key),
  }));
  const negativeMetrics: RawMetric[] = TEXTURE_NEGATIVE_KEYS
    .filter(measured)
    .map(key => ({ label: `${key} (negative cue)`, value: Number(intensity[key]), scale: '0–10', direction: 'lower_better' }));

  const measuredPositive = positiveKeys.filter(measured);
  const measuredNegative = TEXTURE_NEGATIVE_KEYS.filter(measured);
  const missing = positiveKeys.filter(k => !measured(k));

  if (measuredPositive.length === 0) {
    return {
      rawMetrics: [...positiveMetrics, ...negativeMetrics],
      explanation: `Texture ${score}/100 (threshold ${threshold}). No texture descriptor cues were measured for this study, so under NFI-GST-2.0 the 9-pt hedonic texture liking stands in as the only texture evidence. Texture descriptor coverage is 0/${positiveKeys.length}, which lowers the decision confidence — the score reflects the evidence available, not fabricated descriptor data.`,
    };
  }

  const posAvg = measuredPositive.reduce((s, k) => s + Number(intensity[k]), 0) / measuredPositive.length;
  const negAvg = measuredNegative.length > 0
    ? measuredNegative.reduce((s, k) => s + Number(intensity[k]), 0) / measuredNegative.length
    : 0;
  const reproduced = Math.max(0, Math.min(100, (posAvg / 10) * 105 - (negAvg / 10) * 45));

  const explanation = missing.length
    ? `Texture ${score}/100 (threshold ${threshold}) = (${posAvg.toFixed(2)}/10 × 105) - (${negAvg.toFixed(2)}/10 × 45) = ${reproduced.toFixed(1)}, averaged over the measured cues (${measuredPositive.join(', ')}). Unmeasured cues (${missing.join(', ')}) are excluded under NFI-GST-2.0 — they remain missing values, not measured zeros, and reduce decision confidence through texture descriptor coverage (${measuredPositive.length}/${positiveKeys.length}).`
    : `Texture ${score}/100 (threshold ${threshold}) = (${posAvg.toFixed(2)}/10 × 105) - (${negAvg.toFixed(2)}/10 × 45) = ${reproduced.toFixed(1)}, using positive cues (${positiveKeys.join(', ')}) net of negative cues.`;

  return { rawMetrics: [...positiveMetrics, ...negativeMetrics], explanation };
}

// Reproduction of the NFI-GST-1.x texture arithmetic for reports saved under
// that method: expected-but-unobserved positive cues contributed zero to the
// average (the "completeness penalty"). Kept so a legacy report's stored score
// and its QC explanation remain arithmetically consistent.
function buildLegacyZeroFillBreakdown(
  intensity: Record<string, number>,
  positiveKeys: string[],
  score: number,
  threshold: number,
): TextureBreakdown {
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

  const missing = positiveKeys.filter(k => !present(k));
  const posAvg = positiveKeys.reduce((s, k) => s + (present(k) ? Number(intensity[k]) : 0), 0) / positiveKeys.length;
  const negAvg = TEXTURE_NEGATIVE_KEYS.reduce((s, k) => s + (present(k) ? Number(intensity[k]) : 0), 0) / TEXTURE_NEGATIVE_KEYS.length;
  const reproduced = Math.max(0, Math.min(100, (posAvg / 10) * 105 - (negAvg / 10) * 45));

  const explanation = missing.length
    ? `Texture ${score}/100 (threshold ${threshold}) = (${posAvg.toFixed(2)}/10 × 105) - (${negAvg.toFixed(2)}/10 × 45) = ${reproduced.toFixed(1)}. Creamy and smooth are high; unobserved ${missing.join(' and ')} receive zero contribution under the documented completeness-penalty rule across expected cues (${positiveKeys.join(', ')}). They remain missing values, not measured zeros. The low composite reflects incomplete structure evidence, not poor creaminess.`
    : `Texture ${score}/100 (threshold ${threshold}) = (${posAvg.toFixed(2)}/10 × 105) - (${negAvg.toFixed(2)}/10 × 45) = ${reproduced.toFixed(1)}, using positive cues (${positiveKeys.join(', ')}) net of negative cues.`;

  return { rawMetrics: [...positiveMetrics, ...negativeMetrics], explanation };
}
