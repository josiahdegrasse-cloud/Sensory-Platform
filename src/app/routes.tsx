import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { MainLayout } from "./components/main-layout";
import { ProtectedRoute } from "./components/protected-route";
import { AdminSettings } from "./components/admin-settings";
import { RouteErrorBoundary } from "./components/route-error-boundary";
import { LegacyWorkflowRoute } from "./components/legacy-workflow-route";

const OverviewDashboard = lazy(() => import("./components/overview-dashboard").then(m => ({ default: m.OverviewDashboard })));
const ProjectWorkflowRoute = lazy(() => import("./components/project-workflow-route").then(m => ({ default: m.ProjectWorkflowRoute })));
const Stage1Instrumental = lazy(() => import("./components/stage1-instrumental").then(m => ({ default: m.Stage1Instrumental })));
const SurveyAnalysis = lazy(() => import("./components/survey-analysis").then(m => ({ default: m.SurveyAnalysis })));
const Stage4Enhanced = lazy(() => import("./components/stage4-enhanced").then(m => ({ default: m.Stage4Enhanced })));
const PanelistDashboard = lazy(() => import("./components/panelist-dashboard").then(m => ({ default: m.PanelistDashboard })));
const PanelistProfileSetupPage = lazy(() => import("./components/panelist-profile-setup-page").then(m => ({ default: m.PanelistProfileSetupPage })));
const QuestionnaireDescription = lazy(() => import("./components/questionnaire-description").then(m => ({ default: m.QuestionnaireDescription })));
const QuestionnaireForm = lazy(() => import("./components/questionnaire-form").then(m => ({ default: m.QuestionnaireForm })));
const MultiSampleDescription = lazy(() => import("./components/multi-sample-description").then(m => ({ default: m.MultiSampleDescription })));
const MultiSampleQuestionnaire = lazy(() => import("./components/multi-sample-questionnaire").then(m => ({ default: m.MultiSampleQuestionnaire })));
const AdminConfig = lazy(() => import("./components/admin-config").then(m => ({ default: m.AdminConfig })));
const ConceptTesting = lazy(() => import("./components/concept-testing").then(m => ({ default: m.ConceptTesting })));
const CommercializationReportPage = lazy(() => import("./components/commercialization-report-page").then(m => ({ default: m.CommercializationReportPage })));
const ReportsPage = lazy(() => import("./components/reports-page").then(m => ({ default: m.ReportsPage })));
const LiteratureLibraryPage = lazy(() => import("./components/literature-library-page").then(m => ({ default: m.LiteratureLibraryPage })));
const ConceptSurvey = lazy(() => import("./components/concept-survey").then(m => ({ default: m.ConceptSurvey })));
const PrivacyPolicy = lazy(() => import("./components/legal-pages").then(m => ({ default: m.PrivacyPolicy })));
const TermsOfUse = lazy(() => import("./components/legal-pages").then(m => ({ default: m.TermsOfUse })));
const PanelistConsent = lazy(() => import("./components/legal-pages").then(m => ({ default: m.PanelistConsent })));
const PanelistKitJoinPage = lazy(() => import("./components/panelist-kit-join-page").then(m => ({ default: m.PanelistKitJoinPage })));
const NotFound = lazy(() => import("./components/not-found").then(m => ({ default: m.NotFound })));

const fallback = (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-slate-700 animate-spin" />
  </div>
);

export const router = createBrowserRouter([
  {
    path: "/privacy",
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={fallback}>
        <PrivacyPolicy />
      </Suspense>
    ),
  },
  {
    path: "/terms",
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={fallback}>
        <TermsOfUse />
      </Suspense>
    ),
  },
  {
    path: "/panelist-consent",
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={fallback}>
        <PanelistConsent />
      </Suspense>
    ),
  },
  {
    path: "/join",
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={fallback}>
        <PanelistKitJoinPage />
      </Suspense>
    ),
  },
  {
    path: "/join/:token",
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={fallback}>
        <PanelistKitJoinPage />
      </Suspense>
    ),
  },
  {
    path: "/",
    Component: MainLayout,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: (
          <Suspense fallback={fallback}>
            <ProtectedRoute allowedRoles={['admin']} />
          </Suspense>
        ),
        children: [
          { index: true, Component: OverviewDashboard },
          { path: "project", element: <Navigate to="/" replace /> },
          { path: "project/:projectId", Component: ProjectWorkflowRoute },
          { path: "project/:projectId/:step", Component: ProjectWorkflowRoute },
          { path: "project/:projectId/:step/:substep", Component: ProjectWorkflowRoute },
          { path: "stage1", element: <LegacyWorkflowRoute><Stage1Instrumental /></LegacyWorkflowRoute> },
          { path: "survey-analysis", element: <LegacyWorkflowRoute><SurveyAnalysis /></LegacyWorkflowRoute> },
          { path: "decision", element: <LegacyWorkflowRoute><Stage4Enhanced /></LegacyWorkflowRoute> },
          { path: "admin", element: <AdminConfig mode="admin" /> },
          { path: "responses", element: <Navigate to="/admin" replace /> },
          { path: "settings", Component: AdminSettings },
          { path: "concept-testing", element: <LegacyWorkflowRoute><ConceptTesting /></LegacyWorkflowRoute> },
          { path: "reports", element: <LegacyWorkflowRoute><ReportsPage /></LegacyWorkflowRoute> },
          { path: "literature", Component: LiteratureLibraryPage },
          { path: "report", element: <LegacyWorkflowRoute><CommercializationReportPage /></LegacyWorkflowRoute> },
          { path: "commercialization-report", element: <LegacyWorkflowRoute><CommercializationReportPage /></LegacyWorkflowRoute> },
        ],
      },
      {
        element: (
          <Suspense fallback={fallback}>
            <ProtectedRoute allowedRoles={['panelist']} />
          </Suspense>
        ),
        children: [
          { path: "panelist", Component: PanelistDashboard },
          { path: "panelist/profile", Component: PanelistProfileSetupPage },
        ],
      },
      {
        element: (
          <Suspense fallback={fallback}>
            <ProtectedRoute allowedRoles={['panelist', 'admin']} />
          </Suspense>
        ),
        children: [
          { path: "concept-survey/:conceptId", Component: ConceptSurvey },
          { path: "questionnaire-info/:productId", Component: QuestionnaireDescription },
          { path: "questionnaire/:productId", Component: QuestionnaireForm },
          { path: "multi-sample-info/:productId", Component: MultiSampleDescription },
          { path: "multi-sample/:productId", Component: MultiSampleQuestionnaire },
        ],
      },
      { path: "*", Component: NotFound },
    ],
  },
]);
