import { useId, useMemo, useState } from 'react';
import { BarChart3, FlaskConical, Plus, Search, SlidersHorizontal, Sparkles, TableProperties } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ETongueMeasurement } from './stage1-instrumental-data';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import {
  buildInstrumentalParameterRadarModel,
  collectInstrumentalParameters,
  formatInstrumentalValue,
  instrumentalAxisSupportsBuildChart,
  isInstrumentalRangeBand,
  orderInstrumentalAxesByBuildAvailability,
  orderInstrumentalAxesByRelationships,
  recommendInstrumentalChart,
  selectRecommendedBoxPlotAxes,
  type InstrumentalBuildChartType,
  type InstrumentalParameterAxis,
} from '../lib/instrumental-parameter-chart';
import { instrumentalComparisonColor } from '../lib/instrumental-comparison';
import { CHART_CHROME } from '../styles/tokens';
import { InstrumentalBoxPlots } from './instrumental-parameter-box-plots';

interface InstrumentalParameterRadarProps {
  samples: ETongueMeasurement[];
  selectedSampleIds: string[];
  compareMode: boolean;
  selectedColor: string;
}

type ChartWorkspaceMode = 'recommended' | 'custom';

const BUILD_CHART_OPTIONS: Array<{
  type: InstrumentalBuildChartType;
  label: string;
  description: string;
}> = [
  { type: 'radar', label: 'Radar profile', description: 'Compare three or more continuous measures' },
  { type: 'bar', label: 'Grouped bars', description: 'Compare values on compatible scales' },
  { type: 'box', label: 'Box plots', description: 'Inspect replicate distributions' },
];

type ChartRow = Record<string, string | number | null> & {
  parameter: string;
  unit: string;
  displayMode?: 'raw' | 'share' | 'deviation';
  rawUnit?: string;
};

interface ParameterBarGroup {
  key: string;
  title: string;
  unit: string;
  kind: 'range-band' | 'raw-scale' | 'relative-index';
  axes: InstrumentalParameterAxis[];
}

interface TooltipEntry {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  payload?: ChartRow;
  value?: string | number;
}

function formatMeasurement(value: number) {
  return formatInstrumentalValue(value);
}

function formatMeasurementWithUnit(value: number, unit: string) {
  const formatted = formatMeasurement(value);
  if (!unit) return formatted;
  return unit === '%' ? `${formatted}%` : `${formatted} ${unit}`;
}

function formatProjectRange(axis: InstrumentalParameterAxis) {
  if (!axis.scale.hasVariation) return formatMeasurementWithUnit(axis.scale.minimum, axis.unit);
  return `${formatMeasurement(axis.scale.minimum)} to ${formatMeasurementWithUnit(axis.scale.maximum, axis.unit)}`;
}

function scaleMethodLabel(axis: InstrumentalParameterAxis) {
  if (axis.scale.method === 'raw-only') return 'Raw values only';
  return axis.scale.hasVariation ? 'Compared with project average' : 'No variation';
}

function formatProjectDeviation(value: number) {
  if (Math.abs(value) < 0.05) return 'At project average';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}% vs average`;
}

function buildDeviationScale(values: number[]) {
  const largestDeviation = Math.max(0, ...values.map(value => Math.abs(value)));
  return { limit: Math.max(20, Math.ceil(largestDeviation / 10) * 10) };
}

function formatDeviationTick(value: number, limit: number) {
  const deviation = value - limit;
  if (Math.abs(deviation) < 0.05) return 'Average';
  return `${deviation > 0 ? '+' : ''}${deviation.toFixed(0)}%`;
}

function shortenedAxisLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 17)}…` : value;
}

function shortenedBarLabel(value: string) {
  return value.length > 28 ? `${value.slice(0, 27)}…` : value;
}

