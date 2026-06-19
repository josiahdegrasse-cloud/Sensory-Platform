import type { EnhancedSensoryProfile } from '../data/enhanced-sensory';
import { getFoodTypeProfile } from '../lib/food-intelligence';

export type DecisionOutcome = 'GO' | 'TWEAK' | 'STOP';
export type DecisionRisk = 'low' | 'medium' | 'high';

export interface DecisionWeights {
  hedonic: number;
  texture: number;
  cata: number;
  emotional: number;
}

export interface DecisionGate {
  id: string;
  label: string;
  status: 'pass' | 'watch' | 'fail';
  detail: string;
  impact: number;
}

export interface TweakPrescription {
  priority: number;
  target: string;
  action: string;
  expectedLift: number;
}

export interface GoStopTweakDecision {
  sampleId: string;
  sampleName: string;
  issfScore: number;
  confidenceScore: number;
  decision: DecisionOutcome;
  recommendation: string;
  costSavings: number;
  timeline: string;
  riskLevel: DecisionRisk;
  details: string[];
  dimensionScores: { hedonic: number; texture: number; cata: number; emotional: number };
  gates: DecisionGate[];
  prescriptions: TweakPrescription[];
  decisionFingerprint: string;
  methodVersion: string;
}

/*
 * ── Calibration constants ────────────────────────────────────────────────────
 *
 * Everything below is a heuristic calibration of the ISSF screening method,
 * tuned against the NFI reference dataset (ENHANCED_SENSORY_DATA) and its
 * trained-panel reference scores. None of these values come from a published
 * standard; treat them as the method definition itself:
 *
 *  • Changing ANY constant changes live GO/STOP/TWEAK calls for every tenant.
 *  • All current outputs are pinned in go-stop-tweak-engine.pins.test.ts —
 *    a deliberate re-calibration must update those pins AND bump
 *    METHOD_VERSION so old decision fingerprints stay distinguishable.
 *
 * Key knobs and their intent:
 *  • METHOD_VERSION — embedded in every decision fingerprint for audit trails.
 *  • PANEL_N — nominal panel size used to normalize CATA citation counts.
 *    Matches RESEARCH_PANEL_N for the simulated reference panel (n=14).
 *  • DEFECT_WORDS / BENEFIT_WORDS — generic CATA lexicon markers, extended per
 *    food type by getFoodTypeProfile(). Matching is substring-based, so terms
 *    like "sour" also hit "sourdough" — food-type risk/success markers exist
 *    to counterbalance this for category-appropriate descriptors.
 *  • Default thresholds (GO ≥ 76, STOP < 52) — see calculateGoStopTweakDecision;
 *    overridable per workspace via decision settings.
 *  • Base blend (0.86 panel / 0.14 instrument) — panel perception dominates;
 *    the instrument signal nudges rather than decides.
 *  • Hard-stop floors (hedonic overall < 3.8/9, hedonic dimension < 45/100,
 *    any failed gate) — quality floors that cannot be averaged away.
 *  • Gate penalties (off-note −22/−9, QC −12/−5) and ISTD recovery bands
 *    (85–110% pass, 75–85% watch, <75% fail) — instrument QC discipline.
 */
const METHOD_VERSION = 'NFI-GST-1.1';
const PANEL_N = 14;
const DEFECT_WORDS = [
  'rancid', 'cardboard', 'fermented', 'sulfur', 'sulphur', 'livery', 'rubbery',
  'beany', 'chalky', 'burnt', 'stale', 'musty', 'metallic', 'soapy', 'watery',
  'artificial', 'bitter', 'astringent', 'dry', 'sour',
];

const BENEFIT_WORDS = [
  'buttery', 'butter', 'milk', 'cheese', 'creamy', 'nutty', 'fresh', 'savory',
  'savoury', 'umami', 'smoky', 'juicy', 'crunchy', 'crispy', 'balanced',
  'sweet', 'tangy', 'smooth', 'rich', 'toasted', 'malty', 'wheaty',
];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function safeScore(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function includesAny(value: string, words: string[]) {
  const text = normalizeText(value);
  return words.some(word => text.includes(normalizeText(word)));
}

function weightedMean(parts: Array<{ score: number; weight: number }>) {
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight <= 0) return 0;
  return parts.reduce((sum, part) => sum + part.score * part.weight, 0) / totalWeight;
}

