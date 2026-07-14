import type { EnhancedSensoryProfile } from '../data/enhanced-sensory';
import { getFoodTypeProfile } from '../lib/food-intelligence';

export type DecisionOutcome = 'GO' | 'TWEAK' | 'STOP';
export type DecisionRisk = 'low' | 'medium' | 'high';
export type DecisionStatus = 'ready' | 'hold';

export interface DecisionWeights {
  hedonic: number;
  texture: number;
  cata: number;
  emotional: number;
}

export interface DecisionGate {
  id: string;
  label: string;
  /**
   * `not_measured` = the evidence behind this gate was never collected for
   * this study (e.g. panel-only run with no GC-MS / instrument QC). It is
   * honest absence: it never blocks a GO the way fail/watch do, but it is
   * surfaced as an explicit caveat instead of masquerading as a pass.
   */
  status: 'pass' | 'watch' | 'fail' | 'not_measured';
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
  decisionStatus?: DecisionStatus;
  blockingReasons?: string[];
  recommendation: string;
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
 *  • PANEL_N — nominal fallback panel size for CATA normalization when a
 *    profile does not carry its real respondent count (`sample.panelN`).
 *    Matches RESEARCH_PANEL_N for the simulated reference panel (n=14).
 *  • DEFECT_WORDS / BENEFIT_WORDS — generic CATA lexicon markers, extended per
 *    food type by getFoodTypeProfile(). Matching is substring-based, so terms
 *    like "sour" also hit "sourdough" — food-type risk/success markers exist
 *    to counterbalance this for category-appropriate descriptors.
 *  • Default thresholds (GO ≥ 75, STOP < 45) — aligned with workspace defaults;
 *    overridable per workspace via decision settings.
 *  • Base blend (0.86 panel / 0.14 instrument) — panel perception dominates;
 *    the instrument signal nudges rather than decides.
 *  • Hard-stop floors (hedonic overall < 3.8/9, hedonic dimension < 45/100,
 *    any failed gate) — quality floors that cannot be averaged away.
 *  • Gate penalties (off-note −22/−9, QC −12/−5) and ISTD recovery bands
 *    (85–110% pass, 75–85% watch, <75% fail) — instrument QC discipline.
 *
 * NFI-GST-2.1 (this version) builds on 2.0:
 *  • Texture is scored over the cues the study actually MEASURED; descriptor
 *    coverage feeds the confidence score instead of zero-filling the texture
 *    score (the old "completeness penalty"). With no texture descriptors at
 *    all, the 9-pt hedonic texture liking stands in as the only evidence.
 *  • CATA normalizes by the real respondent count (`sample.panelN`), falling
 *    back to PANEL_N only for reference profiles.
 *  • `istdRecovery: null` and an empty GC-MS table produce `not_measured`
 *    gates instead of silent passes; a GO issued with unmeasured gates carries
 *    an explicit caveat. Imported profiles carry an evidence manifest so
 *    placeholders never count as measured values; QC failures create a hold;
 *    category-positive aromas do not become defects solely from detectability.
 */
const METHOD_VERSION = 'NFI-GST-2.1';
/** Nominal panel size used to normalize CATA citation counts. */
export const PANEL_N = 14;
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
  const text = ` ${normalizeText(value)} `;
  return words.some(word => {
    const normalizedWord = normalizeText(word);
    return normalizedWord.length > 0 && text.includes(` ${normalizedWord} `);
  });
}

const CATEGORY_AROMA_BENEFITS: Record<string, string[]> = {
  bread: ['acetic acid', 'vinegar', 'sour', 'fermented', 'yeasty', 'malty', 'toasted', 'fresh baked'],
  cheese: ['lactic acid', 'fermented', 'cheesy', 'buttery', 'nutty', 'tangy'],
  yogurt: ['lactic acid', 'fermented', 'tangy', 'sour', 'milky', 'creamy'],
  beverage: ['fermented', 'fruity', 'floral', 'citrus'],
};

function isTasteMeasured(sample: EnhancedSensoryProfile, key: keyof EnhancedSensoryProfile['taste']) {
  return !sample.evidence || sample.evidence.measuredTaste.includes(key);
}

function hasMeasuredComposition(sample: EnhancedSensoryProfile) {
  return !sample.evidence || sample.evidence.compositionMeasured;
}

function weightedMean(parts: Array<{ score: number; weight: number }>) {
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight <= 0) return 0;
  return parts.reduce((sum, part) => sum + part.score * part.weight, 0) / totalWeight;
}

