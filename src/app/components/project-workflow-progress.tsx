import { Link } from 'react-router';
import { Check, Lock, ChevronRight } from 'lucide-react';
import { cn } from './ui/utils';
import type { WorkflowStageStatus, WorkflowStageState } from '../lib/project-status';

const STATE_STYLES: Record<WorkflowStageState, { chip: string; dot: string; connector: string }> = {
  complete:     { chip: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100', dot: 'bg-emerald-600 text-white', connector: 'bg-emerald-200' },
  current:      { chip: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700', dot: 'bg-blue-600 text-white ring-4 ring-blue-100', connector: 'bg-slate-200' },
  available:    { chip: 'bg-slate-100 text-slate-600 hover:bg-slate-200', dot: 'bg-white text-slate-400 border-2 border-slate-300', connector: 'bg-slate-200' },
  blocked:      { chip: 'bg-slate-50 text-slate-400 cursor-not-allowed', dot: 'bg-slate-100 text-slate-400 border border-slate-200', connector: 'bg-slate-100' },
  'not-started':{ chip: 'bg-slate-50 text-slate-400 hover:bg-slate-100', dot: 'bg-white text-slate-300 border-2 border-dashed border-slate-300', connector: 'bg-slate-100' },
};

function StageDot({ stage, index }: { stage: WorkflowStageStatus; index: number }) {
  const styles = STATE_STYLES[stage.state];
  if (stage.state === 'complete') {
    return <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', styles.dot)}><Check className="size-3.5" /></span>;
  }
  if (stage.state === 'blocked') {
    return <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', styles.dot)}><Lock className="size-3" /></span>;
  }
  return <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', styles.dot)}>{index + 1}</span>;
}

interface ProjectWorkflowProgressProps {
  stages: WorkflowStageStatus[];
  /** Compact renders a chip row (good for the project header); full renders the labeled stepper. */
  variant?: 'full' | 'compact';
  className?: string;
}

/**
 * Real workflow progress for a project — each stage's state is derived from
 * actual project data via computeProjectStatus, not hand-set per page.
 */
export function ProjectWorkflowProgress({ stages, variant = 'full', className }: ProjectWorkflowProgressProps) {
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-1 overflow-x-auto', className)}>
        {stages.map((stage, i) => {
          const styles = STATE_STYLES[stage.state];
          const clickable = stage.state !== 'blocked';
          const Wrapper = clickable ? Link : 'span';
          return (
            <div key={stage.id} className="flex items-center flex-shrink-0">
              <Wrapper
                {...(clickable ? { to: stage.path } : {})}
                title={stage.detail}
                className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors', styles.chip)}
              >
                <StageDot stage={stage} index={i} />
                {stage.label}
              </Wrapper>
              {i < stages.length - 1 && <ChevronRight className="size-3.5 text-slate-300 mx-0.5 flex-shrink-0" />}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('flex items-start', className)}>
      {stages.map((stage, i) => {
        const styles = STATE_STYLES[stage.state];
        const clickable = stage.state !== 'blocked';
        const Wrapper = clickable ? Link : 'div';
        return (
          <div key={stage.id} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center" style={{ minWidth: 84 }}>
              <Wrapper {...(clickable ? { to: stage.path } : {})} title={stage.detail} className="flex flex-col items-center gap-1.5 group">
                <StageDot stage={stage} index={i} />
                <span className={cn('text-xs font-semibold transition-colors', stage.state === 'current' ? 'text-blue-700' : stage.state === 'complete' ? 'text-emerald-700' : 'text-slate-500 group-hover:text-slate-700')}>
                  {stage.label}
                </span>
              </Wrapper>
            </div>
            {i < stages.length - 1 && (
              <div className={cn('mt-3 h-0.5 flex-1 rounded-full', styles.connector)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
