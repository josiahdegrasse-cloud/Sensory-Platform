import { ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { Card, CardContent } from './ui/card';
import { useFoodType } from '../contexts/food-type-context';
import { parseBatchSelection } from '../lib/project-identity';
import { useProjectStatus } from '../lib/use-project-status';
import { useImportBatches } from '../lib/hooks';
import { ProjectStatusBadge } from './project-status-badge';
import { ProjectJourneyNav } from './project-journey-nav';
import { AssignProjectControl } from './assign-project-control';

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
  const importBatchId = parseBatchSelection(subCategory);
  const status = useProjectStatus(foodType, importBatchId);
  const { data: importBatches = [] } = useImportBatches();
  const showNextAction = status.nextAction.path !== location.pathname;

  if (foodType === 'all' || !foodType) return null;

  // A real project (vs. a legacy/unassigned batch) is read straight off the
  // selected batch record, which now carries the project link. When a batch is
  // in scope but has no project, surface that explicitly rather than passing the
  // computed fallback name off as if it were a real project.
  const currentBatch = importBatchId ? importBatches.find(batch => batch.id === importBatchId) ?? null : null;
  const isUnassignedBatch = currentBatch != null && !currentBatch.projectId;
  const displayName = currentBatch?.projectName ?? status.projectName;

  return (
    <Card className="border border-slate-200 bg-white">
      <CardContent className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Current project</p>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 truncate">
              <Link to="/project" className="hover:text-blue-700 transition-colors" title="Open this project's command center">
                {displayName}
              </Link>
            </h2>
            {isUnassignedBatch ? (
              <ProjectStatusBadge label="No project assigned" tone="neutral" />
            ) : (
              <ProjectStatusBadge label={status.statusLabel} tone={status.statusTone} />
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{status.foodTypeLabel}</p>
          {isUnassignedBatch && currentBatch && (
            <div className="mt-1">
              <span className="text-xs text-amber-700">No project assigned to this batch yet.</span>
              <AssignProjectControl
                batchId={currentBatch.id}
                foodTypeId={currentBatch.foodTypeId ?? null}
                defaultName={status.projectName}
              />
            </div>
          )}
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
