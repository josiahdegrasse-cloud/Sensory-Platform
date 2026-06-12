import { Link, useLocation } from 'react-router';
import { Check, Lock } from 'lucide-react';
import type { WorkflowStageState, WorkflowStageStatus } from '../lib/project-status';
import { cn } from './ui/utils';

interface JourneyItem {
  label: string;
  path: string;
  stageIds: WorkflowStageStatus['id'][];
}

const ITEMS: JourneyItem[] = [
  { label: 'Overview', path: '/project', stageIds: [] },
  { label: 'Evidence', path: '/survey-analysis', stageIds: ['data', 'testing', 'insights'] },
  { label: 'Decision', path: '/decision', stageIds: ['decision'] },
  { label: 'Concept', path: '/concept-testing', stageIds: ['concept'] },
  { label: 'Report', path: '/report', stageIds: ['report'] },
];

const STATE_PRIORITY: WorkflowStageState[] = ['current', 'needs-review', 'available', 'complete', 'not-started', 'blocked'];

function itemState(item: JourneyItem, stages: WorkflowStageStatus[]): WorkflowStageState {
  if (item.stageIds.length === 0) return 'available';
  const relevant = stages.filter(stage => item.stageIds.includes(stage.id));
  return STATE_PRIORITY.find(state => relevant.some(stage => stage.state === state)) ?? 'blocked';
}

export function ProjectJourneyNav({ stages }: { stages: WorkflowStageStatus[] }) {
  const location = useLocation();
  return (
    <nav aria-label="Project journey" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1">
        {ITEMS.map(item => {
          const state = itemState(item, stages);
          const active = location.pathname === item.path ||
            (item.label === 'Evidence' && ['/stage1', '/admin', '/survey-analysis'].includes(location.pathname));
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
              {blocked ? <span className={className} aria-disabled="true">{content}</span> : <Link to={item.path} className={className}>{content}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
