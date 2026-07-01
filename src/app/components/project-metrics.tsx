import { ClipboardList, Gauge, GitMerge } from 'lucide-react';
import { cn } from './ui/utils';
import { toneTextClasses } from './project-status-badge';
import type { ProjectStatusSummary } from '../lib/project-status';

/**
 * The three project metrics, each grouped under the workflow stage it comes from
 * so the funnel reads left-to-right and the numbers aren't mistaken for one set.
 * Responses come from the survey (Testing), ISSF from instrumental analysis
 * (Insights), and the call from the Decision stage — three different inputs.
 */
function Metric({
  icon: Icon,
  stage,
  value,
  muted,
  valueClassName,
}: {
  icon: typeof ClipboardList;
  stage: string;
  value: string;
  muted?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="size-3" /> {stage}
      </span>
      <span className={cn('text-sm font-bold', muted ? 'text-slate-500' : 'text-slate-900', valueClassName)}>
        {value}
      </span>
    </div>
  );
}

export function ProjectMetrics({ status, className }: { status: ProjectStatusSummary; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start gap-x-6 gap-y-2', className)}>
      {status.responseTarget > 0 && (
        <Metric
          icon={ClipboardList}
          stage="Testing"
          value={`${status.responseCompleted} / ${status.responseTarget}`}
          muted={status.responseCompleted === 0}
        />
      )}
      <Metric
        icon={Gauge}
        stage="Insights"
        value={status.issfScore !== null ? `ISSF ${status.issfScore.toFixed(0)}` : 'ISSF —'}
        muted={status.issfScore === null}
      />
      <Metric
        icon={GitMerge}
        stage="Decision"
        value={status.decisionStatus}
        muted={status.decisionStatus === 'Not started'}
        valueClassName={status.decisionStatus === 'Not started' ? undefined : toneTextClasses(status.decisionTone)}
      />
    </div>
  );
}
