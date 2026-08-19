import type {
  ETongueMeasurement,
  InstrumentalMeasurement,
} from '../components/stage1-instrumental-data';

export interface InstrumentalParameterDefinition {
  key: string;
  label: string;
  unit: string;
}

export interface InstrumentalParameterValue {
  raw: number;
  normalized: number;
  observationCount: number;
}

export interface InstrumentalParameterAxis extends InstrumentalParameterDefinition {
  values: Record<string, InstrumentalParameterValue | null>;
}

export interface InstrumentalParameterRadarModel {
  axes: InstrumentalParameterAxis[];
  samples: Array<{
    sampleId: string;
    name: string;
  }>;
}

export function collectInstrumentalParameters(
  samples: ETongueMeasurement[],
): InstrumentalParameterDefinition[] {
  const definitions = new Map<string, InstrumentalParameterDefinition>();
  samples.forEach(sample => sample.measurements?.forEach(measurement => {
    if (!definitions.has(measurement.key)) {
      definitions.set(measurement.key, {
        key: measurement.key,
        label: measurement.label,
        unit: measurement.unit,
      });
    }
  }));
  return [...definitions.values()];
}

function measurementByKey(sample: ETongueMeasurement, key: string) {
  return sample.measurements?.find(measurement => measurement.key === key) ?? null;
}

function normalizeAgainstObservedRange(
  measurement: InstrumentalMeasurement,
  observedValues: number[],
) {
  const minimum = Math.min(...observedValues);
  const maximum = Math.max(...observedValues);
  if (minimum === maximum) return measurement.mean === 0 ? 0 : 100;

  // Positive laboratory measures have a meaningful zero. Measurements that
  // cross below zero use their observed minimum so every radar radius remains
  // valid without discarding the sign of the imported result.
  const baseline = minimum >= 0 ? 0 : minimum;
  const normalized = ((measurement.mean - baseline) / (maximum - baseline)) * 100;
  return Math.max(0, Math.min(100, normalized));
}

export function buildInstrumentalParameterRadarModel(input: {
  samples: ETongueMeasurement[];
  selectedSampleIds: string[];
  selectedParameterKeys: string[];
}): InstrumentalParameterRadarModel {
  const definitions = collectInstrumentalParameters(input.samples);
  const selectedKeys = new Set(input.selectedParameterKeys);
  const activeSamples = input.selectedSampleIds.flatMap(sampleId => {
    const sample = input.samples.find(candidate => candidate.sampleId === sampleId);
    return sample ? [sample] : [];
  });

  const axes = definitions
    .filter(definition => selectedKeys.has(definition.key))
    .flatMap(definition => {
      const observedValues = input.samples
        .map(sample => measurementByKey(sample, definition.key)?.mean)
        .filter((value): value is number => value !== undefined && Number.isFinite(value));
      if (observedValues.length === 0) return [];

      const values = Object.fromEntries(activeSamples.map(sample => {
        const measurement = measurementByKey(sample, definition.key);
        return [sample.sampleId, measurement ? {
          raw: measurement.mean,
          normalized: normalizeAgainstObservedRange(measurement, observedValues),
          observationCount: measurement.observationCount,
        } : null];
      }));
      if (Object.values(values).every(value => value === null)) return [];
      return [{ ...definition, values }];
    });

  return {
    axes,
    samples: activeSamples.map(sample => ({
      sampleId: sample.sampleId,
      name: sample.sampleName || sample.sampleId,
    })),
  };
}
