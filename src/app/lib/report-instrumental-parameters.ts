import type { InstrumentalDataset } from './database';
import {
  inferInstrumentalParameterMetadata,
  type InstrumentalChartPreference,
  type InstrumentalParameterMetadata,
} from './instrumental-parameter-metadata';
import type {
  InstrumentalParameterEvidence,
  InstrumentalParameterFamily,
  InstrumentalParameterStatus,
} from './report-evidence-types';

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'parameter';
}

function finite(value: number | undefined) {
  return Number.isFinite(value) ? value : undefined;
}

function parameterFamily(label: string): InstrumentalParameterFamily {
  const normalized = label.toLowerCase();
  if (/sour|bitter|salti|umami|sweet|taste|flavou?r/.test(normalized)) return 'taste_flavour';
  if (/texture|hardness|firmness|viscos|rheolog|elastic|adhes|cohes|spring|yield|fracture|chew|melt|spread/.test(normalized)) return 'texture_rheology';
  if (/protein|fat|moisture|water activity|\baw\b|\bph\b|salt|calcium|ash|carbo|fibre|fiber/.test(normalized)) return 'composition';
  if (/colou?r|lightness|chroma|hue|\bl\*|\ba\*|\bb\*/.test(normalized)) return 'colour_appearance';
  if (/aroma|odou?r|volatile|compound|peak area/.test(normalized)) return 'aroma_volatiles';
  if (/shelf|stability|separation|syneresis|oxid|storage|drift/.test(normalized)) return 'stability_shelf_life';
  if (/temperature|pressure|speed|time|flow|mix|process/.test(normalized)) return 'process';
  if (/microb|pathogen|yeast|mould|mold|colony|cfu|safety/.test(normalized)) return 'microbiology_safety';
  if (/density|mass|weight|volume|size|diameter|height|length|width/.test(normalized)) return 'physical';
  return 'other';
}

function rangeStatus(mean: number, metadata: InstrumentalParameterMetadata): InstrumentalParameterStatus {
  if (metadata.expectedMinimum !== undefined && mean < metadata.expectedMinimum) return 'below_expected_range';
  if (metadata.expectedMaximum !== undefined && mean > metadata.expectedMaximum) return 'above_expected_range';
  if (metadata.expectedMinimum !== undefined || metadata.expectedMaximum !== undefined) return 'within_expected_range';
  return 'not_benchmarked';
}

function makeParameter(input: {
  sampleId: string;
  sampleName: string;
  key: string;
  label: string;
  source: InstrumentalParameterEvidence['source'];
  unit: string;
  mean: number;
  observationCount: number;
  standardDeviation?: number;
  minimum?: number;
  maximum?: number;
  replicateValues?: number[];
  metadata?: InstrumentalParameterMetadata;
  chartPreference?: InstrumentalChartPreference;
}): InstrumentalParameterEvidence {
  const metadata = input.metadata ?? inferInstrumentalParameterMetadata({ label: input.label, unit: input.unit });
  return {
    id: `instrumental.${slug(input.sampleId)}.${slug(input.key)}`,
    sampleId: input.sampleId,
    sampleName: input.sampleName,
    key: input.key,
    label: input.label,
    family: parameterFamily(input.label),
    source: input.source,
    unit: input.unit,
    mean: input.mean,
    observationCount: Math.max(0, input.observationCount),
    ...(finite(input.standardDeviation) !== undefined ? { standardDeviation: input.standardDeviation } : {}),
    ...(finite(input.minimum) !== undefined ? { minimum: input.minimum } : {}),
    ...(finite(input.maximum) !== undefined ? { maximum: input.maximum } : {}),
    replicateValues: (input.replicateValues ?? []).filter(Number.isFinite),
    metadata,
    chartPreference: input.chartPreference ?? 'auto',
    status: rangeStatus(input.mean, metadata),
  };
}

/**
 * Normalizes every numeric measurement attached to a sample into one report
 * contract. Legacy E-tongue and composition fields remain supported, while
 * arbitrary imported parameters retain their own units and replicate detail.
 */
export function collectReportInstrumentalParameters(
  dataset: InstrumentalDataset | undefined,
  sampleId: string,
): InstrumentalParameterEvidence[] {
  const sample = dataset?.eTongueData.find(item => item.sampleId === sampleId);
  if (!sample) return [];
  const sampleName = sample.sampleName || sample.sampleId;
  const parameters = new Map<string, InstrumentalParameterEvidence>();

  if (sample.hasETongueData !== false) {
    const taste = [
      ['sourness', 'Sourness', sample.sourness],
      ['bitterness', 'Bitterness', sample.bitterness],
      ['saltiness', 'Saltiness', sample.saltiness],
      ['umami', 'Umami', sample.umami],
      ['sweetness', 'Sweetness', sample.sweetness],
    ] as const;
    taste.forEach(([key, label, mean]) => {
      if (!Number.isFinite(mean)) return;
      parameters.set(key, makeParameter({
        sampleId,
        sampleName,
        key,
        label,
        source: 'e_tongue',
        unit: '',
        mean,
        observationCount: 0,
      }));
    });
  }

  (sample.measurements ?? []).forEach(measurement => {
    if (!Number.isFinite(measurement.mean)) return;
    parameters.set(measurement.key, makeParameter({
      sampleId,
      sampleName,
      key: measurement.key,
      label: measurement.label,
      source: 'imported_parameter',
      unit: measurement.unit,
      mean: measurement.mean,
      observationCount: measurement.observationCount,
      standardDeviation: measurement.standardDeviation,
      minimum: measurement.minimum,
      maximum: measurement.maximum,
      replicateValues: measurement.replicateValues,
      metadata: measurement.metadata,
      chartPreference: measurement.chartPreference,
    }));
  });

  const composition = dataset?.compositionData[sampleId];
  if (composition) {
    const values = [
      ['protein', 'Protein', composition.protein, '%'],
      ['fat', 'Fat', composition.fat, '%'],
      ['moisture', 'Moisture', composition.moisture, '%'],
      ['ph', 'pH', composition.pH, ''],
      ['salt-content', 'Salt', composition.saltContent, '%'],
      ['calcium-mg', 'Calcium', composition.calciumMg, 'mg'],
    ] as const;
    values.forEach(([key, label, mean, unit]) => {
      // Prefer a generic imported measurement with the same key because it
      // carries richer replicate statistics than the legacy composition row.
      if (!Number.isFinite(mean) || parameters.has(key)) return;
      parameters.set(key, makeParameter({
        sampleId,
        sampleName,
        key,
        label,
        source: 'composition',
        unit,
        mean,
        observationCount: 0,
      }));
    });
  }

  return [...parameters.values()].sort((left, right) => (
    left.family.localeCompare(right.family) || left.label.localeCompare(right.label)
  ));
}
