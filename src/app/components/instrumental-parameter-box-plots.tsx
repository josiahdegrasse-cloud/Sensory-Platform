import {
  summarizeInstrumentalDistribution,
  type InstrumentalParameterAxis,
} from '../lib/instrumental-parameter-chart';

interface SeriesDefinition {
  sampleId: string;
  name: string;
  color: string;
}

function formatMeasurement(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function withUnit(value: number, unit: string) {
  return unit === '%' ? `${formatMeasurement(value)}%` : `${formatMeasurement(value)}${unit ? ` ${unit}` : ''}`;
}

export function InstrumentalBoxPlots({ axes, series, omittedCount = 0 }: {
  axes: InstrumentalParameterAxis[];
  series: SeriesDefinition[];
  omittedCount?: number;
}) {
  if (axes.length === 0) return null;
  const rows = axes.flatMap(axis => {
    const summaries = series.flatMap(seriesItem => {
      const summary = summarizeInstrumentalDistribution(axis.values[seriesItem.sampleId]?.replicateValues ?? []);
      return summary ? [{ ...seriesItem, summary }] : [];
    });
    if (summaries.length === 0) return [];
    const domainMinimum = Math.min(...summaries.map(item => item.summary.minimum));
    const domainMaximum = Math.max(...summaries.map(item => item.summary.maximum));
    const span = domainMaximum - domainMinimum || 1;
    return [{
      axis,
      summaries,
      domainMinimum,
      domainMaximum,
      position: (value: number) => `${((value - domainMinimum) / span) * 100}%`,
    }];
  });
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="replicate-distribution-heading" className="min-w-0 border-t border-slate-200 pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="replicate-distribution-heading" className="text-sm font-semibold text-slate-950">Replicate variation</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">Selected parameters are consolidated into one comparison view. Each row keeps its own unit and scale.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {series.map(seriesItem => (
            <span key={seriesItem.sampleId} className="flex items-center gap-2 bg-slate-100 px-2.5 py-1.5 font-medium text-slate-700">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: seriesItem.color }} aria-hidden />
              {seriesItem.name}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 max-h-[38rem] overflow-y-auto border-y border-slate-200 [scrollbar-gutter:stable]">
        <div className="min-w-[38rem] divide-y divide-slate-200">
          {rows.map(({ axis, summaries, domainMinimum, domainMaximum, position }) => (
            <div key={axis.key} className="grid grid-cols-[11rem_minmax(0,1fr)] gap-4 px-3 py-4">
              <div className="min-w-0">
                <h4 className="break-words text-sm font-semibold leading-5 text-slate-900">{axis.label}</h4>
                <p className="mt-0.5 text-xs text-slate-500">{axis.unit || 'No unit supplied'}</p>
              </div>
              <div className="min-w-0 space-y-2">
                {summaries.map(item => (
                  <div key={item.sampleId} className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 text-xs">
                    <span className="truncate font-semibold text-slate-700" title={item.name}>{item.name}</span>
                    <div className="relative h-7" title={`${item.name}: ${withUnit(item.summary.minimum, axis.unit)} to ${withUnit(item.summary.maximum, axis.unit)}; median ${withUnit(item.summary.median, axis.unit)}`}>
                      <div className="absolute top-1/2 h-px -translate-y-1/2 bg-slate-500" style={{ left: position(item.summary.minimum), right: `calc(100% - ${position(item.summary.maximum)})` }} />
                      <div className="absolute top-1.5 h-4 border-2 bg-white" style={{ borderColor: item.color, left: position(item.summary.lowerQuartile), right: `calc(100% - ${position(item.summary.upperQuartile)})` }} />
                      <div className="absolute top-0.5 h-6 w-px bg-slate-700" style={{ left: position(item.summary.minimum) }} />
                      <div className="absolute top-0.5 h-6 w-px bg-slate-700" style={{ left: position(item.summary.maximum) }} />
                      <div className="absolute top-1 h-5 w-0.5 -translate-x-1/2" style={{ left: position(item.summary.median), backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
                <div className="ml-[6.75rem] flex justify-between text-[11px] tabular-nums text-slate-500">
                  <span>{withUnit(domainMinimum, axis.unit)}</span>
                  <span>{withUnit(domainMaximum, axis.unit)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {omittedCount > 0 && (
        <p className="mt-3 text-xs leading-5 text-slate-600">
          Showing the {rows.length} most informative replicate distributions. {omittedCount} additional parameter{omittedCount === 1 ? ' is' : 's are'} available in Build your own.
        </p>
      )}
    </section>
  );
}
