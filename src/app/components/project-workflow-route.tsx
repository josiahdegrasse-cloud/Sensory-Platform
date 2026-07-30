import { lazy, Suspense, useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router';
import { useFoodType } from '../contexts/food-type-context';
import {
  encodeBatchSelection,
  resolveProjectRouteScope,
  selectionMatchesProjectScope,
} from '../lib/project-identity';
import { useImportBatches, useProjects } from '../lib/hooks';
import {
  isProjectJourneyStep,
  projectPath,
  type ProjectJourneyStep,
} from '../lib/project-journey-routes';
const CommercializationReportPage = lazy(() => import('./commercialization-report-page').then(module => ({
  default: module.CommercializationReportPage,
})));
const ConceptTesting = lazy(() => import('./concept-testing').then(module => ({
  default: module.ConceptTesting,
})));
const ProjectCommandCenter = lazy(() => import('./project-command-center').then(module => ({
  default: module.ProjectCommandCenter,
})));
const ReportsPage = lazy(() => import('./reports-page').then(module => ({
  default: module.ReportsPage,
})));
const Stage1Instrumental = lazy(() => import('./stage1-instrumental').then(module => ({
  default: module.Stage1Instrumental,
})));
const Stage4Enhanced = lazy(() => import('./stage4-enhanced').then(module => ({
  default: module.Stage4Enhanced,
})));
const StudiesWorkspace = lazy(() => import('./studies-workspace').then(module => ({
  default: module.StudiesWorkspace,
})));
const ShipOutsWorkspace = lazy(() => import('./ship-outs-workspace').then(module => ({
  default: module.ShipOutsWorkspace,
})));
const SurveyAnalysis = lazy(() => import('./survey-analysis').then(module => ({
  default: module.SurveyAnalysis,
})));
const FormulationExperimentWorkspace = lazy(() => import('./formulation-experiment-workspace').then(module => ({
  default: module.FormulationExperimentWorkspace,
})));

function LoadingProjectScope() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <div className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
    </div>
  );
}

function ProjectStepContent({ step, substep }: { step: ProjectJourneyStep; substep?: string }) {
  const location = useLocation();

  switch (step) {
    case 'overview':
      return <ProjectCommandCenter />;
    case 'data':
      return <Stage1Instrumental />;
    case 'studies':
      return substep === 'ship-outs' ? <ShipOutsWorkspace /> : <StudiesWorkspace />;
    case 'insights':
      return <SurveyAnalysis />;
    case 'decision':
      return substep === 'experiments' ? <FormulationExperimentWorkspace /> : <Stage4Enhanced />;
    case 'concept':
      return <ConceptTesting />;
    case 'report':
      return /[?&](report|decision|create)=/.test(location.search)
        ? <CommercializationReportPage />
        : <ReportsPage />;
  }
}

export function ProjectWorkflowRoute() {
  const { projectId, step, substep } = useParams<{ projectId: string; step?: string; substep?: string }>();
  const { data: importBatches = [], isLoading: batchesLoading } = useImportBatches();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { foodType, subCategory, setSelection } = useFoodType();
  const scope = resolveProjectRouteScope(projectId, projects, importBatches);
  const journeyStep = step ?? 'overview';

  useEffect(() => {
    if (!scope?.selectedBatch || selectionMatchesProjectScope(foodType, subCategory, scope)) return;
    setSelection(scope.foodTypeSlug, encodeBatchSelection(scope.selectedBatch.id));
  }, [foodType, scope, setSelection, subCategory]);

  if (!projectId) return <Navigate to="/" replace />;
  if (!isProjectJourneyStep(journeyStep)) return <Navigate to={projectPath(projectId)} replace />;
  if (
    substep
    && !(
      (journeyStep === 'studies' && substep === 'ship-outs')
      || (journeyStep === 'decision' && substep === 'experiments')
    )
  ) {
    return <Navigate to={projectPath(projectId, journeyStep)} replace />;
  }
  if (journeyStep === 'responses') return <Navigate to={projectPath(projectId, 'studies')} replace />;
  if (batchesLoading || projectsLoading) return <LoadingProjectScope />;
  if (!scope?.selectedBatch || !scope.foodTypeSlug) return <Navigate to="/" replace />;
  if (!selectionMatchesProjectScope(foodType, subCategory, scope)) return <LoadingProjectScope />;

  return (
    <Suspense fallback={<LoadingProjectScope />}>
      <ProjectStepContent step={journeyStep} substep={substep} />
    </Suspense>
  );
}
