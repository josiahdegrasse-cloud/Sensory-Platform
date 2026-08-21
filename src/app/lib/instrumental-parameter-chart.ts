import type {
  ETongueMeasurement,
  InstrumentalMeasurement,
} from '../components/stage1-instrumental-data';
import {
  inferInstrumentalParameterMetadata,
  isInstrumentalRangeBand,
  type InstrumentalChartPreference,
  type InstrumentalChartType,
  type InstrumentalParameterMetadata,
} from './instrumental-parameter-metadata';

export { isInstrumentalRangeBand } from './instrumental-parameter-metadata';

export interface InstrumentalParameterDefinition {
  key: string;
  label: string;
  unit: string;
  metadata: InstrumentalParameterMetadata;
  chartPreference: InstrumentalChartPreference;
}

export interface InstrumentalParameterValue {
  raw: number;
  deviationFromProjectMean: number | null;
  observationCount: number;
  standardDeviation: number | null;
  minimum: number | null;
  maximum: number | null;
  replicateValues: number[];
}

export type InstrumentalParameterScaleMethod = 'project-mean-deviation' | 'raw-only';
export type InstrumentalParameterChartKind = 'radar' | 'bar';

export interface InstrumentalChartRecommendation {
  primaryChart: Exclude<InstrumentalChartType, 'radar'> | 'radar';
  radarEligible: boolean;
  source: 'metadata' | 'value-pattern' | 'admin-override';
  reason: string;
}

export interface InstrumentalParameterScale {
  minimum: number;
  maximum: number;
  mean: number;
  sampleCount: number;
  hasVariation: boolean;
  method: InstrumentalParameterScaleMethod;
}

export interface InstrumentalParameterAxis extends InstrumentalParameterDefinition {
  scale: InstrumentalParameterScale;
  values: Record<string, InstrumentalParameterValue | null>;
}

export interface InstrumentalParameterRadarModel {
  axes: InstrumentalParameterAxis[];
  relationships: InstrumentalParameterRelationship[];
  projectSampleCount: number;
  samples: Array<{
    sampleId: string;
    name: string;
  }>;
}

export interface InstrumentalParameterRelationship {
  leftKey: string;
  rightKey: string;
  correlation: number;
  sampleCount: number;
}

export type InstrumentalBuildChartType = 'radar' | 'bar' | 'box';

function hasReplicateEvidence(axis: Pick<InstrumentalParameterAxis, 'values'>) {
  return Object.values(axis.values).some(value => (value?.replicateValues.length ?? 0) >= 4);
}

function radarCompatible(axis: Pick<InstrumentalParameterAxis, 'label' | 'scale' | 'metadata'>) {
  return !isInstrumentalRangeBand(axis.label)
    && axis.scale.method === 'project-mean-deviation'
    && (axis.metadata.dataType === 'continuous' || axis.metadata.dataType === 'proportion');
}

export function instrumentalAxisSupportsBuildChart(
  axis: Pick<InstrumentalParameterAxis, 'label' | 'scale' | 'metadata' | 'values'>,
  chart: InstrumentalBuildChartType,
) {
  if (chart === 'radar') return radarCompatible(axis);
  if (chart === 'box') return hasReplicateEvidence(axis);
  return true;
}

export function orderInstrumentalAxesByBuildAvailability(
  axes: InstrumentalParameterAxis[],
  charts: InstrumentalBuildChartType[],
) {
  return axes
    .map((axis, index) => ({
      axis,
      index,
      available: charts.some(chart => instrumentalAxisSupportsBuildChart(axis, chart)),
    }))
    .sort((left, right) => Number(right.available) - Number(left.available) || left.index - right.index)
    .map(item => item.axis);
}

function boxPlotInformationScore(axis: InstrumentalParameterAxis) {
  const distributions = Object.values(axis.values).flatMap(value => (
    value && value.replicateValues.length >= 4 ? [value] : []
  ));
  const coveredSamples = distributions.length;
  const replicateCount = distributions.reduce((total, value) => total + value.replicateValues.length, 0);
  const relativeSpread = distributions.reduce((total, value) => {
    const minimum = Math.min(...value.replicateValues);
    const maximum = Math.max(...value.replicateValues);
    return total + ((maximum - minimum) / Math.max(Math.abs(value.raw), 1));
  }, 0);
  return (coveredSamples * 10_000) + (replicateCount * 10) + relativeSpread;
}

export function selectRecommendedBoxPlotAxes(
  axes: InstrumentalParameterAxis[],
  limit = 4,
) {
  return [...axes]
    .filter(axis => hasReplicateEvidence(axis))
    .sort((left, right) => (
      boxPlotInformationScore(right) - boxPlotInformationScore(left)
      || left.label.localeCompare(right.label)
    ))
    .slice(0, Math.max(0, limit));
}