function confidenceFromEvidence(sample: EnhancedSensoryProfile, score: number, gates: DecisionGate[]) {
  const qc = clamp(sample.istdRecovery, 0, 110);
  const qcScore = qc >= 85 && qc <= 110 ? 96 : qc >= 75 ? 82 : 62;
  const trainedReferenceScore = sample.trainedPanelReference
    ? clamp(100 - Math.abs(score - sample.trainedPanelReference.overallQuality) * 1.2)
    : 78;
  const gatePenalty = gates.filter(gate => gate.status === 'fail').length * 8 +
    gates.filter(gate => gate.status === 'watch').length * 3;
  return clamp(weightedMean([
    { score: trainedReferenceScore, weight: sample.trainedPanelReference ? 45 : 20 },
    { score: qcScore, weight: 20 },
    { score: sample.gcmsOlfactometry.length > 0 ? 92 : 70, weight: 20 },
    { score: Object.keys(sample.cata).length > 0 ? 88 : 65, weight: 15 },
  ]) - gatePenalty, 35, 98);
}

function scoreHedonic(sample: EnhancedSensoryProfile) {
  return clamp(weightedMean([
    { score: (safeScore(sample.hedonic.overall, 5) / 9) * 100, weight: 42 },
    { score: (safeScore(sample.hedonic.flavour, 5) / 9) * 100, weight: 28 },
    { score: (safeScore(sample.hedonic.texture, 5) / 9) * 100, weight: 20 },
    { score: (safeScore(sample.hedonic.appearance, 5) / 9) * 100, weight: 10 },
  ]));
}

function scoreTexture(sample: EnhancedSensoryProfile, foodTypeSlug: string) {
  const intensity = sample.intensity;
  const positiveKeys = foodTypeSlug === 'meat'
    ? ['juicy', 'tender', 'firm']
    : foodTypeSlug === 'bread'
      ? ['soft', 'crusty', 'chewy', 'airy', 'springy']
      : ['creamy', 'smooth', 'firm', 'spreadable'];
  const negativeKeys = ['grainy', 'chalky', 'dry', 'rubbery', 'gummy', 'sticky', 'dense'];
  const positive = positiveKeys.reduce((sum, key) => sum + safeScore(intensity[key]), 0) / Math.max(1, positiveKeys.length);
  const negative = negativeKeys.reduce((sum, key) => sum + safeScore(intensity[key]), 0) / Math.max(1, negativeKeys.length);
  return clamp((positive / 10) * 105 - (negative / 10) * 45);
}

function scoreCata(sample: EnhancedSensoryProfile, foodTypeSlug: string) {
  const profile = getFoodTypeProfile(foodTypeSlug);
  const successWords = [...profile.successMarkers, ...BENEFIT_WORDS];
  const riskWords = [...profile.riskMarkers, ...DEFECT_WORDS];
  const positiveCount = Object.entries(sample.cata)
    .filter(([attribute]) => includesAny(attribute, successWords))
    .reduce((sum, [, count]) => sum + count, 0);
  const riskCount = Object.entries(sample.cata)
    .filter(([attribute]) => includesAny(attribute, riskWords))
    .reduce((sum, [, count]) => sum + count, 0);
  const positiveScore = clamp((positiveCount / (PANEL_N * 4)) * 100);
  const defectPenalty = clamp((riskCount / (PANEL_N * 3)) * 70);
  return clamp(positiveScore - defectPenalty + 20);
}

function scoreEmotional(sample: EnhancedSensoryProfile) {
  return clamp(((sample.emotions.positive - sample.emotions.negative + 5) / 10) * 100);
}

