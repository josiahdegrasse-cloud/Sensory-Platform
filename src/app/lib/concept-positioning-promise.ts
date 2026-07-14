import type { EnhancedSensoryProfile } from '../data/enhanced-sensory';
import { getFoodTypeProfile } from './food-intelligence';

interface EvidencePositioningPromiseInput {
  category: string;
  sourceSampleName: string;
  sensoryStrengths: string[];
  panelEvidence?: string[];
  instrumentEvidence?: string[];
  issfScore?: number | null;
  confidence?: number | null;
  decisionRationale?: string;
  watchouts?: string[];
}

function signalStem(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/(?:y|ic)$/, '');
}

function signalMatches(attribute: string, marker: string) {
  const attr = signalStem(attribute);
  const cue = signalStem(marker);
  return Boolean(attr && cue && (attr.includes(cue) || cue.includes(attr)));
}

function compactText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function compactList(items: string[], fallback: string, maxItems = 5) {
  const cleaned = items.map(compactText).filter(Boolean);
  if (cleaned.length === 0) return fallback;
  return cleaned.slice(0, maxItems).join(', ');
}

function compactRationale(value: string | undefined) {
  const cleaned = compactText(value ?? '');
  if (!cleaned) return '';
  return cleaned.length > 220 ? `${cleaned.slice(0, 217).trimEnd()}...` : cleaned;
}

function titleCaseSignal(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());
}

export function topSuccessfulPanelSignals(profile: EnhancedSensoryProfile, foodTypeSlug: string) {
  const foodProfile = getFoodTypeProfile(foodTypeSlug);
  return Object.entries(profile.cata)
    .filter(([attribute]) => foodProfile.successMarkers.some(marker => signalMatches(attribute, marker)))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([attribute]) => attribute);
}

export function strongestHedonicSignals(profile: EnhancedSensoryProfile) {
  return Object.entries(profile.hedonic)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([dimension, score]) => `${dimension} ${score.toFixed(1)}/9`);
}

export function buildPanelEvidenceSummary(profile: EnhancedSensoryProfile, foodTypeSlug?: string) {
  const panelN = profile.panelN && profile.panelN > 0 ? profile.panelN : 14;
  const cataEntries = Object.entries(profile.cata);
  const successMarkers = foodTypeSlug ? getFoodTypeProfile(foodTypeSlug).successMarkers : [];
  const successfulCataEntries = successMarkers.length > 0
    ? cataEntries.filter(([attribute]) => successMarkers.some(marker => signalMatches(attribute, marker)))
    : [];
  const cataEvidence = (successfulCataEntries.length > 0 ? successfulCataEntries : cataEntries)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([attribute, count]) => `${attribute} CATA ${count}/${panelN}`);
  const intensityEvidence = Object.entries(profile.intensity)
    .filter(([, value]) => Number.isFinite(value))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([attribute, value]) => `${titleCaseSignal(attribute)} intensity ${value.toFixed(1)}/10`);
  const hedonicEvidence = `hedonic overall ${profile.hedonic.overall.toFixed(1)}/9, flavour ${profile.hedonic.flavour.toFixed(1)}/9, texture ${profile.hedonic.texture.toFixed(1)}/9`;
  const emotionEvidence = `emotion balance positive ${profile.emotions.positive.toFixed(1)}/5 vs negative ${profile.emotions.negative.toFixed(1)}/5`;
  return [...cataEvidence, ...intensityEvidence, hedonicEvidence, emotionEvidence];
}

export function buildInstrumentEvidenceSummary(profile: EnhancedSensoryProfile) {
  const tasteEvidence = Object.entries(profile.taste)
    .filter(([, value]) => Number.isFinite(value))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([dimension, value]) => `${titleCaseSignal(dimension)} ${value.toFixed(1)}/10`)
    .join(', ');
  const hasCompositionEvidence = Object.values(profile.composition)
    .some(value => Number.isFinite(value) && value > 0);
  const compositionEvidence = hasCompositionEvidence
    ? `composition salt ${profile.composition.salt.toFixed(1)}%, fat ${profile.composition.fat.toFixed(1)}%, protein ${profile.composition.protein.toFixed(1)}%`
    : '';
  const aromaEvidence = profile.gcmsOlfactometry
    .filter(compound => !compound.isBlankArtefact)
    .sort((a, b) => b.odourIntensity - a.odourIntensity)
    .slice(0, 2)
    .map(compound => {
      const concentrationValue = typeof compound.concentration === 'number' && Number.isFinite(compound.concentration)
        ? compound.concentration
        : null;
      const thresholdValue = typeof compound.threshold === 'number' && Number.isFinite(compound.threshold) && compound.threshold > 0
        ? compound.threshold
        : null;
      const concentration = concentrationValue != null
        ? `, ${concentrationValue.toFixed(1)} ppm`
        : '';
      const threshold = concentrationValue != null && thresholdValue != null
        ? `, ${(concentrationValue / thresholdValue).toFixed(1)}x threshold`
        : '';
      return `${compound.compound} (${compound.odour}, GC-O ${compound.odourIntensity.toFixed(1)}/5${concentration}${threshold})`;
    })
    .join('; ');
  const qcEvidence = profile.istdRecovery != null
    ? `ISTD recovery ${profile.istdRecovery.toFixed(1)}%`
    : '';
  return [
    tasteEvidence ? `e-tongue ${tasteEvidence}` : '',
    compositionEvidence,
    aromaEvidence ? `GC-MS/O ${aromaEvidence}` : '',
    qcEvidence,
  ].filter(Boolean);
}

export function buildEvidencePositioningPromise({
  category,
  sourceSampleName,
  sensoryStrengths,
  panelEvidence = [],
  instrumentEvidence = [],
  issfScore,
  confidence,
  decisionRationale,
  watchouts = [],
}: EvidencePositioningPromiseInput) {
  const categoryLabel = compactText(category || 'food');
  const categoryLower = categoryLabel.toLowerCase();
  const sourceName = compactText(sourceSampleName || 'the validated sample');
  const strengths = compactList(
    sensoryStrengths,
    `the strongest ${categoryLower} sensory cues`,
  );
  const evidenceParts = [
    Number.isFinite(issfScore) ? `ISSF ${Number(issfScore).toFixed(0)}/100` : '',
    Number.isFinite(confidence) ? `${Number(confidence).toFixed(0)}% confidence` : '',
  ].filter(Boolean);
  const rationale = compactRationale(decisionRationale);
  const panelEvidenceCopy = compactList(panelEvidence, '', 6);
  const instrumentEvidenceCopy = compactList(instrumentEvidence, '');
  const watchoutCopy = compactList(watchouts, '');

  return [
    `A market-facing ${categoryLower} concept built from the validated "${sourceName}" GO sample, positioned around sensory cues panelists already responded to: ${strengths}.`,
    panelEvidenceCopy ? `Panel evidence behind the direction: ${panelEvidenceCopy}.` : '',
    instrumentEvidenceCopy ? `Instrument evidence to preserve in the creative brief: ${instrumentEvidenceCopy}.` : '',
    `The concept should make the product feel immediately recognizable in the ${categoryLower} category while leading with appetite appeal, believable usage, and the strongest validated cues rather than unsupported claims.`,
    evidenceParts.length > 0 ? `Evidence context: ${evidenceParts.join(' at ')}.` : '',
    rationale ? `Decision rationale to carry into the brief: ${rationale}` : '',
    watchoutCopy ? `Keep these as internal watch-outs while developing visuals and survey copy: ${watchoutCopy}.` : '',
  ].filter(Boolean).join(' ');
}