export function recommendInstrumentalChart(
  axis: Pick<InstrumentalParameterAxis, 'label' | 'scale' | 'metadata' | 'chartPreference' | 'values'>,
  preference: InstrumentalChartPreference = axis.chartPreference,
): InstrumentalChartRecommendation {
  const canUseRadar = radarCompatible(axis);
  const rangeBand = axis.metadata.dataType === 'range-band' || isInstrumentalRangeBand(axis.label);
  const replicateEvidence = hasReplicateEvidence(axis);
  const validOverride = preference === 'bar'
    || (preference === 'radar' && canUseRadar)
    || (preference === 'distribution' && rangeBand)
    || (preference === 'box' && replicateEvidence);

  if (preference !== 'auto' && validOverride) {
    return {
      primaryChart: preference,
      radarEligible: preference === 'radar',
      source: 'admin-override',
      reason: `An administrator selected the ${instrumentalChartTypeLabel(preference).toLocaleLowerCase()} for this parameter.`,
    };
  }
  if (rangeBand) {
    return {
      primaryChart: 'distribution',
      radarEligible: false,
      source: 'metadata',
      reason: 'Ordered measurement bands are grouped to show how each sample is distributed across the available ranges.',
    };
  }
  if (axis.scale.method === 'raw-only' || axis.metadata.scaleType === 'diverging') {
    return {
      primaryChart: 'bar',
      radarEligible: false,
      source: axis.metadata.scaleType === 'diverging' ? 'metadata' : 'value-pattern',
      reason: 'A zero-centred native scale preserves the direction and magnitude of signed values.',
    };
  }
  if (axis.metadata.dataType === 'count' || axis.metadata.dataType === 'ordinal') {
    return {
      primaryChart: 'bar',
      radarEligible: false,
      source: 'metadata',
      reason: 'Discrete counts and ordered scores are clearest when compared from a shared baseline.',
    };
  }
  if (replicateEvidence) {
    return {
      primaryChart: 'box',
      radarEligible: canUseRadar,
      source: 'metadata',
      reason: 'Replicate measurements are available, so the box plot shows spread, quartiles, and the median instead of hiding variation behind the mean.',
    };
  }
  return {
    primaryChart: 'radar',
    radarEligible: canUseRadar,
    source: axis.metadata.source === 'declared' ? 'metadata' : 'value-pattern',
    reason: 'Positive continuous measurements can be compared fairly after conversion to distance from the project average.',
  };
}

export function instrumentalChartTypeLabel(chart: InstrumentalChartPreference) {
  switch (chart) {
    case 'auto': return 'Recommended automatically';
    case 'radar': return 'Radar overview';
    case 'bar': return 'Direct bar';
    case 'distribution': return 'Distribution bars';
    case 'box': return 'Box plot';
  }
}

export function instrumentalParameterChartKind(
  axis: Pick<InstrumentalParameterAxis, 'label' | 'scale'> & Partial<Pick<InstrumentalParameterAxis, 'metadata' | 'chartPreference' | 'values'>>,
): InstrumentalParameterChartKind {
  const completeAxis = {
    ...axis,
    metadata: axis.metadata ?? inferInstrumentalParameterMetadata({ label: axis.label, unit: '' }),
    chartPreference: axis.chartPreference ?? 'auto',
    values: axis.values ?? {},
  };
  return recommendInstrumentalChart(completeAxis).radarEligible ? 'radar' : 'bar';
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
        metadata: measurement.metadata ?? inferInstrumentalParameterMetadata(measurement),
        chartPreference: measurement.chartPreference ?? 'auto',
      });
    }
  }));
  return [...definitions.values()];
}

function measurementByKey(sample: ETongueMeasurement, key: string) {
  return sample.measurements?.find(measurement => measurement.key === key) ?? null;
}

function buildParameterScale(observedValues: number[]): InstrumentalParameterScale {
  const minimum = Math.min(...observedValues);
  const maximum = Math.max(...observedValues);
  const hasVariation = minimum !== maximum;
  const mean = observedValues.reduce((total, value) => total + value, 0) / observedValues.length;
  const canUseProjectMeanDeviation = minimum >= 0 && mean > 0;
  return {
    minimum,
    maximum,
    mean,
    sampleCount: observedValues.length,
    hasVariation,
    method: canUseProjectMeanDeviation ? 'project-mean-deviation' : 'raw-only',
  };
}

