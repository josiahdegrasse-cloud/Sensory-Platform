import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useFoodType } from '../contexts/food-type-context';
import { parseBatchSelection } from '../lib/project-identity';
import { useImportBatches, useProjects } from '../lib/hooks';
import { legacyPathForProject } from '../lib/project-journey-routes';
import { resolveAdminWorkflowProjectId } from '../lib/project-switcher';
import { WorkflowLoadingState, WorkflowQueryErrorState } from './workflow-loading-state';

export function LegacyWorkflowRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { subCategory } = useFoodType();
  const batchesQuery = useImportBatches();
  const projectsQuery = useProjects();
  const { data: importBatches = [] } = batchesQuery;
  const { data: projects = [] } = projectsQuery;
  const selectedBatchId = parseBatchSelection(subCategory);
  const projectId = resolveAdminWorkflowProjectId({
    selectedBatchId,
    projects,
    batches: importBatches,
  });
  const locationState = location.state as { pendingStoragePath?: string; retestImport?: unknown } | null;
  const keepStage1Standalone = location.pathname === '/stage1' && (
    new URLSearchParams(location.search).get('new') === 'project'
    || Boolean(locationState?.pendingStoragePath)
    || Boolean(locationState?.retestImport)
  );

  if (keepStage1Standalone) return <>{children}</>;

  if (!projectId && (batchesQuery.isLoading || projectsQuery.isLoading)) {
    return (
      <WorkflowLoadingState
        title="Opening project data"
        detail="Finding the first active project before loading its Data workspace."
      />
    );
  }

  if (!projectId && (batchesQuery.isError || projectsQuery.isError)) {
    return (
      <WorkflowQueryErrorState
        projectName="your active workspace"
        checked="active projects and imports"
        onRetry={() => {
          void batchesQuery.refetch();
          void projectsQuery.refetch();
        }}
      />
    );
  }

  const redirectTarget = projectId && !keepStage1Standalone
    ? legacyPathForProject(location.pathname, projectId, location.search)
    : null;

  if (redirectTarget) {
    return <Navigate to={redirectTarget} state={location.state} replace />;
  }

  return <>{children}</>;
}
