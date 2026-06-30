import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardContent } from './ui/card';
import { useFoodType } from '../contexts/food-type-context';
import { parseBatchSelection, projectRoutePath } from '../lib/project-identity';
import { useImportBatches } from '../lib/hooks';
import { ProjectStatusBadge } from './project-status-badge';
import { ProjectJourneyNav } from './project-journey-nav';
import { AssignProjectControl } from './assign-project-control';
import { useProjectWorkflow } from '../lib/workflow/use-project-workflow';

/**
 * Persistent project context bar shown across the admin workflow pages
 * (/stage1, /survey-analysis, /decision, /concept-testing, future report page).
 * Shows project identity, status, and where the project sits in the workflow —
 * Also exposes the computed next action so completed stages lead directly into
 * the next required review instead of sending users back through the overview.
 */
export function ProjectHeader() {
  const { foodType, subCategory } = useFoodType();
  const importBatchId = parseBatchSelection(subCategory);
  const workflow = useProjectWorkflow(foodType, importBatchId);
  const { data: importBatches = [] } = useImportBatches();

  if (foodType === 'all' || !foodType) return null;

  // A real project (vs. a legacy/unassigned batch) is read straight off the
  // selected batch record, which now carries the project link. When a batch is
  // in scope but has no project, surface that explicitly rather than passing the
  // computed fallback name off as if it were a real project.
  const currentBatch = importBatchId ? importBatches.find(batch => batch.id === importBatchId) ?? null : null;
  const isUnassignedBatch = currentBatch != null && !currentBatch.projectId;
  const displayName = currentBatch?.projectName ?? workflow.projectName;
  const commandCenterPath = currentBatch ? projectRoutePath(currentBatch) : '/project';

  return (
    <Card className="border border-slate-200 bg-white">
      <CardContent className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Current project</p>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 truncate">
              <Link to={commandCenterPath} className="hover:text-blue-700 transition-colors" title="Open this project's command center">
                {displayName}
              </Link>
            </h2>
            {isUnassignedBatch ? (
              <ProjectStatusBadge label="No project assigned" tone="neutral" />
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{workflow.foodTypeLabel}</p>
          {isUnassignedBatch && currentBatch && (
            <div className="mt-1">
              <span className="text-xs text-amber-700">No project assigned to this batch yet.</span>
              <AssignProjectControl
                batchId={currentBatch.id}
                foodTypeId={currentBatch.foodTypeId ?? null}
                defaultName={workflow.projectName}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <ProjectJourneyNav stages={workflow.stages} projectId={currentBatch?.projectId ?? currentBatch?.id ?? null} />
          <Link
            to={workflow.nextAction.route}
            className="hidden h-9 w-44 shrink-0 items-center justify-between gap-1.5 rounded-md bg-blue-700 px-3 text-xs font-bold text-white hover:bg-blue-800 xl:flex"
            title={workflow.nextAction.description}
          >
            <span className="truncate">{workflow.nextAction.label}</span>
            <ArrowRight className="size-3.5 shrink-0" aria-hidden />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