function compareWithProjectMean(
  measurement: InstrumentalMeasurement,
  scale: InstrumentalParameterScale,
) {
  if (scale.method === 'raw-only') return null;
  return ((measurement.mean - scale.mean) / scale.mean) * 100;
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
      const scale = buildParameterScale(observedValues);

      const values = Object.fromEntries(activeSamples.map(sample => {
        const measurement = measurementByKey(sample, definition.key);
        return [sample.sampleId, measurement && Number.isFinite(measurement.mean) ? {
          raw: measurement.mean,
          deviationFromProjectMean: compareWithProjectMean(measurement, scale),
          observationCount: measurement.observationCount,
          standardDeviation: Number.isFinite(measurement.standardDeviation) ? measurement.standardDeviation! : null,
          minimum: Number.isFinite(measurement.minimum) ? measurement.minimum! : null,
          maximum: Number.isFinite(measurement.maximum) ? measurement.maximum! : null,
          replicateValues: measurement.replicateValues?.filter(Number.isFinite) ?? [],
        } : null];
      }));
      if (Object.values(values).every(value => value === null)) return [];
      return [{ ...definition, scale, values }];
    });

  const relationships = learnInstrumentalParameterRelationships(input.samples, axes.map(axis => axis.key));

  return {
    axes,
    relationships,
    projectSampleCount: input.samples.length,
    samples: activeSamples.map(sample => ({
      sampleId: sample.sampleId,
      name: sample.sampleName || sample.sampleId,
    })),
  };
}

export interface DistributionSummary {
  minimum: number;
  lowerQuartile: number;
  median: number;
  upperQuartile: number;
  maximum: number;
}

function quantile(sortedValues: number[], position: number) {
  const index = (sortedValues.length - 1) * position;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + ((sortedValues[upper] - sortedValues[lower]) * (index - lower));
}

export function summarizeInstrumentalDistribution(values: number[]): DistributionSummary | null {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) return null;
  return {
    minimum: finite[0],
    lowerQuartile: quantile(finite, 0.25),
    median: quantile(finite, 0.5),
    upperQuartile: quantile(finite, 0.75),
    maximum: finite[finite.length - 1],
  };
}

export function instrumentalPearsonCorrelation(points: Array<{ x: number; y: number }>) {
  const finite = points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (finite.length < 3) return null;
  const xMean = finite.reduce((sum, point) => sum + point.x, 0) / finite.length;
  const yMean = finite.reduce((sum, point) => sum + point.y, 0) / finite.length;
  const numerator = finite.reduce((sum, point) => sum + ((point.x - xMean) * (point.y - yMean)), 0);
  const xSpread = Math.sqrt(finite.reduce((sum, point) => sum + ((point.x - xMean) ** 2), 0));
  const ySpread = Math.sqrt(finite.reduce((sum, point) => sum + ((point.y - yMean) ** 2), 0));
  if (xSpread === 0 || ySpread === 0) return null;
  return numerator / (xSpread * ySpread);
}

export function learnInstrumentalParameterRelationships(
  samples: ETongueMeasurement[],
  parameterKeys = collectInstrumentalParameters(samples).map(parameter => parameter.key),
): InstrumentalParameterRelationship[] {
  const relationships: InstrumentalParameterRelationship[] = [];
  parameterKeys.forEach((leftKey, leftIndex) => {
    parameterKeys.slice(leftIndex + 1).forEach(rightKey => {
      const points = samples.flatMap(sample => {
        const left = measurementByKey(sample, leftKey)?.mean;
        const right = measurementByKey(sample, rightKey)?.mean;
        return Number.isFinite(left) && Number.isFinite(right) ? [{ x: left!, y: right! }] : [];
      });
      const correlation = instrumentalPearsonCorrelation(points);
      if (correlation === null) return;
      relationships.push({ leftKey, rightKey, correlation, sampleCount: points.length });
    });
  });
  return relationships.sort((left, right) => Math.abs(right.correlation) - Math.abs(left.correlation));
}

export function orderInstrumentalAxesByRelationships(
  axes: InstrumentalParameterAxis[],
  relationships: InstrumentalParameterRelationship[],
) {
  if (axes.length < 3 || relationships.length === 0) return axes;
  const remaining = new Map(axes.map(axis => [axis.key, axis]));
  const relationshipStrength = (leftKey: string, rightKey: string) => {
    const relationship = relationships.find(item => (
      (item.leftKey === leftKey && item.rightKey === rightKey)
      || (item.leftKey === rightKey && item.rightKey === leftKey)
    ));
    return relationship ? Math.abs(relationship.correlation) : -1;
  };
  const totalStrength = (key: string) => axes.reduce((total, axis) => (
    axis.key === key ? total : total + Math.max(0, relationshipStrength(key, axis.key))
  ), 0);
  const first = [...axes].sort((left, right) => totalStrength(right.key) - totalStrength(left.key))[0];
  const ordered = [first];
  remaining.delete(first.key);
  while (remaining.size > 0) {
    const previous = ordered[ordered.length - 1];
    const next = [...remaining.values()].sort((left, right) => (
      relationshipStrength(previous.key, right.key) - relationshipStrength(previous.key, left.key)
    ))[0];
    ordered.push(next);
    remaining.delete(next.key);
  }
  return ordered;
}
