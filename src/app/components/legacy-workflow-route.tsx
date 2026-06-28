import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useFoodType } from '../contexts/food-type-context';
import { parseBatchSelection } from '../lib/project-identity';
import { useImportBatches } from '../lib/hooks';
import { legacyPathForProject } from '../lib/project-journey-routes';

export function LegacyWorkflowRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { subCategory } = useFoodType();
  const { data: importBatches = [] } = useImportBatches();
  const selectedBatchId = parseBatchSelection(subCategory);
  const selectedBatch = selectedBatchId
    ? importBatches.find(batch => batch.id === selectedBatchId) ?? null
    : null;
  const projectId = selectedBatch?.projectId ?? selectedBatch?.id ?? null;
  const locationState = location.state as { pendingStoragePath?: string; retestImport?: unknown } | null;
  const keepStage1Standalone = location.pathname === '/stage1' && (
    new URLSearchParams(location.search).get('new') === 'project'
    || Boolean(locationState?.pendingStoragePath)
    || Boolean(locationState?.retestImport)
  );
  const redirectTarget = projectId && !keepStage1Standalone
    ? legacyPathForProject(location.pathname, projectId, location.search)
    : null;

  if (redirectTarget) {
    return <Navigate to={redirectTarget} state={location.state} replace />;
  }

  return <>{children}</>;
}
