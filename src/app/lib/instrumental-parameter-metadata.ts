export type InstrumentalDataType = 'continuous' | 'count' | 'proportion' | 'ordinal' | 'range-band';
export type InstrumentalScaleType = 'ratio' | 'interval' | 'diverging' | 'bounded';
export type InstrumentalDirection = 'higher' | 'lower' | 'neutral';
export type InstrumentalChartType = 'radar' | 'bar' | 'distribution' | 'box';
export type InstrumentalChartPreference = 'auto' | InstrumentalChartType;

export interface InstrumentalParameterMetadata {
  dataType: InstrumentalDataType;
  scaleType: InstrumentalScaleType;
  zeroMeaningful: boolean;
  direction: InstrumentalDirection;
  expectedMinimum?: number;
  expectedMaximum?: number;
  source: 'declared' | 'inferred';
}

const RANGE_UNIT = '(?:mm|cm|m|µm|um|g|kg|mg|ml|l|s|sec|secs|seconds?|%|°c|c)?';
const BOUNDED_RANGE_PATTERN = new RegExp(
  `\\d+(?:[.,]\\d+)?\\s*${RANGE_UNIT}\\s*(?:-|–|—|to)\\s*\\d+(?:[.,]\\d+)?\\s*${RANGE_UNIT}`,
  'i',
);
const OPEN_RANGE_PATTERN = new RegExp(
  `(?:≤|≥|<|>|up\\s+to|under|over|less\\s+than|more\\s+than)\\s*\\d+(?:[.,]\\d+)?\\s*${RANGE_UNIT}`,
  'i',
);

const DATA_TYPES = new Set<InstrumentalDataType>(['continuous', 'count', 'proportion', 'ordinal', 'range-band']);
const SCALE_TYPES = new Set<InstrumentalScaleType>(['ratio', 'interval', 'diverging', 'bounded']);
const DIRECTIONS = new Set<InstrumentalDirection>(['higher', 'lower', 'neutral']);
const CHART_PREFERENCES = new Set<InstrumentalChartPreference>(['auto', 'radar', 'bar', 'distribution', 'box']);

export function isInstrumentalRangeBand(label: string) {
  return BOUNDED_RANGE_PATTERN.test(label) || OPEN_RANGE_PATTERN.test(label);
}

export function inferInstrumentalParameterMetadata(input: {
  label: string;
  unit: string;
}): InstrumentalParameterMetadata {
  const label = input.label.trim().toLocaleLowerCase();
  const unit = input.unit.trim().toLocaleLowerCase();
  const rangeBand = isInstrumentalRangeBand(label);
  const countLike = /^(?:n|count|counts|responses?|frequency|occurrences?)$/.test(unit)
    || /(?:^|\b)(?:count|responses?|frequency|occurrences?)(?:\b|$)/.test(label);
  const ordinalLike = /(?:^|\b)(?:rating|score|rank|likert|grade)(?:\b|$)/.test(label);
  const proportionLike = unit === '%' || /(?:^|\b)(?:percentage|proportion|share)(?:\b|$)/.test(label);
  const divergingLike = /(?:^|\b)(?:adhesiveness|delta|change|difference|deviation|offset|net)(?:\b|$)/.test(label);
  const phLike = label === 'ph' || /(?:^|\b)ph(?:\b|$)/.test(label);

  if (rangeBand) {
    return {
      dataType: 'range-band',
      scaleType: 'bounded',
      zeroMeaningful: true,
      direction: 'neutral',
      expectedMinimum: 0,
      source: 'inferred',
    };
  }
  if (countLike) {
    return {
      dataType: 'count',
      scaleType: 'ratio',
      zeroMeaningful: true,
      direction: 'neutral',
      expectedMinimum: 0,
      source: 'inferred',
    };
  }
  if (ordinalLike) {
    return {
      dataType: 'ordinal',
      scaleType: 'bounded',
      zeroMeaningful: false,
      direction: 'neutral',
      source: 'inferred',
    };
  }
  if (proportionLike) {
    return {
      dataType: 'proportion',
      scaleType: 'bounded',
      zeroMeaningful: true,
      direction: 'neutral',
      expectedMinimum: 0,
      expectedMaximum: 100,
      source: 'inferred',
    };
  }
  if (phLike) {
    return {
      dataType: 'continuous',
      scaleType: 'bounded',
      zeroMeaningful: false,
      direction: 'neutral',
      expectedMinimum: 0,
      expectedMaximum: 14,
      source: 'inferred',
    };
  }
  return {
    dataType: 'continuous',
    scaleType: divergingLike ? 'diverging' : 'ratio',
    zeroMeaningful: !divergingLike,
    direction: 'neutral',
    ...(divergingLike ? {} : { expectedMinimum: 0 }),
    source: 'inferred',
  };
}

export function parseInstrumentalParameterMetadata(
  value: unknown,
  fallback: InstrumentalParameterMetadata,
): InstrumentalParameterMetadata {
  if (!value || typeof value !== 'object') return fallback;
  const record = value as Record<string, unknown>;
  const dataType = DATA_TYPES.has(record.dataType as InstrumentalDataType)
    ? record.dataType as InstrumentalDataType
    : fallback.dataType;
  const scaleType = SCALE_TYPES.has(record.scaleType as InstrumentalScaleType)
    ? record.scaleType as InstrumentalScaleType
    : fallback.scaleType;
  const direction = DIRECTIONS.has(record.direction as InstrumentalDirection)
    ? record.direction as InstrumentalDirection
    : fallback.direction;
  const expectedMinimum = Number(record.expectedMinimum);
  const expectedMaximum = Number(record.expectedMaximum);
  return {
    dataType,
    scaleType,
    direction,
    zeroMeaningful: typeof record.zeroMeaningful === 'boolean' ? record.zeroMeaningful : fallback.zeroMeaningful,
    ...(Number.isFinite(expectedMinimum) ? { expectedMinimum } : {}),
    ...(Number.isFinite(expectedMaximum) ? { expectedMaximum } : {}),
    source: record.source === 'declared' ? 'declared' : fallback.source,
  };
}

export function parseInstrumentalChartPreference(value: unknown): InstrumentalChartPreference {
  return CHART_PREFERENCES.has(value as InstrumentalChartPreference)
    ? value as InstrumentalChartPreference
    : 'auto';
}

export function applyInstrumentalChartPreference(
  value: unknown,
  parameterKey: string,
  preference: InstrumentalChartPreference,
) {
  const metrics = Array.isArray(value) ? value : [];
  let matched = false;
  const nextMetrics = metrics.map(metricValue => {
    if (!metricValue || typeof metricValue !== 'object') return metricValue;
    const metric = metricValue as Record<string, unknown>;
    if (String(metric.key) !== parameterKey) return metric;
    matched = true;
    const nextMetric = { ...metric };
    if (preference === 'auto') delete nextMetric.chartPreference;
    else nextMetric.chartPreference = preference;
    return nextMetric;
  });
  return { metrics: nextMetrics, matched };
}