function scoreInstrumentSignal(sample: EnhancedSensoryProfile, foodTypeSlug: string) {
  const taste = sample.taste;
  const bitternessPenalty = safeScore(taste.bitterness) + safeScore(taste.bitternessAftertaste);
  const astringencyPenalty = safeScore(taste.astringency) + safeScore(taste.astringencyAftertaste);
  const balance = foodTypeSlug === 'meat'
    ? safeScore(taste.umami) * 1.8 + safeScore(taste.richness) * 1.2 + safeScore(taste.saltiness) * 0.7
    : foodTypeSlug === 'bread'
      ? safeScore(taste.sweetness) * 1.2 + safeScore(taste.saltiness) * 0.8 - safeScore(taste.sourness) * 0.5
      : safeScore(taste.umami) + safeScore(taste.richness) + safeScore(taste.saltiness) * 0.6;
  const compositionBonus = foodTypeSlug === 'meat'
    ? safeScore(sample.composition.protein) >= 15 ? 6 : 0
    : foodTypeSlug === 'bread'
      ? sample.composition.starchDryMatter >= 35 ? 6 : 0
      : sample.composition.fat >= 20 ? 6 : 0;
  return clamp(58 + balance * 4 + compositionBonus - bitternessPenalty * 3.2 - astringencyPenalty * 2.6);
}

function buildOffNoteGates(sample: EnhancedSensoryProfile, foodTypeSlug: string): DecisionGate[] {
  const profile = getFoodTypeProfile(foodTypeSlug);
  const riskWords = [...profile.riskMarkers, ...DEFECT_WORDS];
  const riskCompounds = sample.gcmsOlfactometry
    .filter(compound => !compound.isBlankArtefact)
    .map(compound => {
      const thresholdRatio = compound.threshold && compound.threshold > 0 && compound.concentration
        ? compound.concentration / compound.threshold
        : 0;
      const matchesRisk = includesAny(`${compound.compound} ${compound.odour}`, riskWords);
      const severity = Math.max(compound.odourIntensity / 5, thresholdRatio);
      return { compound, thresholdRatio, matchesRisk, severity };
    })
    .filter(item => item.matchesRisk || item.thresholdRatio >= 1);

  const critical = riskCompounds.filter(item => item.compound.odourIntensity >= 4 || item.thresholdRatio >= 1.5);
  const moderate = riskCompounds.filter(item => item.compound.odourIntensity >= 3 || item.thresholdRatio >= 1);
  const worst = [...riskCompounds].sort((a, b) => b.severity - a.severity)[0];
  const gates: DecisionGate[] = [];

  gates.push({
    id: 'off-note',
    label: 'Off-note barrier',
    status: critical.length > 0 ? 'fail' : moderate.length > 0 ? 'watch' : 'pass',
    detail: worst
      ? `${worst.compound.compound}: ${worst.compound.odour}, intensity ${worst.compound.odourIntensity.toFixed(1)}/5${worst.thresholdRatio ? `, ${worst.thresholdRatio.toFixed(1)}x threshold` : ''}`
      : 'No risk aroma above decision threshold.',
    impact: critical.length > 0 ? -22 : moderate.length > 0 ? -9 : 0,
  });

  gates.push({
    id: 'qc',
    label: 'Instrument QC',
    status: sample.istdRecovery < 75 ? 'fail' : sample.istdRecovery < 85 ? 'watch' : 'pass',
    detail: `ISTD recovery ${sample.istdRecovery.toFixed(1)}%.`,
    impact: sample.istdRecovery < 75 ? -12 : sample.istdRecovery < 85 ? -5 : 0,
  });

  return gates;
}

// Food-type-specific positive texture cues, mirroring scoreTexture's positiveKeys.
function positiveTextureCues(foodTypeSlug: string): string[] {
  if (foodTypeSlug === 'meat') return ['juicy', 'tender', 'firm'];
  if (foodTypeSlug === 'bread') return ['soft', 'crusty', 'chewy', 'airy', 'springy'];
  return ['creamy', 'smooth', 'firm', 'spreadable'];
}

