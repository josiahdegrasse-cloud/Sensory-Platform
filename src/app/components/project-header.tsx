import { Card, CardContent } from './ui/card';
import { useFoodType } from '../contexts/food-type-context';
import { useProjectStatus } from '../lib/use-project-status';
import { ProjectStatusBadge } from './project-status-badge';
import { ProjectWorkflowProgress } from './project-workflow-progress';
import { ProjectMetrics } from './project-metrics';

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
      <CardContent className="py-4 space-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 truncate">{status.projectName}</h2>
            <ProjectStatusBadge label={status.statusLabel} tone={status.statusTone} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{status.foodTypeLabel}</p>
        </div>

        <ProjectWorkflowProgress stages={status.stages} variant="compact" />

        <ProjectMetrics status={status} />

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
