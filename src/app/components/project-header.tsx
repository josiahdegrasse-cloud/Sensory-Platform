import { Link } from 'react-router';
import { Card, CardContent } from './ui/card';
import { useFoodType } from '../contexts/food-type-context';
import { useProjectStatus } from '../lib/use-project-status';
import { ProjectStatusBadge } from './project-status-badge';
import { ProjectJourneyNav } from './project-journey-nav';

/**
 * Persistent project context bar shown across the admin workflow pages
 * (/stage1, /survey-analysis, /decision, /concept-testing, future report page).
 * Shows project identity, status, and where the project sits in the workflow —
 * each page supplies its own primary action, so this stays informational only.
 */
export function ProjectHeader() {
  const { foodType, subCategory } = useFoodType();
  const importBatchId = subCategory?.startsWith('batch:') ? subCategory.replace('batch:', '') : null;
  const status = useProjectStatus(foodType, importBatchId);

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

        <ProjectJourneyNav stages={status.stages} />
      </CardContent>
    </Card>
  );
}