function rangeBandFamily(label: string) {
  const boundedRange = /\d+(?:[.,]\d+)?\s*(?:mm|cm|m|µm|um|g|kg|mg|ml|l|s|sec|secs|seconds?|%|°c|c)?\s*(?:-|–|—|to)\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m|µm|um|g|kg|mg|ml|l|s|sec|secs|seconds?|%|°c|c)?/gi;
  const openRange = /(?:≤|≥|<|>|up\s+to|under|over|less\s+than|more\s+than)\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m|µm|um|g|kg|mg|ml|l|s|sec|secs|seconds?|%|°c|c)?/gi;
  const family = label
    .replace(boundedRange, ' ')
    .replace(openRange, ' ')
    .replace(/[():–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return family || 'Range-band measurements';
}

function buildParameterBarGroups(axes: InstrumentalParameterAxis[], consolidate = false) {
  const groups = new Map<string, ParameterBarGroup>();
  axes.forEach(axis => {
    const rangeBand = isInstrumentalRangeBand(axis.label);
    const relativeIndex = consolidate && !rangeBand && axis.scale.method === 'project-mean-deviation';
    const title = rangeBand
      ? rangeBandFamily(axis.label)
      : relativeIndex
        ? 'Selected parameter comparison'
        : consolidate
          ? axis.unit ? `${axis.unit} measurements` : 'Unitless measurements'
          : axis.label;
    const key = rangeBand
      ? `range:${title.toLocaleLowerCase()}:${axis.unit}`
      : relativeIndex
        ? 'relative:selected-parameters'
        : consolidate
          ? `raw:${axis.unit.toLocaleLowerCase()}:${axis.scale.method}:${axis.metadata.scaleType}`
          : `raw:${axis.key}`;
    const group = groups.get(key) ?? {
      key,
      title,
      unit: relativeIndex ? '%' : axis.unit,
      kind: rangeBand ? 'range-band' : relativeIndex ? 'relative-index' : 'raw-scale',
      axes: [],
    };
    group.axes.push(axis);
    groups.set(key, group);
  });
  return [...groups.values()].map(group => ({
    ...group,
    axes: group.kind === 'range-band'
      ? [...group.axes].sort((left, right) => rangeBandOrder(left.label) - rangeBandOrder(right.label))
      : group.axes,
  }));
}

function rangeBandOrder(label: string) {
  if (/(?:≤|<|up\s+to|under|less\s+than)/i.test(label)) return Number.NEGATIVE_INFINITY;
  const firstNumber = Number.parseFloat(label.match(/\d+(?:[.,]\d+)?/)?.[0].replace(',', '.') ?? '');
  return Number.isFinite(firstNumber) ? firstNumber : Number.POSITIVE_INFINITY;
}

function usesResponseShare(group: ParameterBarGroup) {
  return group.kind === 'range-band' && /^(?:responses?|counts?|frequency|occurrences?|n)$/i.test(group.unit.trim());
}

function barDomain(axes: InstrumentalParameterAxis[], sampleIds: string[]): [number, number] {
  const values = axes.flatMap(axis => sampleIds.flatMap(sampleId => {
    const raw = axis.values[sampleId]?.raw;
    return raw === undefined || !Number.isFinite(raw) ? [] : [raw];
  }));
  if (values.length === 0 || values.every(value => value === 0)) return [-1, 1];
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const span = maximum - minimum || Math.max(Math.abs(minimum), Math.abs(maximum), 1);
  return [minimum < 0 ? minimum - (span * 0.08) : 0, maximum > 0 ? maximum + (span * 0.08) : 0];
}

function barDomainFromRows(rows: ChartRow[], dataKeys: string[]): [number, number] {
  const values = rows.flatMap(row => dataKeys.flatMap(key => {
    const value = row[key];
    return typeof value === 'number' && Number.isFinite(value) ? [value] : [];
  }));
  if (values.length === 0 || values.every(value => value === 0)) return [-1, 1];
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const span = maximum - minimum || Math.max(Math.abs(minimum), Math.abs(maximum), 1);
  return [minimum - (span * 0.08), maximum + (span * 0.08)];
}

function ParameterTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="max-w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-md">
      <p className="text-sm font-semibold text-slate-950">{row.parameter}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map(entry => {
          const dataKey = String(entry.dataKey ?? '');
          const raw = Number(row[`${dataKey}_raw`]);
          const observations = Number(row[`${dataKey}_observations`]);
          const deviation = Number(row[`${dataKey}_deviation`]);
          if (!Number.isFinite(raw) || !Number.isFinite(deviation)) return null;
          return (
            <div key={dataKey} className="text-xs">
              <p className="font-semibold" style={{ color: entry.color }}>
                {String(entry.name)}: {formatMeasurementWithUnit(raw, row.unit)}
              </p>
              <p className="text-slate-600">
                {formatProjectDeviation(deviation)} · mean of {observations} observation{observations === 1 ? '' : 's'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ParameterBarTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="max-w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-md">
      <p className="text-sm font-semibold text-slate-950">{row.parameter}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map(entry => {
          const dataKey = String(entry.dataKey ?? '');
          const displayed = Number(row[dataKey]);
          const raw = Number(row[`${dataKey}_raw`] ?? displayed);
          const observations = Number(row[`${dataKey}_observations`]);
          if (!Number.isFinite(displayed) || !Number.isFinite(raw)) return null;
          return (
            <div key={dataKey} className="text-xs">
              <p className="font-semibold" style={{ color: entry.color }}>
                {String(entry.name)}: {row.displayMode === 'share'
                  ? `${formatMeasurement(displayed)}% (${formatMeasurementWithUnit(raw, row.rawUnit ?? '')})`
                  : row.displayMode === 'deviation'
                    ? `${formatProjectDeviation(displayed)} (${formatMeasurementWithUnit(raw, row.rawUnit ?? '')})`
                  : formatMeasurementWithUnit(raw, row.unit)}
              </p>
              {Number.isFinite(observations) && (
                <p className="text-slate-600">Mean of {observations} observation{observations === 1 ? '' : 's'}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function InstrumentalParameterRadar({
  samples,
  selectedSampleIds,
  compareMode,
  selectedColor,
}: InstrumentalParameterRadarProps) {
  const checkboxPrefix = useId();
  const [workspaceMode, setWorkspaceMode] = useState<ChartWorkspaceMode>('recommended');
  const [excludedRadarParameterKeys, setExcludedRadarParameterKeys] = useState<string[]>([]);
  const [customChartTypes, setCustomChartTypes] = useState<InstrumentalBuildChartType[]>(['bar']);
  const [customParameterKeys, setCustomParameterKeys] = useState<string[]>([]);
  const [parameterQuery, setParameterQuery] = useState('');
  const [radarWidth, setRadarWidth] = useState(0);
  const availableParameters = useMemo(() => collectInstrumentalParameters(samples), [samples]);
  const activeSampleIds = useMemo(
    () => compareMode ? selectedSampleIds : selectedSampleIds.slice(0, 1),
    [compareMode, selectedSampleIds],
  );
  const model = useMemo(() => buildInstrumentalParameterRadarModel({
    samples,
    selectedSampleIds: activeSampleIds,
    selectedParameterKeys: availableParameters.map(parameter => parameter.key),
  }), [activeSampleIds, availableParameters, samples]);
  if (availableParameters.length === 0) return null;

  const series = model.samples.map((sample, index) => ({
    ...sample,
    dataKey: `sample_${index}`,
    color: compareMode ? instrumentalComparisonColor(index) : selectedColor,
  }));
  const recommendationFor = (axis: InstrumentalParameterAxis) => recommendInstrumentalChart(axis, axis.chartPreference);
  const recommendedRadarEligibleAxes = orderInstrumentalAxesByRelationships(
    model.axes.filter(axis => recommendationFor(axis).radarEligible),
    model.relationships,
  );
  const customParameterKeySet = new Set(customParameterKeys);
  const customAxes = model.axes.filter(axis => customParameterKeySet.has(axis.key));
  const customRadarEnabled = customChartTypes.includes('radar');
  const customBarEnabled = customChartTypes.includes('bar');
  const customBoxEnabled = customChartTypes.includes('box');
  const radarEligibleAxes = workspaceMode === 'recommended'
    ? recommendedRadarEligibleAxes
    : orderInstrumentalAxesByRelationships(
        model.axes.filter(axis => instrumentalAxisSupportsBuildChart(axis, 'radar')),
        model.relationships,
      );
  const selectedRadarParameterKeys = workspaceMode === 'recommended'
    ? radarEligibleAxes.filter(axis => !excludedRadarParameterKeys.includes(axis.key)).map(axis => axis.key)
    : customRadarEnabled
      ? radarEligibleAxes.filter(axis => customParameterKeySet.has(axis.key)).map(axis => axis.key)
      : [];
  const selectedRadarKeySet = new Set(selectedRadarParameterKeys);
  const radarAxes = radarEligibleAxes.filter(axis => selectedRadarKeySet.has(axis.key));
  const barAxes = workspaceMode === 'recommended'
    ? model.axes.filter(axis => ['bar', 'distribution'].includes(recommendationFor(axis).primaryChart))
    : customBarEnabled ? customAxes : [];
  const recommendedBoxCandidates = model.axes.filter(axis => recommendationFor(axis).primaryChart === 'box');
  const boxAxes = workspaceMode === 'recommended'
    ? selectRecommendedBoxPlotAxes(recommendedBoxCandidates)
    : customBoxEnabled
      ? customAxes.filter(axis => instrumentalAxisSupportsBuildChart(axis, 'box'))
      : [];
  const omittedRecommendedBoxPlotCount = workspaceMode === 'recommended'
    ? Math.max(0, recommendedBoxCandidates.length - boxAxes.length)
    : 0;
  const displayedKeySet = new Set([
    ...barAxes.map(axis => axis.key),
    ...boxAxes.map(axis => axis.key),
    ...selectedRadarParameterKeys,
  ]);
  const displayedAxes = workspaceMode === 'recommended'
    ? model.axes.filter(axis => displayedKeySet.has(axis.key))
    : customAxes;
  const barGroups = buildParameterBarGroups(barAxes, workspaceMode === 'custom');
  const recommendedViewCount = Number(radarAxes.length >= 3)
    + Number(barGroups.length > 0)
    + Number(boxAxes.length > 0);
  const customAvailableAxisCount = model.axes.filter(axis => (
    customChartTypes.some(chart => instrumentalAxisSupportsBuildChart(axis, chart))
  )).length;
  const parameterSelectionAxes = workspaceMode === 'recommended' ? radarEligibleAxes : model.axes;
  const filteredParameterAxes = (() => {
    const query = parameterQuery.trim().toLocaleLowerCase();
    const matchingAxes = !query ? parameterSelectionAxes : parameterSelectionAxes.filter(axis => (
      axis.label.toLocaleLowerCase().includes(query)
      || axis.unit.toLocaleLowerCase().includes(query)
    ));
    if (workspaceMode === 'recommended') return matchingAxes;
    return orderInstrumentalAxesByBuildAvailability(matchingAxes, customChartTypes);
  })();
  const deviationScale = buildDeviationScale(radarAxes.flatMap(axis => (
    Object.values(axis.values).flatMap(value => (
      value?.deviationFromProjectMean === null || value?.deviationFromProjectMean === undefined
        ? []
        : [value.deviationFromProjectMean]
    ))
  )));
  const chartData: ChartRow[] = radarAxes.map(axis => {
    const row: ChartRow = {
      parameter: axis.label,
      unit: axis.unit,
      projectAverage: deviationScale.limit,
    };
    series.forEach(seriesItem => {
      const value = axis.values[seriesItem.sampleId];
      const deviation = value?.deviationFromProjectMean ?? null;
      row[seriesItem.dataKey] = deviation === null ? null : deviation + deviationScale.limit;
      row[`${seriesItem.dataKey}_deviation`] = deviation;
      row[`${seriesItem.dataKey}_raw`] = value?.raw ?? null;
      row[`${seriesItem.dataKey}_observations`] = value?.observationCount ?? null;
    });
    return row;
  });
  const hasRawOnlyParameters = displayedAxes.some(axis => axis.scale.method === 'raw-only');
  const hasRangeBandParameters = displayedAxes.some(axis => isInstrumentalRangeBand(axis.label));
  const hasMissingMeasurements = displayedAxes.some(axis => (
    series.some(seriesItem => axis.values[seriesItem.sampleId] === null)
  ));
  const limitedProjectRange = model.projectSampleCount > 0 && model.projectSampleCount <= 2;
  const compactRadar = radarWidth > 0 && radarWidth < 480;

  const toggleRadarParameter = (key: string) => {
    setExcludedRadarParameterKeys(current => (
      current.includes(key)
        ? current.filter(candidate => candidate !== key)
        : [...current, key]
    ));
  };

  const customAxisEligible = (axis: InstrumentalParameterAxis, chartTypes = customChartTypes) => (
    chartTypes.some(chart => instrumentalAxisSupportsBuildChart(axis, chart))
  );

  const toggleCustomChartType = (chart: InstrumentalBuildChartType) => {
    setCustomChartTypes(current => {
      const next = current.includes(chart)
        ? current.filter(candidate => candidate !== chart)
        : [...current, chart];
      setCustomParameterKeys(keys => keys.filter(key => {
        const axis = model.axes.find(candidate => candidate.key === key);
        return axis ? customAxisEligible(axis, next) : false;
      }));
      return next;
    });
  };

  const toggleCustomParameter = (axis: InstrumentalParameterAxis) => {
    if (!customAxisEligible(axis)) return;
    setCustomParameterKeys(current => (
      current.includes(axis.key)
        ? current.filter(key => key !== axis.key)
        : [...current, axis.key]
    ));
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FlaskConical className="size-5 text-slate-700" />
              Instrumental charts
            </CardTitle>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-700">
              {workspaceMode === 'recommended'
                ? 'Best-fit views based on parameter type, scale, and available replicate evidence.'
                : 'Build a focused comparison without mixing incompatible scales or measurement types.'}
            </p>
          </div>
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {workspaceMode === 'recommended'
              ? `${recommendedViewCount} view${recommendedViewCount === 1 ? '' : 's'} · ${displayedAxes.length} parameters`
              : `${customParameterKeys.length} selected · ${customChartTypes.length} chart type${customChartTypes.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-full rounded-lg bg-slate-100 p-1 sm:w-auto" aria-label="Chart workspace mode">
            <button
              type="button"
              aria-pressed={workspaceMode === 'recommended'}
              onClick={() => setWorkspaceMode('recommended')}
              className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors sm:flex-none ${workspaceMode === 'recommended' ? 'bg-[var(--brand)] text-[var(--primary-foreground)]' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}
            >
              <Sparkles className="size-4" aria-hidden />
              Recommended
            </button>
            <button
              type="button"
              aria-pressed={workspaceMode === 'custom'}
              onClick={() => setWorkspaceMode('custom')}
              className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors sm:flex-none ${workspaceMode === 'custom' ? 'bg-[var(--brand)] text-[var(--primary-foreground)]' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}
            >
              <Plus className="size-4" aria-hidden />
              Build your own
            </button>
          </div>
          <p className="text-xs leading-5 text-slate-600">
            {workspaceMode === 'recommended'
              ? 'Curated for a useful first read.'
              : 'Choose chart types, then add compatible parameters.'}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        {workspaceMode === 'custom' && (
          <section aria-labelledby="custom-chart-types-heading" className="rounded-lg bg-slate-50 p-4">
            <div>
              <h3 id="custom-chart-types-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <BarChart3 className="size-4 text-slate-600" aria-hidden />
                Add charts
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">Pick one or more formats. The parameter list keeps compatible measurements at the top.</p>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {BUILD_CHART_OPTIONS.map(option => {
                const checked = customChartTypes.includes(option.type);
                const availableCount = model.axes.filter(axis => instrumentalAxisSupportsBuildChart(axis, option.type)).length;
                const disabled = availableCount === 0 || (option.type === 'radar' && availableCount < 3);
                const id = `${checkboxPrefix}-chart-${option.type}`;
                return (
                  <label
                    key={option.type}
                    htmlFor={id}
                    className={`flex min-h-20 items-start gap-3 rounded-lg border px-3 py-3 transition-colors ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-55' : checked ? 'cursor-pointer border-[var(--brand)] bg-[var(--brand-soft)]' : 'cursor-pointer border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={() => toggleCustomChartType(option.type)} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-900">
                        {option.label}
                        <span className="shrink-0 rounded bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{availableCount}</span>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-600">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {customChartTypes.length === 0 && (
              <p className="mt-3 text-xs font-semibold text-amber-800">Choose at least one chart type to enable parameter selection.</p>
            )}
          </section>
        )}
        <div className={`grid items-start gap-5 ${workspaceMode === 'recommended' ? 'xl:grid-cols-[minmax(0,1fr)_19rem]' : 'xl:grid-cols-[19rem_minmax(0,1fr)]'}`}>
          <section aria-labelledby="relative-profile-heading" className={`min-w-0 ${workspaceMode === 'custom' ? 'xl:order-2' : ''}`}>
            <div>
              <h3 id="relative-profile-heading" className="text-sm font-semibold text-slate-950">
                {workspaceMode === 'recommended'
                  ? 'Recommended radar profile'
                  : customRadarEnabled ? 'Radar preview' : 'Chart preview'}
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                {workspaceMode === 'custom' && !customRadarEnabled
                  ? 'Selected bar and box plot views appear directly below.'
                  : 'The middle ring is the project average. Values move inward when lower than average and outward when higher than average.'}
              </p>
            </div>
            {radarAxes.length >= 3 && series.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={compactRadar ? 360 : 520} onResize={width => setRadarWidth(width)}>
                  <RadarChart
                    data={chartData}
                    cy="46%"
                    margin={{ top: 16, right: 16, bottom: 24, left: 16 }}
                    outerRadius={compactRadar ? '57%' : '74%'}
                  >
                    <PolarGrid stroke={CHART_CHROME.grid} strokeWidth={1} />
                    <PolarAngleAxis
                      dataKey="parameter"
                      tickSize={compactRadar ? 12 : 36}
                      tick={{ fill: CHART_CHROME.axis, fontSize: compactRadar || radarAxes.length > 14 ? 10 : 12, fontWeight: 600 }}
                      tickFormatter={value => (
                        compactRadar && value.length > 14 ? `${value.slice(0, 13)}…` : shortenedAxisLabel(value)
                      )}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, deviationScale.limit * 2]}
                      tick={{ fill: CHART_CHROME.muted, fontSize: 10 }}
                      tickCount={5}
                      tickFormatter={value => formatDeviationTick(Number(value), deviationScale.limit)}
                    />
                    {series.map(seriesItem => (
                      <Radar
                        key={seriesItem.sampleId}
                        name={seriesItem.name}
                        dataKey={seriesItem.dataKey}
                        stroke={seriesItem.color}
                        fill={seriesItem.color}
                        fillOpacity={series.length > 2 ? 0.07 : 0.16}
                        strokeWidth={2.25}
                        isAnimationActive={false}
                      />
                    ))}
                    <Tooltip content={<ParameterTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 text-xs">
                  {series.map(seriesItem => (
                    <span
                      key={seriesItem.sampleId}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700"
                    >
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: seriesItem.color }} />
                      {seriesItem.name}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className={`mt-4 flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center ${workspaceMode === 'custom' && !customRadarEnabled ? 'min-h-40' : 'min-h-80'}`}>
                <div className="max-w-sm">
                  <SlidersHorizontal className="mx-auto size-6 text-slate-500" />
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {workspaceMode === 'custom' && !customRadarEnabled
                      ? 'Choose parameters to generate your charts'
                      : series.length === 0 ? 'Select a sample to build the profile' : 'Choose at least three comparable parameters'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {workspaceMode === 'custom' && !customRadarEnabled
                      ? 'Use the parameter list alongside this preview. Add Radar above only when you need a normalized multi-parameter profile.'
                      : series.length === 0
                      ? 'The evidence table will populate when a sample is selected.'
                      : barAxes.length > 0
                        ? 'Range bands and direct-scale measures are automatically shown as bar charts below.'
                        : 'The radar needs three positive, populated continuous measures.'}
                  </p>
                </div>
              </div>
            )}
          </section>

          <aside className={`min-w-0 border-t border-slate-200 pt-5 xl:border-t-0 xl:pt-0 ${workspaceMode === 'recommended' ? 'xl:border-l xl:pl-5' : 'xl:order-1 xl:border-r xl:pr-5'}`} aria-label="Profile parameters">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">{workspaceMode === 'recommended' ? 'Radar parameters' : 'Parameters for your charts'}</h3>
                <p className="mt-1 text-xs text-slate-600">
                  {workspaceMode === 'recommended' ? 'Only compatible continuous measures' : 'Compatible measurements appear first'}
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-slate-600">
                {workspaceMode === 'recommended'
                  ? `${selectedRadarParameterKeys.length}/${radarEligibleAxes.length}`
                  : `${customParameterKeys.length}/${customAvailableAxisCount}`}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 flex-1"
                disabled={workspaceMode === 'recommended' ? radarEligibleAxes.length === 0 : customChartTypes.length === 0}
                onClick={() => workspaceMode === 'recommended'
                  ? setExcludedRadarParameterKeys([])
                  : setCustomParameterKeys(model.axes.filter(axis => customAxisEligible(axis)).map(axis => axis.key))}
              >
                {workspaceMode === 'recommended' ? 'Select all' : 'Select available'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 flex-1"
                disabled={workspaceMode === 'recommended' ? radarEligibleAxes.length === 0 : customParameterKeys.length === 0}
                onClick={() => workspaceMode === 'recommended'
                  ? setExcludedRadarParameterKeys(radarEligibleAxes.map(axis => axis.key))
                  : setCustomParameterKeys([])}
              >
                Clear
              </Button>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <Input
                type="search"
                value={parameterQuery}
                onChange={event => setParameterQuery(event.target.value)}
                placeholder="Find a parameter"
                aria-label="Find a parameter"
                className="min-h-11 pl-9"
              />
            </div>
            <div className="mt-2 max-h-[25rem] space-y-1 overflow-y-auto pr-1">
              {filteredParameterAxes.map((axis, index) => {
                const checked = workspaceMode === 'recommended'
                  ? !excludedRadarParameterKeys.includes(axis.key)
                  : customParameterKeySet.has(axis.key);
                const eligible = workspaceMode === 'recommended' || customAxisEligible(axis);
                const previousAxis = filteredParameterAxes[index - 1];
                const previousEligible = previousAxis ? customAxisEligible(previousAxis) : true;
                const showUnavailableHeading = workspaceMode === 'custom' && !eligible && (index === 0 || previousEligible);
                const compatibleCharts = workspaceMode === 'custom'
                  ? customChartTypes.filter(chart => instrumentalAxisSupportsBuildChart(axis, chart))
                  : [];
                const id = `${checkboxPrefix}-${workspaceMode}-${axis.key}`;
                return (
                  <div key={axis.key}>
                    {workspaceMode === 'custom' && eligible && index === 0 && (
                      <p className="mb-1 px-2 py-1 text-[11px] font-semibold text-slate-600">
                        Available for selected charts
                      </p>
                    )}
                    {showUnavailableHeading && (
                      <p className="mb-1 mt-3 border-t border-slate-200 px-2 pt-3 text-[11px] font-semibold text-slate-600">
                        Unavailable for selected charts
                      </p>
                    )}
                    <label
                      htmlFor={id}
                      className={`flex min-h-11 items-start gap-2.5 rounded-lg px-2 py-2 text-sm ${!eligible ? 'cursor-not-allowed opacity-45' : checked ? 'cursor-pointer bg-slate-100' : 'cursor-pointer hover:bg-slate-50'}`}
                    >
                      <Checkbox
                        id={id}
                        checked={checked}
                        disabled={!eligible}
                        onCheckedChange={() => workspaceMode === 'recommended' ? toggleRadarParameter(axis.key) : toggleCustomParameter(axis)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block break-words font-medium leading-5 text-slate-800">{axis.label}</span>
                        <span className="block text-xs text-slate-500">
                          {axis.unit || 'Unitless'}
                          {workspaceMode === 'custom' && compatibleCharts.length > 0
                            ? ` · ${compatibleCharts.map(chart => chart === 'box' ? 'Box' : chart === 'bar' ? 'Bar' : 'Radar').join(', ')}`
                            : ''}
                        </span>
                      </span>
                    </label>
                  </div>
                );
              })}
              {filteredParameterAxes.length === 0 && (
                <p className="px-2 py-6 text-center text-xs leading-5 text-slate-600">
                  {parameterSelectionAxes.length === 0
                    ? 'No imported measurements are eligible for the relative radar. Other measures are charted automatically below.'
                    : `No parameters match “${parameterQuery}”.`}
                </p>
              )}
            </div>
          </aside>
        </div>

        <InstrumentalBoxPlots
          axes={boxAxes}
          series={series}
          omittedCount={omittedRecommendedBoxPlotCount}
        />

        {barGroups.length > 0 && series.length > 0 && (
          <section aria-labelledby="direct-measurements-heading" className="min-w-0 border-t border-slate-200 pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 id="direct-measurements-heading" className="text-sm font-semibold text-slate-950">Parameter-specific charts</h3>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
                  {workspaceMode === 'recommended'
                    ? 'Range distributions and signed measures are visualized automatically and do not appear in the radar selector.'
                    : 'Selected parameters are separated by compatible scale and unit so their values remain interpretable.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {series.map(seriesItem => (
                  <span key={seriesItem.sampleId} className="flex items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1.5 font-medium text-slate-700">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: seriesItem.color }} aria-hidden />
                    {seriesItem.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
              {barGroups.map(group => {
                const showAsShare = usesResponseShare(group);
                const showAsDeviation = group.kind === 'relative-index';
                const totalsBySeries = new Map(series.map(seriesItem => [
                  seriesItem.dataKey,
                  group.axes.reduce((total, axis) => total + Math.max(0, axis.values[seriesItem.sampleId]?.raw ?? 0), 0),
                ]));
                const data: ChartRow[] = group.axes.map(axis => {
                  const row: ChartRow = {
                    parameter: axis.label,
                    unit: showAsShare || showAsDeviation ? '%' : axis.unit,
                    displayMode: showAsShare ? 'share' : showAsDeviation ? 'deviation' : 'raw',
                    rawUnit: axis.unit,
                  };
                  series.forEach(seriesItem => {
                    const value = axis.values[seriesItem.sampleId];
                    const raw = value?.raw ?? null;
                    const total = totalsBySeries.get(seriesItem.dataKey) ?? 0;
                    row[seriesItem.dataKey] = showAsShare && raw !== null
                      ? total > 0 ? (Math.max(0, raw) / total) * 100 : 0
                      : showAsDeviation
                        ? value?.deviationFromProjectMean ?? null
                        : raw;
                    row[`${seriesItem.dataKey}_raw`] = raw;
                    row[`${seriesItem.dataKey}_observations`] = value?.observationCount ?? null;
                  });
                  return row;
                });
                const domain: [number, number] = showAsShare
                  ? [0, 100]
                  : showAsDeviation
                    ? barDomainFromRows(data, series.map(seriesItem => seriesItem.dataKey))
                    : barDomain(group.axes, series.map(seriesItem => seriesItem.sampleId));
                const allSelectedValuesAreZero = data.every(row => series.every(seriesItem => row[seriesItem.dataKey] === 0));
                const chartHeight = Math.max(220, group.axes.length * Math.max(48, series.length * 22));
                return (
                  <div key={group.key} className="py-5 first:pt-4 last:pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{group.title}</h4>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {showAsShare
                            ? `Share of ${group.unit.toLocaleLowerCase()} within each sample; raw values remain in the tooltip`
                            : showAsDeviation
                              ? `All selected positive measures on one shared percentage scale; raw values and units remain in the tooltip`
                            : `${group.unit ? `Values in ${group.unit}` : 'Imported values'} · ${group.axes.length} parameter${group.axes.length === 1 ? '' : 's'}`}
                        </p>
                      </div>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        {group.kind === 'range-band' ? 'Range distribution' : showAsDeviation ? 'Relative comparison' : 'Direct scale'}
                      </span>
                    </div>
                    <div
                      className="mt-3 min-w-0"
                      role="img"
                      aria-label={`${group.title} bar chart comparing ${series.map(item => item.name).join(', ')}`}
                    >
                      <ResponsiveContainer width="100%" height={chartHeight}>
                        <BarChart
                          data={data}
                          layout="vertical"
                          margin={{ top: 8, right: 20, bottom: 8, left: 8 }}
                          barCategoryGap="24%"
                        >
                          <CartesianGrid horizontal={false} stroke={CHART_CHROME.grid} strokeWidth={1} />
                          <XAxis
                            type="number"
                            domain={domain}
                            tick={{ fill: CHART_CHROME.mutedDark, fontSize: 11 }}
                            tickFormatter={value => `${Number(value) > 0 && showAsDeviation ? '+' : ''}${formatMeasurement(Number(value))}${showAsShare || showAsDeviation ? '%' : ''}`}
                          />
                          <YAxis
                            type="category"
                            dataKey="parameter"
                            width={compactRadar ? 104 : 178}
                            tick={{ fill: CHART_CHROME.axis, fontSize: compactRadar ? 10 : 11, fontWeight: 600 }}
                            tickFormatter={value => shortenedBarLabel(String(value))}
                          />
                          <ReferenceLine x={0} stroke={CHART_CHROME.mutedDark} />
                          {series.map(seriesItem => (
                            <Bar
                              key={seriesItem.sampleId}
                              name={seriesItem.name}
                              dataKey={seriesItem.dataKey}
                              fill={seriesItem.color}
                              radius={[4, 4, 4, 4]}
                              maxBarSize={18}
                              isAnimationActive={false}
                            />
                          ))}
                          <Tooltip content={<ParameterBarTooltip />} cursor={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {allSelectedValuesAreZero && (
                      <p className="mt-2 text-xs leading-5 text-slate-600">All selected values are zero, so the chart remains at the baseline; the recorded zeros are retained in the evidence table.</p>
                    )}
                    {workspaceMode === 'recommended' && (
                      <p className="mt-2 text-xs leading-5 text-slate-600"><strong>Why this chart?</strong> {recommendationFor(group.axes[0]).reason}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section aria-labelledby="measured-evidence-heading" className="min-w-0 border-t border-slate-200 pt-5">
          <div className="flex items-start gap-2.5">
            <TableProperties className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
            <div>
              <h3 id="measured-evidence-heading" className="text-sm font-semibold text-slate-950">Measured evidence</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">Raw means, units, observation counts, project averages, and observed ranges.</p>
            </div>
          </div>

          {(limitedProjectRange || hasMissingMeasurements || (workspaceMode === 'recommended' && (hasRawOnlyParameters || hasRangeBandParameters))) && (
            <div className="mt-3 space-y-1 border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
              {limitedProjectRange && <p><strong>Small comparison set:</strong> only {model.projectSampleCount} sample{model.projectSampleCount === 1 ? '' : 's'} define the project average, so confirm the raw differences below.</p>}
              {workspaceMode === 'recommended' && (hasRawOnlyParameters || hasRangeBandParameters) && <p><strong>Adaptive charting:</strong> range bands, signed values, and zero-centred measures use native-scale bar charts instead of a relative radar axis.</p>}
              {hasMissingMeasurements && <p><strong>Missing evidence:</strong> unavailable sample measurements are marked below and are not joined across the radar.</p>}
            </div>
          )}

          <div className="mt-3 max-h-[31rem] overflow-auto border border-slate-200">
            <table className="w-full min-w-[44rem] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
                <tr>
                  <th scope="col" className="w-44 border-b border-slate-200 px-3 py-2.5 font-semibold">Parameter</th>
                  {series.map(seriesItem => (
                    <th key={seriesItem.sampleId} scope="col" className="min-w-40 border-b border-slate-200 px-3 py-2.5 font-semibold">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: seriesItem.color }} aria-hidden />
                        <span className="break-words">{seriesItem.name}</span>
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="min-w-52 border-b border-slate-200 px-3 py-2.5 font-semibold">Project context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {displayedAxes.length > 0 ? displayedAxes.map(axis => (
                  <tr key={axis.key} className="align-top hover:bg-slate-50">
                    <th scope="row" className="px-3 py-3 font-semibold text-slate-900">
                      <span className="block break-words">{axis.label}</span>
                      <span className="mt-0.5 block font-normal text-slate-500">{axis.unit || 'Unitless'}</span>
                    </th>
                    {series.map(seriesItem => {
                      const value = axis.values[seriesItem.sampleId];
                      return (
                        <td key={seriesItem.sampleId} className="px-3 py-3 text-slate-700">
                          {value ? (
                            <>
                              <span className="block font-semibold tabular-nums text-slate-950">{formatMeasurementWithUnit(value.raw, axis.unit)}</span>
                              <span className="mt-0.5 block text-slate-500">
                                {value.deviationFromProjectMean === null ? 'Raw only' : formatProjectDeviation(value.deviationFromProjectMean)} · n={value.observationCount}
                              </span>
                            </>
                          ) : (
                            <span className="font-medium text-slate-500">Not measured</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-slate-700">
                      <span className="block font-semibold tabular-nums text-slate-950">Average {formatMeasurementWithUnit(axis.scale.mean, axis.unit)}</span>
                      <span className="mt-0.5 block text-slate-500">Range {formatProjectRange(axis)} · {axis.scale.sampleCount}/{model.projectSampleCount} samples</span>
                      <span className="mt-0.5 block text-slate-500">{scaleMethodLabel(axis)}</span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={series.length + 2} className="px-4 py-10 text-center text-sm text-slate-600">
                      {series.length === 0 ? 'Select a sample to review its measured evidence.' : 'Choose at least one parameter to review its evidence.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
