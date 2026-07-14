import type { ElementType, ReactNode } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import type { SampleWorkflowReadiness } from '../lib/workflow-readiness';

interface StatTile {
  value: number | string;
  label: string;
}

/**
 * The one "where are we / what next" setup card, shared by Decision and
 * Insights so the two pages always agree instead of drifting into separate
 * copy that can contradict each other (the original bug: Decision claimed
 * questionnaires didn't exist yet after they'd already been sent out).
 * Each page supplies its own headline/description copy and CTAs; the layout,
 * stat tiles, and per-sample stage breakdown are identical everywhere.
 */
export function ProjectReadinessSetupCard({
  icon: Icon,
  headline,
  description,
  stats,
  items,
  minimumResponses,
  actions,
}: {
  icon: ElementType;
  headline: string;
  description: string;
  stats: StatTile[];
  items: SampleWorkflowReadiness[];
  minimumResponses: number;
  actions: ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-amber-50">
              <Icon className="size-5 text-amber-600" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{headline}</h2>
              <p className="mt-1 text-sm text-slate-700">{description}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.map(stat => (
              <div key={stat.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
              {items.map(item => (
                <div key={item.sampleId} className="border-b border-slate-200 p-4 last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">{item.sampleName}</div>
                      <div className="text-xs text-slate-500">{item.sampleId}</div>
                    </div>
                    <Badge variant="outline" className={item.decisionReady
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'}>
                      {item.decisionReady ? 'Evidence ready' : `${item.responseCount}/${minimumResponses} responses`}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.stages.map(stage => (
                      <span
                        key={stage.id}
                        title={stage.detail}
                        className={`rounded-md px-2 py-1 text-xs font-medium ${
                          stage.state === 'complete'
                            ? 'bg-emerald-50 text-emerald-700'
                            : stage.state === 'current'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-50 text-slate-500'
                        }`}
                      >
                        {stage.label}
                      </span>
                    ))}
                  </div>
                  {item.blockers.length > 0 && (
                    <p className="mt-3 text-sm text-slate-700">{item.blockers[0]}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">{actions}</div>
        </div>
      </CardContent>
    </Card>
  );
}
