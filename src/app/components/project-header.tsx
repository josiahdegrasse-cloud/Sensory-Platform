import { Link } from 'react-router';
import { ArrowRight, ClipboardList, Gauge, GitMerge } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { useFoodType } from '../contexts/food-type-context';
import { useProjectStatus } from '../lib/use-project-status';
import { ProjectStatusBadge, toneSolidClasses } from './project-status-badge';
import { ProjectWorkflowProgress } from './project-workflow-progress';

/**
 * Persistent project context bar shown across the admin workflow pages
 * (/stage1, /survey-analysis, /decision, /concept-testing, future report page).
 * Gives a single, continuously-updated answer to "what am I working on, where
 * is it in the journey, and what should I do next?"
 */
export function ProjectHeader() {
  const { foodType, subCategory } = useFoodType();
  const importBatchId = subCategory?.startsWith('batch:') ? subCategory.replace('batch:', '') : null;
  const status = useProjectStatus(foodType, importBatchId);

  if (foodType === 'all' || !foodType) return null;

  return (
    <Card className="border border-slate-200 bg-white">
      <CardContent className="py-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 truncate">{status.projectName}</h2>
              <ProjectStatusBadge label={status.statusLabel} tone={status.statusTone} />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {status.foodTypeLabel}
              {status.responseTarget > 0 && (
                <>
                  {' · '}
                  <span className="inline-flex items-center gap-1"><ClipboardList className="size-3" /> Responses {status.responseCompleted}/{status.responseTarget}</span>
                </>
              )}
              {status.issfScore !== null && (
                <>
                  {' · '}
                  <span className="inline-flex items-center gap-1"><Gauge className="size-3" /> ISSF {status.issfScore.toFixed(0)}</span>
                </>
              )}
              {' · '}
              <span className="inline-flex items-center gap-1"><GitMerge className="size-3" /> Decision: {status.decisionStatus}</span>
            </p>
          </div>

          <Link
            to={status.nextAction.path}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors hover:opacity-90 ${toneSolidClasses(status.nextAction.tone)}`}
          >
            <span className="text-left">
              <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80">Next</span>
              <span>{status.nextAction.label}</span>
            </span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <ProjectWorkflowProgress stages={status.stages} variant="compact" />

        {status.warnings.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {status.warnings.map(warning => (
              <ProjectStatusBadge key={warning} label={warning} tone="warning" className="font-medium" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
