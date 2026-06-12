import { AlertTriangle, ArrowRight, CheckCircle2, OctagonX } from 'lucide-react';
import type { DecisionSummary } from '../lib/decision-summary';
import type { GoStopTweakDecision } from '../utils/go-stop-tweak-engine';
import { buildDecisionSummary } from '../lib/decision-summary';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { cn } from './ui/utils';

const OUTCOME_STYLE = {
  GO: {
    icon: CheckCircle2,
    border: 'border-emerald-200',
    background: 'bg-emerald-50',
    badge: 'bg-emerald-700 text-white',
  },
  TWEAK: {
    icon: AlertTriangle,
    border: 'border-amber-200',
    background: 'bg-amber-50',
    badge: 'bg-amber-600 text-white',
  },
  STOP: {
    icon: OctagonX,
    border: 'border-rose-200',
    background: 'bg-rose-50',
    badge: 'bg-rose-700 text-white',
  },
};

export function DecisionSummaryCard({
  decision,
  summary = buildDecisionSummary(decision),
  action,
}: {
  decision: GoStopTweakDecision;
  summary?: DecisionSummary;
  action?: React.ReactNode;
}) {
  const style = OUTCOME_STYLE[summary.outcome];
  const Icon = style.icon;
  return (
    <Card className={cn('overflow-hidden border', style.border)}>
      <CardContent className="p-0">
        <div className={cn('flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between', style.background)}>
          <div className="flex min-w-0 gap-3">
            <Icon className="mt-0.5 size-6 shrink-0 text-slate-800" aria-hidden />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={style.badge}>{summary.outcome}</Badge>
                <span className="text-xs font-semibold text-slate-600">{summary.confidence} confidence</span>
                <span className="text-xs text-slate-500">ISSF {decision.issfScore.toFixed(0)}/100</span>
              </div>
              <h2 className="mt-3 text-lg font-bold text-slate-950">{summary.headline}</h2>
              <p className="mt-1 text-sm text-slate-700">{summary.definition}</p>
            </div>
          </div>
          {action}
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.42fr)]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Why</p>
            <ul className="mt-2 space-y-2">
              {summary.reasons.map(reason => (
                <li key={reason} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Next step</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{summary.nextStep}</p>
            <p className="mt-3 flex items-start gap-2 text-xs text-slate-600">
              <ArrowRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {summary.risk}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
