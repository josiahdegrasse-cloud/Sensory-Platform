import { ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { Card, CardContent } from './ui/card';
import { useFoodType } from '../contexts/food-type-context';
import { useProjectStatus } from '../lib/use-project-status';
import { ProjectStatusBadge } from './project-status-badge';
import { ProjectJourneyNav } from './project-journey-nav';

/**
 * Persistent project context bar shown across the admin workflow pages
 * (/stage1, /survey-analysis, /decision, /concept-testing, future report page).
 * Shows project identity, status, and where the project sits in the workflow —
 * Also exposes the computed next action so completed stages lead directly into
 * the next required review instead of sending users back through the overview.
 */
export function ProjectHeader() {
  const location = useLocation();
  const { foodType, subCategory } = useFoodType();
  const importBatchId = subCategory?.startsWith('batch:') ? subCategory.replace('batch:', '') : null;
  const status = useProjectStatus(foodType, importBatchId);
  const showNextAction = status.nextAction.path !== location.pathname;

  if (foodType === 'all' || !foodType) return null;

  return (
    <Card className="border border-slate-200 bg-white">
      <CardContent className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 truncate">
              <Link to="/project" className="hover:text-blue-700 transition-colors" title="Open this project's command center">
                {status.projectName}
              </Link>
            </h2>
            <ProjectStatusBadge label={status.statusLabel} tone={status.statusTone} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{status.foodTypeLabel}</p>
        </div>

        <div className="flex items-center gap-3">
          <ProjectJourneyNav stages={status.stages} />
          {showNextAction && (
            <Link
              to={status.nextAction.path}
              className="hidden shrink-0 items-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800 xl:flex"
              title={status.nextAction.description}
            >
              {status.nextAction.label}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
