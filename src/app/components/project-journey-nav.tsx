import { Link, useLocation } from 'react-router';
import { Check, Lock } from 'lucide-react';
import type { WorkflowStageState, WorkflowStageStatus } from '../lib/project-status';
import { projectPath, type ProjectJourneyStep } from '../lib/project-journey-routes';
import { cn } from './ui/utils';

interface JourneyItem {
  label: string;
  path: string;
  step: ProjectJourneyStep;
  activeSteps: ProjectJourneyStep[];
  activeLegacyPaths: string[];
  stageIds: WorkflowStageStatus['id'][];
}

const ITEMS: JourneyItem[] = [
  { label: 'Overview', path: '/project', step: 'overview', activeSteps: ['overview'], activeLegacyPaths: ['/project'], stageIds: [] },
  { label: 'Evidence', path: '/survey-analysis', step: 'insights', activeSteps: ['data', 'studies', 'responses', 'insights'], activeLegacyPaths: ['/stage1', '/admin', '/survey-analysis'], stageIds: ['data', 'testing', 'insights'] },
  { label: 'Decision', path: '/decision', step: 'decision', activeSteps: ['decision'], activeLegacyPaths: ['/decision'], stageIds: ['decision'] },
  { label: 'Concept', path: '/concept-testing', step: 'concept', activeSteps: ['concept'], activeLegacyPaths: ['/concept-testing'], stageIds: ['concept'] },
  { label: 'Report', path: '/report', step: 'report', activeSteps: ['report'], activeLegacyPaths: ['/reports', '/report', '/commercialization-report'], stageIds: ['report'] },
];

const STATE_PRIORITY: WorkflowStageState[] = ['current', 'needs-review', 'available', 'complete', 'not-started', 'blocked'];

function itemState(item: JourneyItem, stages: WorkflowStageStatus[]): WorkflowStageState {
  if (item.stageIds.length === 0) return 'available';
  const relevant = stages.filter(stage => item.stageIds.includes(stage.id));
  return STATE_PRIORITY.find(state => relevant.some(stage => stage.state === state)) ?? 'blocked';
}

function scopedStepPath(projectId: string, step: ProjectJourneyStep): string {
  return step === 'overview' ? `/project/${projectId}` : `/project/${projectId}/${step}`;
}

function isActiveItem(item: JourneyItem, pathname: string, projectId?: string | null): boolean {
  if (item.activeLegacyPaths.includes(pathname)) return true;
  if (!projectId) return pathname === item.path;
  return item.activeSteps.some(step => pathname === scopedStepPath(projectId, step));
}

export function ProjectJourneyNav({ stages, projectId }: { stages: WorkflowStageStatus[]; projectId?: string | null }) {
  const location = useLocation();
  return (
    <nav aria-label="Project journey" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1">
        {ITEMS.map(item => {
          const state = itemState(item, stages);
          const path = projectId ? projectPath(projectId, item.step) : item.path;
          const active = isActiveItem(item, location.pathname, projectId);
          const blocked = state === 'blocked';
          const className = cn(
            'flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
            active ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
            blocked && 'cursor-not-allowed text-slate-300 hover:bg-transparent hover:text-slate-300',
          );
          const content = (
            <>
              {state === 'complete' && <Check className="size-3.5" aria-hidden />}
              {blocked && <Lock className="size-3" aria-hidden />}
              {item.label}
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
