import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router';
import { useFoodType } from '../contexts/food-type-context';
import { encodeBatchSelection, parseBatchSelection } from '../lib/project-identity';
import { useImportBatches } from '../lib/hooks';
import {
  isProjectJourneyStep,
  projectPath,
  type ProjectJourneyStep,
} from '../lib/project-journey-routes';
import type { ImportBatchRecord } from '../lib/database';
import { AdminConfig } from './admin-config';
import { CommercializationReportPage } from './commercialization-report-page';
import { ConceptTesting } from './concept-testing';
import { ProjectCommandCenter } from './project-command-center';
import { ReportsPage } from './reports-page';
import { Stage1Instrumental } from './stage1-instrumental';
import { Stage4Enhanced } from './stage4-enhanced';
import { SurveyAnalysis } from './survey-analysis';

function LoadingProjectScope() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <div className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
    </div>
  );
}

function findProjectBatch(importBatches: ImportBatchRecord[], projectId?: string) {
  if (!projectId) return null;
  return importBatches.find(batch => batch.projectId === projectId && batch.status === 'active')
    ?? importBatches.find(batch => batch.id === projectId)
    ?? null;
}

function ProjectStepContent({ step }: { step: ProjectJourneyStep }) {
  const location = useLocation();

  switch (step) {
    case 'overview':
      return <ProjectCommandCenter />;
    case 'data':
      return <Stage1Instrumental />;
    case 'studies':
    case 'responses':
      return <AdminConfig />;
    case 'insights':
      return <SurveyAnalysis />;
    case 'decision':
      return <Stage4Enhanced />;
    case 'concept':
      return <ConceptTesting />;
    case 'report':
      return location.search.includes('report=')
        ? <CommercializationReportPage />
        : <ReportsPage />;
  }
}

export function ProjectWorkflowRoute() {
  const { projectId, step } = useParams<{ projectId: string; step?: string }>();
  const { data: importBatches = [], isLoading } = useImportBatches();
  const { subCategory, setSelection } = useFoodType();
  const batch = findProjectBatch(importBatches, projectId);
  const selectedBatchId = parseBatchSelection(subCategory);
  const journeyStep = step ?? 'overview';

  useEffect(() => {
    if (!batch || selectedBatchId === batch.id) return;
    setSelection(batch.foodTypeSlug, encodeBatchSelection(batch.id));
  }, [batch, selectedBatchId, setSelection]);

  if (!projectId) return <Navigate to="/project" replace />;
  if (!isProjectJourneyStep(journeyStep)) return <Navigate to={projectPath(projectId)} replace />;
  if (isLoading) return <LoadingProjectScope />;
  if (!batch) return <ProjectCommandCenter />;
  if (selectedBatchId !== batch.id) return <LoadingProjectScope />;

  return <ProjectStepContent step={journeyStep} />;
}
