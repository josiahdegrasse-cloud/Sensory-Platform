import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { MainLayout } from "./components/main-layout";
import { ProtectedRoute } from "./components/protected-route";
import { AdminSettings } from "./components/admin-settings";
import { RouteErrorBoundary } from "./components/route-error-boundary";

const OverviewDashboard = lazy(() => import("./components/overview-dashboard").then(m => ({ default: m.OverviewDashboard })));
const ProjectCommandCenter = lazy(() => import("./components/project-command-center").then(m => ({ default: m.ProjectCommandCenter })));
const Stage1Instrumental = lazy(() => import("./components/stage1-instrumental").then(m => ({ default: m.Stage1Instrumental })));
const SurveyAnalysis = lazy(() => import("./components/survey-analysis").then(m => ({ default: m.SurveyAnalysis })));
const Stage4Enhanced = lazy(() => import("./components/stage4-enhanced").then(m => ({ default: m.Stage4Enhanced })));
const PanelistDashboard = lazy(() => import("./components/panelist-dashboard").then(m => ({ default: m.PanelistDashboard })));
const QuestionnaireDescription = lazy(() => import("./components/questionnaire-description").then(m => ({ default: m.QuestionnaireDescription })));
const QuestionnaireForm = lazy(() => import("./components/questionnaire-form").then(m => ({ default: m.QuestionnaireForm })));
const MultiSampleDescription = lazy(() => import("./components/multi-sample-description").then(m => ({ default: m.MultiSampleDescription })));
const MultiSampleQuestionnaire = lazy(() => import("./components/multi-sample-questionnaire").then(m => ({ default: m.MultiSampleQuestionnaire })));
const AdminConfig = lazy(() => import("./components/admin-config").then(m => ({ default: m.AdminConfig })));
const ConceptTesting = lazy(() => import("./components/concept-testing").then(m => ({ default: m.ConceptTesting })));
const CommercializationReportPage = lazy(() => import("./components/commercialization-report-page").then(m => ({ default: m.CommercializationReportPage })));
const ReportsPage = lazy(() => import("./components/reports-page").then(m => ({ default: m.ReportsPage })));
const ConceptSurvey = lazy(() => import("./components/concept-survey").then(m => ({ default: m.ConceptSurvey })));
const PrivacyPolicy = lazy(() => import("./components/legal-pages").then(m => ({ default: m.PrivacyPolicy })));
const TermsOfUse = lazy(() => import("./components/legal-pages").then(m => ({ default: m.TermsOfUse })));
const PanelistConsent = lazy(() => import("./components/legal-pages").then(m => ({ default: m.PanelistConsent })));
const NotFound = lazy(() => import("./components/not-found").then(m => ({ default: m.NotFound })));

const fallback = (
  <div className="min-h-screen flex items-center justify-center bg-slate-950">
    <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
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
          { path: "project", Component: ProjectCommandCenter },
          { path: "project/:batchId", Component: ProjectCommandCenter },
          { path: "stage1", Component: Stage1Instrumental },
          { path: "survey-analysis", Component: SurveyAnalysis },
          { path: "decision", Component: Stage4Enhanced },
          { path: "admin", Component: AdminConfig },
          { path: "settings", Component: AdminSettings },
          { path: "concept-testing", Component: ConceptTesting },
          { path: "reports", Component: ReportsPage },
          { path: "report", Component: CommercializationReportPage },
          { path: "commercialization-report", Component: CommercializationReportPage },
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