function confidenceFromEvidence(
  sample: EnhancedSensoryProfile,
  score: number,
  gates: DecisionGate[],
  foodTypeSlug: string,
) {
  if (sample.evidence?.provenance === 'imported') {
    const panelN = sample.panelN && sample.panelN > 0 ? sample.panelN : 0;
    const measuredHedonic = sample.evidence.measuredHedonic.length / 4;
    const coverage = textureCoverage(sample, foodTypeSlug);
    const gatePenalty = gates.filter(gate => gate.status === 'fail').length * 8 +
      gates.filter(gate => gate.status === 'watch').length * 3;
    return clamp(weightedMean([
      { score: clamp(45 + Math.min(panelN, 40) / 40 * 55), weight: 30 },
      { score: 40 + measuredHedonic * 60, weight: 25 },
      { score: Object.keys(sample.cata).length > 0 ? 84 : 35, weight: 15 },
      { score: 45 + coverage * 55, weight: 15 },
      { score: sample.evidence.aromaMethod === 'not_measured' ? 45 : 82, weight: 10 },
      { score: sample.evidence.compositionMeasured ? 90 : 50, weight: 5 },
    ]) - gatePenalty, 25, 95);
  }

  // Instrument QC: a real recovery measurement scores by band; a study with
  // no instrument QC (istdRecovery null) contributes a low-weight neutral
  // term — absence of QC is unknown risk, neither a pass boost nor a failure.
  const qcTerm = sample.istdRecovery == null
    ? { score: 75, weight: 10 }
    : (() => {
        const qc = clamp(sample.istdRecovery, 0, 110);
        return { score: qc >= 85 && qc <= 110 ? 96 : qc >= 75 ? 82 : 62, weight: 20 };
      })();
  const trainedReferenceScore = sample.trainedPanelReference
    ? clamp(100 - Math.abs(score - sample.trainedPanelReference.overallQuality) * 1.2)
    : 78;
  // Descriptor coverage: texture evidence completeness lowers confidence
  // (never the texture score itself). Full coverage → 100, none → 55.
  const coverage = textureCoverage(sample, foodTypeSlug);
  const gatePenalty = gates.filter(gate => gate.status === 'fail').length * 8 +
    gates.filter(gate => gate.status === 'watch').length * 3;
  return clamp(weightedMean([
    { score: trainedReferenceScore, weight: sample.trainedPanelReference ? 45 : 20 },
    qcTerm,
    { score: sample.gcmsOlfactometry.length > 0 ? 92 : 70, weight: 20 },
    { score: Object.keys(sample.cata).length > 0 ? 88 : 65, weight: 15 },
    { score: 55 + coverage * 45, weight: 10 },
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

/**
 * Fraction (0..1) of the food type's expected positive texture cues that the
 * study actually measured. Exposed so confidence and report narratives can
 * report descriptor coverage; the texture SCORE itself only uses measured cues.
 */
export function textureCoverage(sample: EnhancedSensoryProfile, foodTypeSlug: string) {
  const positiveKeys = positiveTextureCues(foodTypeSlug);
  const measured = positiveKeys.filter(key => Number.isFinite(sample.intensity[key]));
  return positiveKeys.length > 0 ? measured.length / positiveKeys.length : 0;
}

function scoreTexture(sample: EnhancedSensoryProfile, foodTypeSlug: string) {
  const intensity = sample.intensity;
  const positiveKeys = positiveTextureCues(foodTypeSlug);
  // Score only what the study measured. Unmeasured cues are missing evidence
  // (reflected in confidence via textureCoverage), not measured zeros.
  const measuredPositive = positiveKeys.filter(key => Number.isFinite(intensity[key]));
  const measuredNegative = NEGATIVE_TEXTURE_KEYS.filter(key => Number.isFinite(intensity[key]));
  if (measuredPositive.length === 0) {
    // No texture descriptors at all: the 9-pt hedonic texture liking is the
    // only texture evidence available. Coverage 0 pulls confidence down.
    return clamp((safeScore(sample.hedonic.texture, 5) / 9) * 100);
  }
  const positive = measuredPositive.reduce((sum, key) => sum + safeScore(intensity[key]), 0) / measuredPositive.length;
  const negative = measuredNegative.length > 0
    ? measuredNegative.reduce((sum, key) => sum + safeScore(intensity[key]), 0) / measuredNegative.length
    : 0;
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
  // Normalize by the study's real respondent count so a 50-person panel and
  // an 8-person panel produce comparable citation rates. PANEL_N is only the
  // fallback for reference profiles that predate panelN.
  const panelN = sample.panelN && sample.panelN > 0 ? sample.panelN : PANEL_N;
  const positiveScore = clamp((positiveCount / (panelN * 4)) * 100);
  const defectPenalty = clamp((riskCount / (panelN * 3)) * 70);
  return clamp(positiveScore - defectPenalty + 20);
}

function scoreEmotional(sample: EnhancedSensoryProfile) {
  return clamp(((sample.emotions.positive - sample.emotions.negative + 5) / 10) * 100);
}

function scoreInstrumentSignal(sample: EnhancedSensoryProfile, foodTypeSlug: string) {
  const taste = sample.taste;
  const measured = (key: keyof EnhancedSensoryProfile['taste']) =>
    isTasteMeasured(sample, key) ? safeScore(taste[key]) : 0;
  const bitternessPenalty = measured('bitterness') + measured('bitternessAftertaste');
  const astringencyPenalty = measured('astringency') + measured('astringencyAftertaste');
  const balance = foodTypeSlug === 'meat'
    ? measured('umami') * 1.8 + measured('richness') * 1.2 + measured('saltiness') * 0.7
    : foodTypeSlug === 'bread'
      ? measured('sweetness') * 1.2 + measured('saltiness') * 0.8 - measured('sourness') * 0.5
      : measured('umami') + measured('richness') + measured('saltiness') * 0.6;
  const compositionBonus = !hasMeasuredComposition(sample)
    ? 0
    : foodTypeSlug === 'meat'
      ? safeScore(sample.composition.protein) >= 15 ? 6 : 0
      : foodTypeSlug === 'bread'
        ? sample.composition.starchDryMatter >= 35 ? 6 : 0
        : sample.composition.fat >= 20 ? 6 : 0;
  return clamp(58 + balance * 4 + compositionBonus - bitternessPenalty * 3.2 - astringencyPenalty * 2.6);
}

function buildOffNoteGates(sample: EnhancedSensoryProfile, foodTypeSlug: string): DecisionGate[] {
  const profile = getFoodTypeProfile(foodTypeSlug);
  const riskWords = [...profile.riskMarkers, ...DEFECT_WORDS];
  const benefitWords = [
    ...profile.successMarkers,
    ...BENEFIT_WORDS,
    ...(CATEGORY_AROMA_BENEFITS[foodTypeSlug] ?? []),
  ];
  const aromaScreened = sample.gcmsOlfactometry.length > 0 && sample.evidence?.aromaMethod !== 'not_measured';
  const riskCompounds = sample.gcmsOlfactometry
    .filter(compound => !compound.isBlankArtefact)
    .map(compound => {
      const thresholdRatio = compound.threshold && compound.threshold > 0 && compound.concentration
        ? compound.concentration / compound.threshold
        : 0;
      const compoundText = `${compound.compound} ${compound.odour}`;
      const matchesBenefit = includesAny(compoundText, benefitWords);
      const matchesRisk = includesAny(compoundText, riskWords) && !matchesBenefit;
      const severity = Math.max(compound.odourIntensity / 5, thresholdRatio);
      return { compound, thresholdRatio, matchesRisk, severity };
    })
    .filter(item => item.matchesRisk);

  const hasMeasuredOlfactometry = !sample.evidence || sample.evidence.aromaMethod === 'gc-o';
  // A concentration above an odour threshold proves detectability, not defect
  // severity. GC-MS-only imports can therefore open a review gate, while a
  // hard product STOP requires measured GC-O intensity.
  const critical = riskCompounds.filter(item =>
    hasMeasuredOlfactometry && item.compound.odourIntensity >= 4
  );
  const moderate = riskCompounds.filter(item =>
    hasMeasuredOlfactometry
      ? item.compound.odourIntensity >= 3
      : item.thresholdRatio >= 1
  );
  const worst = [...riskCompounds].sort((a, b) => b.severity - a.severity)[0];
  const gates: DecisionGate[] = [];

  gates.push({
    id: 'off-note',
    label: 'Off-note barrier',
    status: !aromaScreened
      ? 'not_measured'
      : critical.length > 0 ? 'fail' : moderate.length > 0 ? 'watch' : 'pass',
    detail: !aromaScreened
      ? 'Aroma screening (GC-MS / olfactometry) was not performed for this study.'
      : worst
        ? `${worst.compound.compound}: ${worst.compound.odour}, intensity ${worst.compound.odourIntensity.toFixed(1)}/5${worst.thresholdRatio ? `, ${worst.thresholdRatio.toFixed(1)}x threshold` : ''}`
        : 'No risk aroma above decision threshold.',
    impact: critical.length > 0 ? -22 : moderate.length > 0 ? -9 : 0,
  });

  gates.push({
    id: 'qc',
    label: 'Instrument QC',
    status: sample.istdRecovery == null
      ? 'not_measured'
      : sample.istdRecovery < 75 || sample.istdRecovery > 115
        ? 'fail'
        : sample.istdRecovery < 85 || sample.istdRecovery > 110 ? 'watch' : 'pass',
    detail: sample.istdRecovery == null
      ? 'No instrument QC data for this study.'
      : `ISTD recovery ${sample.istdRecovery.toFixed(1)}%.`,
    impact: sample.istdRecovery == null
      ? 0
      : sample.istdRecovery < 75 || sample.istdRecovery > 115
        ? 0
        : sample.istdRecovery < 85 || sample.istdRecovery > 110 ? -5 : 0,
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
  const failedOffNote = gates.find(gate =>
    gate.id === 'off-note' && (gate.status === 'fail' || gate.status === 'watch')
  );
  if (failedOffNote) {
    prescriptions.push({
      priority: 1,
      target: 'Aroma balance control',
      action: `Reduce or rebalance ${failedOffNote.detail} below the defect threshold while preserving category character. Re-test GC-O before running another panel.`,
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
      target: 'Category / lexicon fit',
      action: 'First confirm whether the weak category signal is formulation-, benchmark-, or lexicon-driven. Then increase category-positive descriptors and suppress verified defect cues in a controlled retest.',
      expectedLift: clamp((65 - dimensionScores.cata) * 0.16, 3, 10),
    });
  }

  return prescriptions
    .sort((a, b) => b.expectedLift - a.expectedLift)
    .map((item, index) => ({ ...item, priority: index + 1 }))
    .slice(0, 3);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown) {
  const raw = stableStringify(value);
  let primary = 2166136261;
  let secondary = 2246822519;
  for (let i = 0; i < raw.length; i++) {
    primary = Math.imul(primary ^ raw.charCodeAt(i), 16777619);
    secondary = Math.imul(secondary ^ raw.charCodeAt(i), 3266489917);
  }
  return [primary, secondary]
    .map(hash => (hash >>> 0).toString(16).toUpperCase().padStart(8, '0'))
    .join('');
}

export function calculateGoStopTweakDecision(
  sample: EnhancedSensoryProfile,
  weights: DecisionWeights,
  foodTypeSlug: string,
  thresholds: { go: number; stop: number } = { go: 75, stop: 45 },
): GoStopTweakDecision {
  const stopThreshold = clamp(thresholds.stop, 0, 99);
  const goThreshold = clamp(Math.max(stopThreshold + 1, thresholds.go), 1, 100);
  // ?? (not ||) so a workspace can legitimately zero out a single dimension.
  // All-zero weights are a configuration error, not a preference — fall back
  // to the method defaults rather than scoring on nothing.
  const requestedWeights = {
    hedonic: Math.max(0, safeScore(weights.hedonic, 30)),
    texture: Math.max(0, safeScore(weights.texture, 25)),
    cata: Math.max(0, safeScore(weights.cata, 25)),
    emotional: Math.max(0, safeScore(weights.emotional, 15)),
  };
  const requestedTotal = Object.values(requestedWeights).reduce((sum, value) => sum + value, 0);
  const normalizedWeights = requestedTotal > 0
    ? requestedWeights
    : { hedonic: 30, texture: 25, cata: 25, emotional: 15 };
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
  // Product failures can force STOP. Instrument QC failures invalidate the
  // evidence and place the decision on hold; they do not prove product failure.
  const hardStop = gates.some(gate => gate.id === 'off-note' && gate.status === 'fail') ||
    sample.hedonic.overall < 3.8 ||
    dimensionScores.hedonic < 45;
  const issfScore = hardStop ? Math.min(baseScore - gatePenalty, 54) : baseScore - gatePenalty;
  const finalScore = clamp(issfScore);
  const confidenceScore = confidenceFromEvidence(sample, finalScore, gates, foodTypeSlug);
  const prescriptions = buildPrescriptions(sample, dimensionScores, gates, foodTypeSlug);
  const unmeasuredGates = gates.filter(gate => gate.status === 'not_measured');
  const failedGate = gates.find(gate => gate.status === 'fail');
  const scoreBand = finalScore < stopThreshold ? 'STOP' : finalScore >= goThreshold ? 'GO' : 'TWEAK';
  const missingHedonic = sample.evidence?.provenance === 'imported'
    ? (['appearance', 'flavour', 'texture', 'overall'] as const)
        .filter(key => !sample.evidence?.measuredHedonic.includes(key))
    : [];
  const qcFailure = gates.find(gate => gate.id === 'qc' && gate.status === 'fail');
  const blockingReasons = [
    missingHedonic.length > 0
      ? `Missing required hedonic measures: ${missingHedonic.join(', ')}.`
      : null,
    qcFailure ? `${qcFailure.label} failed: ${qcFailure.detail}` : null,
  ].filter((reason): reason is string => Boolean(reason));
  const decisionStatus: DecisionStatus = blockingReasons.length > 0 ? 'hold' : 'ready';

  let decision: DecisionOutcome = 'TWEAK';
  if (decisionStatus === 'hold') {
    decision = 'TWEAK';
  } else if (hardStop || finalScore < stopThreshold) {
    decision = 'STOP';
  } else if (
    finalScore >= goThreshold &&
    confidenceScore >= 72 &&
    // not_measured never blocks a GO (absence of evidence is not a defect),
    // but fail/watch always do. Unmeasured gates surface as an explicit caveat.
    gates.every(gate => gate.status !== 'fail' && gate.status !== 'watch')
  ) {
    decision = 'GO';
  }

  const riskLevel: DecisionRisk = decision === 'STOP'
    ? 'high'
    : decision === 'TWEAK' || confidenceScore < 75
      ? 'medium'
      : 'low';
  const unmeasuredCaveat = unmeasuredGates.length > 0
    ? ` Note: ${unmeasuredGates.map(gate => gate.label.toLowerCase()).join(' and ')} evidence was not collected for this study, so this call rests on panel evidence alone.`
    : '';
  const recommendation = decision === 'GO'
    ? `Advance with controlled scale-up. No measured sensory gate is open, and the evidence stack supports moving forward.${unmeasuredCaveat}`
    : decisionStatus === 'hold'
      ? `Hold the decision until the evidence is valid. ${blockingReasons.join(' ')}`
      : decision === 'STOP'
      ? hardStop && scoreBand !== 'STOP'
        ? `Do not advance to GO yet. The ISSF score sits in the ${scoreBand} band, but ${failedGate ? `${failedGate.label.toLowerCase()} triggered a hard STOP gate: ${failedGate.detail}` : 'a quality floor triggered a hard STOP gate'}. Confirm the blocker, correct it, and retest before another decision.`
        : 'Do not advance this formula. The ISSF score or a hard quality floor is below the STOP requirement, so the next move is fundamental reformulation.'
      : `Tweak before advancing. Measured blocker: ${prescriptions[0]?.target ?? 'focused formula optimization'}. Treat formulation mechanisms as hypotheses until a control or benchmark diagnostic links them to the failing signal.${unmeasuredCaveat}`;

  const gateStatusLabel = (status: DecisionGate['status']) => status.replace('_', ' ').toUpperCase();
  const details = [
    `${METHOD_VERSION}: score ${finalScore.toFixed(1)}/100, evidence strength ${confidenceScore.toFixed(0)}%.`,
    `Decision readiness ${decisionStatus.toUpperCase()}.`,
    `Decision zone ${scoreBand}; final outcome ${decision}${decision === 'STOP' && hardStop && scoreBand !== 'STOP' ? ' because a hard gate overrides the score band' : ''}.`,
    `Hedonic ${dimensionScores.hedonic.toFixed(0)}, texture ${dimensionScores.texture.toFixed(0)}, CATA ${dimensionScores.cata.toFixed(0)}, emotional ${dimensionScores.emotional.toFixed(0)}.`,
    `Instrument signal ${instrumentSignal.toFixed(0)}; gate penalty ${gatePenalty.toFixed(0)}.`,
    ...gates.map(gate => `${gate.label}: ${gateStatusLabel(gate.status)} (${gate.detail})`),
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
    decisionStatus,
    blockingReasons,
    recommendation,
    riskLevel,
    details,
    dimensionScores,
    gates,
    prescriptions,
    decisionFingerprint: fingerprint({
      methodVersion: METHOD_VERSION,
      sample,
      foodTypeSlug,
      thresholds: { go: goThreshold, stop: stopThreshold },
      weights: normalizedWeights,
      dimensionScores,
      instrumentSignal,
      gates,
      finalScore,
      confidenceScore,
      decision,
      decisionStatus,
    }),
    methodVersion: METHOD_VERSION,
  };
}
