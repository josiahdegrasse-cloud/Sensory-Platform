import { Link, useLocation } from 'react-router';
import { Check, Lock } from 'lucide-react';
import { projectPath, type ProjectJourneyStep } from '../lib/project-journey-routes';
import { workflowStatusLabel } from '../lib/workflow/workflow-actions';
import type { WorkflowStageId, WorkflowStageStatus, WorkflowStageSummary } from '../lib/workflow/workflow-types';
import { cn } from './ui/utils';

interface JourneyItem {
  label: string;
  step: ProjectJourneyStep;
  legacyPaths: string[];
  stageId?: WorkflowStageId;
}

const ITEMS: JourneyItem[] = [
  { label: 'Overview', step: 'overview', legacyPaths: ['/project'] },
  { label: 'Data', step: 'data', legacyPaths: ['/stage1'], stageId: 'data' },
  { label: 'Studies', step: 'studies', legacyPaths: ['/admin', '/responses'], stageId: 'studies' },
  { label: 'Insights', step: 'insights', legacyPaths: ['/survey-analysis'], stageId: 'insights' },
  { label: 'Decision', step: 'decision', legacyPaths: ['/decision'], stageId: 'decision' },
  { label: 'Concept', step: 'concept', legacyPaths: ['/concept-testing'], stageId: 'concept' },
  { label: 'Report', step: 'report', legacyPaths: ['/reports', '/report', '/commercialization-report'], stageId: 'report' },
];

function scopedStepPath(projectId: string, step: ProjectJourneyStep): string {
  return step === 'overview' ? '/' : `/project/${projectId}/${step}`;
}

function isActiveItem(item: JourneyItem, pathname: string, projectId?: string | null): boolean {
  if (item.legacyPaths.includes(pathname)) return true;
  if (!projectId) return pathname === (item.step === 'overview' ? '/project' : `/${item.step}`);
  return pathname === scopedStepPath(projectId, item.step);
}

function isBlocked(status?: WorkflowStageStatus) {
  return status === 'blocked';
}

export function ProjectJourneyNav({ stages, projectId }: { stages: WorkflowStageSummary[]; projectId?: string | null }) {
  const location = useLocation();
  return (
    <nav aria-label="Project journey" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1">
        {ITEMS.map(item => {
          const stage = item.stageId ? stages.find(candidate => candidate.id === item.stageId) : null;
          const path = item.step === 'overview'
            ? '/'
            : projectId
              ? projectPath(projectId, item.step)
              : stage?.nextActionRoute ?? `/${item.step}`;
          const active = isActiveItem(item, location.pathname, projectId);
          const blocked = isBlocked(stage?.status);
          const className = cn(
            'flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
            active ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
            blocked && 'cursor-not-allowed text-slate-300 hover:bg-transparent hover:text-slate-300',
          );
          const content = (
            <>
              {stage?.status === 'complete' && <Check className="size-3.5" aria-hidden />}
              {blocked && <Lock className="size-3" aria-hidden />}
              <span>{item.label}</span>
              {stage && <span className="sr-only">: {workflowStatusLabel(stage.status)}</span>}
            </>
          );
          return (
            <li key={item.label}>
              {blocked ? <span className={className} aria-disabled="true">{content}</span> : <Link to={path} className={className}>{content}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
