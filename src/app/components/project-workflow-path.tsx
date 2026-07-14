import { AlertTriangle, Check, Circle, CircleDot, Lock } from 'lucide-react';
import { Link } from 'react-router';
import type { WorkflowStageState, WorkflowStageStatus } from '../lib/project-status';
import { cn } from './ui/utils';

const STAGE_PRESENTATION: Record<WorkflowStageState, {
  label: string;
  icon: typeof Circle;
  markerClassName: string;
}> = {
  complete: {
    label: 'Complete',
    icon: Check,
    markerClassName: 'border-emerald-600 bg-emerald-600 text-white',
  },
  current: {
    label: 'Current',
    icon: CircleDot,
    markerClassName: 'border-blue-600 bg-blue-600 text-white',
  },
  'needs-review': {
    label: 'Needs review',
    icon: AlertTriangle,
    markerClassName: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  available: {
    label: 'Ready',
    icon: CircleDot,
    markerClassName: 'border-blue-300 bg-white text-blue-700',
  },
  blocked: {
    label: 'Pending',
    icon: Lock,
    markerClassName: 'border-slate-200 bg-white text-slate-400',
  },
  'not-started': {
    label: 'Not started',
    icon: Circle,
    markerClassName: 'border-slate-200 bg-white text-slate-400',
  },
};

export function ProjectWorkflowPath({
  stages,
  compact = false,
  onNavigate,
}: {
  stages: WorkflowStageStatus[];
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ol
      aria-label="Project order of operations"
      className={cn(
        'grid grid-cols-1 gap-3',
        compact ? 'min-w-[30rem] grid-cols-7 gap-0' : 'md:grid-cols-7 md:gap-0',
      )}
    >
      {stages.map((stage, index) => {
        const presentation = STAGE_PRESENTATION[stage.state];
        const Icon = presentation.icon;
        const connectorComplete = stage.state === 'complete';
        const isCurrent = stage.state === 'current' || stage.state === 'needs-review';

        return (
          <li
            key={stage.id}
            className={cn('relative min-w-0', compact ? 'px-1' : 'md:px-1')}
          >
            {index < stages.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'absolute z-0 bg-slate-200',
                  compact
                    ? 'left-[calc(50%+0.75rem)] right-[calc(-50%+0.75rem)] top-3 h-px'
                    : 'bottom-[-0.75rem] left-[0.9375rem] top-8 w-px md:bottom-auto md:left-[calc(50%+1rem)] md:right-[calc(-50%+1rem)] md:top-4 md:h-px md:w-auto',
                  connectorComplete && 'bg-emerald-300',
                )}
              />
            )}

            <Link
              to={stage.path}
              onClick={onNavigate}
              title={stage.detail}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`${stage.label}: ${presentation.label}. ${stage.detail}`}
              className={cn(
                'group relative z-10 flex min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2',
                compact
                  ? 'flex-col items-center gap-1 px-0.5 py-1 text-center'
                  : 'items-center gap-3 py-1 md:flex-col md:gap-2 md:px-1 md:text-center',
              )}
            >
              <span
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-full border transition-transform group-hover:scale-105',
                  compact ? 'size-6' : 'size-8',
                  presentation.markerClassName,
                )}
              >
                <Icon className={compact ? 'size-3' : 'size-4'} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className={cn(
                  'block truncate font-semibold',
                  compact ? 'text-[10px] leading-4 text-slate-700' : 'text-sm text-slate-900 md:text-xs',
                )}>
                  {stage.label}
                </span>
                {!compact && (
                  <span className={cn(
                    'mt-0.5 block text-xs',
                    isCurrent ? 'font-semibold text-slate-700' : 'text-slate-500',
                  )}>
                    {presentation.label}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
