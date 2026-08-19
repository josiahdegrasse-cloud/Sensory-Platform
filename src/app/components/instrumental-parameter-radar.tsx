import { useId, useMemo, useState } from 'react';
import { FlaskConical, SlidersHorizontal } from 'lucide-react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { ETongueMeasurement } from './stage1-instrumental-data';
import { Checkbox } from './ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  buildInstrumentalParameterRadarModel,
  collectInstrumentalParameters,
} from '../lib/instrumental-parameter-chart';
import { instrumentalComparisonColor } from '../lib/instrumental-comparison';
import { CHART_CHROME } from '../styles/tokens';

interface InstrumentalParameterRadarProps {
  samples: ETongueMeasurement[];
  selectedSampleIds: string[];
  compareMode: boolean;
  selectedColor: string;
}

type ChartRow = Record<string, string | number | null> & {
  parameter: string;
  unit: string;
};

interface TooltipEntry {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  payload?: ChartRow;
  value?: string | number;
}

function formatMeasurement(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function shortenedAxisLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 17)}…` : value;
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
          if (!Number.isFinite(raw)) return null;
          return (
            <div key={dataKey} className="text-xs">
              <p className="font-semibold" style={{ color: entry.color }}>
                {String(entry.name)}: {formatMeasurement(raw)}{row.unit ? ` ${row.unit}` : ''}
              </p>
              <p className="text-slate-600">
                {Number(entry.value).toFixed(1)}% of observed scale · mean of {observations} observation{observations === 1 ? '' : 's'}
              </p>
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
  const [excludedParameterKeys, setExcludedParameterKeys] = useState<string[]>([]);
  const availableParameters = useMemo(() => collectInstrumentalParameters(samples), [samples]);
  const selectedParameterKeys = availableParameters
    .filter(parameter => !excludedParameterKeys.includes(parameter.key))
    .map(parameter => parameter.key);
  const activeSampleIds = compareMode ? selectedSampleIds : selectedSampleIds.slice(0, 1);
  const model = useMemo(() => buildInstrumentalParameterRadarModel({
    samples,
    selectedSampleIds: activeSampleIds,
    selectedParameterKeys,
  }), [activeSampleIds, samples, selectedParameterKeys]);

  if (availableParameters.length === 0) return null;

  const series = model.samples.map((sample, index) => ({
    ...sample,
    dataKey: `sample_${index}`,
    color: compareMode ? instrumentalComparisonColor(index) : selectedColor,
  }));
  const chartData: ChartRow[] = model.axes.map(axis => {
    const row: ChartRow = {
      parameter: axis.label,
      unit: axis.unit,
      fullMark: 100,
    };
    series.forEach(seriesItem => {
      const value = axis.values[seriesItem.sampleId];
      row[seriesItem.dataKey] = value?.normalized ?? null;
      row[`${seriesItem.dataKey}_raw`] = value?.raw ?? null;
      row[`${seriesItem.dataKey}_observations`] = value?.observationCount ?? null;
    });
    return row;
  });

  const toggleParameter = (key: string) => {
    setExcludedParameterKeys(current => (
      current.includes(key)
        ? current.filter(candidate => candidate !== key)
        : [...current, key]
    ));
  };

  return (
    <Card className="border-2 border-slate-200 shadow-sm">
      <CardHeader className="border-b bg-slate-50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FlaskConical className="size-5 text-slate-700" />
              Instrumental parameter profile
            </CardTitle>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-700">
              Imported means are normalized per parameter against this project so measurements with different units can share one spider chart. Exact values and observation counts remain in the tooltip.
            </p>
          </div>
          <span className="rounded-md bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {selectedParameterKeys.length}/{availableParameters.length} parameters shown
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <section aria-label="Instrumental parameter spider chart" className="min-w-0">
            {model.axes.length >= 3 && series.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={520}>
                  <RadarChart data={chartData} margin={{ top: 22, right: 52, bottom: 22, left: 52 }}>
                    <PolarGrid stroke={CHART_CHROME.grid} strokeWidth={1} />
                    <PolarAngleAxis
                      dataKey="parameter"
                      tick={{ fill: CHART_CHROME.axis, fontSize: model.axes.length > 14 ? 10 : 12, fontWeight: 600 }}
                      tickFormatter={shortenedAxisLabel}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fill: CHART_CHROME.muted, fontSize: 10 }}
                      tickCount={5}
                      tickFormatter={value => `${value}%`}
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
              <div className="flex min-h-96 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                <div className="max-w-sm">
                  <SlidersHorizontal className="mx-auto size-6 text-slate-500" />
                  <p className="mt-3 text-sm font-semibold text-slate-900">Choose at least three parameters</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">A spider chart needs three or more populated axes for the selected sample.</p>
                </div>
              </div>
            )}
          </section>

          <aside className="border-t border-slate-200 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0" aria-label="Spider chart parameters">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Parameters</h3>
                <p className="mt-0.5 text-xs text-slate-600">Control the chart axes</p>
              </div>
              <div className="flex gap-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setExcludedParameterKeys([])}
                  className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setExcludedParameterKeys(availableParameters.map(parameter => parameter.key))}
                  className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-3 max-h-[30rem] space-y-1 overflow-y-auto pr-1">
              {availableParameters.map(parameter => {
                const checked = !excludedParameterKeys.includes(parameter.key);
                const id = `${checkboxPrefix}-${parameter.key}`;
                return (
                  <label
                    key={parameter.key}
                    htmlFor={id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={() => toggleParameter(parameter.key)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block break-words font-medium leading-5 text-slate-800">{parameter.label}</span>
                      <span className="block text-xs text-slate-500">{parameter.unit || 'No unit supplied'}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </aside>
        </div>
      </CardContent>
    </Card>
  );
}