const NEGATIVE_TEXTURE_KEYS = ['grainy', 'chalky', 'dry', 'rubbery', 'gummy', 'sticky', 'dense'];

// Names the texture defects that are actually dragging this sample's score and
// the cues to build toward, instead of a generic "depending on the food type"
// list. Uses the same descriptor vocabulary as scoreTexture so the advice and
// the score agree.
function describeTextureAction(sample: EnhancedSensoryProfile, foodTypeSlug: string): string {
  const dominantDefects = NEGATIVE_TEXTURE_KEYS
    .map(key => ({ key, value: safeScore(sample.intensity[key]) }))
    .filter(item => item.value >= 3)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map(item => item.key);
  const cues = positiveTextureCues(foodTypeSlug);
  const targetCues = cues.slice(0, 3).join(', ');
  if (dominantDefects.length > 0) {
    return `Reduce ${dominantDefects.join(' and ')} and build toward ${targetCues} cues through milling, hydration, or fat-protein ratio changes.`;
  }
  return `Lift overall texture liking by reinforcing ${targetCues} cues through formulation and process controls.`;
}

function buildPrescriptions(
  sample: EnhancedSensoryProfile,
  dimensionScores: GoStopTweakDecision['dimensionScores'],
  gates: DecisionGate[],
  foodTypeSlug: string,
): TweakPrescription[] {
  const prescriptions: TweakPrescription[] = [];
  const failedOffNote = gates.find(gate => gate.id === 'off-note' && gate.status !== 'pass');
  if (failedOffNote) {
    prescriptions.push({
      priority: 1,
      target: 'Aroma defect control',
      action: `Remove or mask ${failedOffNote.detail}. Re-test GC-O before running another panel.`,
      expectedLift: failedOffNote.status === 'fail' ? 18 : 9,
    });
  }

  if (dimensionScores.texture < 68) {
    prescriptions.push({
      priority: prescriptions.length + 1,
      target: 'Texture rebuild',
      action: describeTextureAction(sample, foodTypeSlug),
      expectedLift: clamp((75 - dimensionScores.texture) * 0.22, 4, 14),
    });
  }

  if (dimensionScores.hedonic < 70) {
    prescriptions.push({
      priority: prescriptions.length + 1,
      target: 'Liking lift',
      action: 'Run a focused formula tweak against flavour, texture, and overall liking before scale-up.',
      expectedLift: clamp((75 - dimensionScores.hedonic) * 0.2, 3, 12),
    });
  }

  if (dimensionScores.cata < 58) {
    prescriptions.push({
      priority: prescriptions.length + 1,
      target: 'Lexicon fit',
      action: 'Increase category-positive descriptors and suppress defect descriptors in the next sensory screen.',
      expectedLift: clamp((65 - dimensionScores.cata) * 0.16, 3, 10),
    });
  }

  return prescriptions
    .sort((a, b) => b.expectedLift - a.expectedLift)
    .map((item, index) => ({ ...item, priority: index + 1 }))
    .slice(0, 3);
}

function fingerprint(sample: EnhancedSensoryProfile, score: number, gates: DecisionGate[]) {
  const gateCode = gates.map(gate => `${gate.id}:${gate.status}`).join('|');
  const raw = `${METHOD_VERSION}|${sample.sampleId}|${score.toFixed(1)}|${gateCode}|${sample.istdRecovery.toFixed(1)}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, '0');
}

export function calculateGoStopTweakDecision(
  sample: EnhancedSensoryProfile,
  weights: DecisionWeights,
  foodTypeSlug: string,
  thresholds: { go: number; stop: number } = { go: 76, stop: 52 },
): GoStopTweakDecision {
  const stopThreshold = clamp(thresholds.stop, 0, 99);
  const goThreshold = clamp(Math.max(stopThreshold + 1, thresholds.go), 1, 100);
  const normalizedWeights = {
    hedonic: weights.hedonic || 30,
    texture: weights.texture || 25,
    cata: weights.cata || 25,
    emotional: weights.emotional || 15,
  };
  const totalWeight = Object.values(normalizedWeights).reduce((sum, value) => sum + value, 0);
  const dimensionScores = {
    hedonic: scoreHedonic(sample),
    texture: scoreTexture(sample, foodTypeSlug),
    cata: scoreCata(sample, foodTypeSlug),
    emotional: scoreEmotional(sample),
  };
  const instrumentSignal = scoreInstrumentSignal(sample, foodTypeSlug);
  const gates = buildOffNoteGates(sample, foodTypeSlug);
  const gatePenalty = gates.reduce((sum, gate) => sum + Math.abs(Math.min(0, gate.impact)), 0);
  const weightedBase = (
    dimensionScores.hedonic * normalizedWeights.hedonic +
    dimensionScores.texture * normalizedWeights.texture +
    dimensionScores.cata * normalizedWeights.cata +
    dimensionScores.emotional * normalizedWeights.emotional
  ) / Math.max(1, totalWeight);
  const baseScore = weightedBase * 0.86 + instrumentSignal * 0.14;
  const hardStop = gates.some(gate => gate.status === 'fail') ||
    sample.hedonic.overall < 3.8 ||
    dimensionScores.hedonic < 45;
  const issfScore = hardStop ? Math.min(baseScore - gatePenalty, 54) : baseScore - gatePenalty;
  const finalScore = clamp(issfScore);
  const confidenceScore = confidenceFromEvidence(sample, finalScore, gates);
  const prescriptions = buildPrescriptions(sample, dimensionScores, gates, foodTypeSlug);

  let decision: DecisionOutcome = 'TWEAK';
  if (hardStop || finalScore < stopThreshold) {
    decision = 'STOP';
  } else if (finalScore >= goThreshold && confidenceScore >= 72 && gates.every(gate => gate.status === 'pass')) {
    decision = 'GO';
  }

  const riskLevel: DecisionRisk = decision === 'STOP'
    ? 'high'
    : decision === 'TWEAK' || confidenceScore < 75
      ? 'medium'
      : 'low';
  const timeline = decision === 'GO' ? '1 week' : decision === 'STOP' ? '3-6 weeks' : '10-14 days';
  const recommendation = decision === 'GO'
    ? 'Advance with controlled scale-up. No hard sensory gates are open, and the evidence stack supports moving forward.'
    : decision === 'STOP'
      ? 'Do not advance this formula. A hard gate or quality floor failed, so the next move is fundamental reformulation.'
      : `Tweak before advancing. Highest leverage: ${prescriptions[0]?.target ?? 'focused formula optimization'}.`;

  const details = [
    `${METHOD_VERSION}: score ${finalScore.toFixed(1)}/100, confidence ${confidenceScore.toFixed(0)}%.`,
    `Hedonic ${dimensionScores.hedonic.toFixed(0)}, texture ${dimensionScores.texture.toFixed(0)}, CATA ${dimensionScores.cata.toFixed(0)}, emotional ${dimensionScores.emotional.toFixed(0)}.`,
    `Instrument signal ${instrumentSignal.toFixed(0)}; gate penalty ${gatePenalty.toFixed(0)}.`,
    ...gates.map(gate => `${gate.label}: ${gate.status.toUpperCase()} (${gate.detail})`),
  ];

  if (sample.trainedPanelReference) {
    const delta = Math.abs(finalScore - sample.trainedPanelReference.overallQuality);
    details.push(`Trained panel reference ${sample.trainedPanelReference.overallQuality}; delta ${delta.toFixed(1)}.`);
  }

  return {
    sampleId: sample.sampleId,
    sampleName: sample.sampleName,
    issfScore: finalScore,
    confidenceScore,
    decision,
    recommendation,
    costSavings: decision === 'GO' ? 33000 : decision === 'TWEAK' ? 28000 : 18000,
    timeline,
    riskLevel,
    details,
    dimensionScores,
    gates,
    prescriptions,
    decisionFingerprint: fingerprint(sample, finalScore, gates),
    methodVersion: METHOD_VERSION,
  };
}
