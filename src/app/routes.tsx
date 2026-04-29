import { createBrowserRouter } from "react-router";
import { MainLayout } from "./components/main-layout";
import { OverviewDashboard } from "./components/overview-dashboard";
import { Stage1Instrumental } from "./components/stage1-instrumental";
import { Stage2SemiTrained } from "./components/stage2-semitrained";
import { SurveyAnalysis } from "./components/survey-analysis";
import { Stage4Enhanced } from "./components/stage4-enhanced";
import { PanelistDashboard } from "./components/panelist-dashboard";
import { QuestionnaireDescription } from "./components/questionnaire-description";
import { QuestionnaireForm } from "./components/questionnaire-form";
import { MultiSampleDescription } from "./components/multi-sample-description";
import { MultiSampleQuestionnaire } from "./components/multi-sample-questionnaire";
import { DairyComparison } from "./components/dairy-comparison";
import { AdminConfig } from "./components/admin-config";
import { NotFound } from "./components/not-found";
import { ProtectedRoute } from "./components/protected-route";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainLayout,
    children: [
      // Overview: developer + admin only (panelists are redirected by MainLayout)
      {
        element: <ProtectedRoute allowedRoles={['developer', 'admin']} />,
        children: [
          { index: true, Component: OverviewDashboard },
        ],
      },

      // Developer + admin: research and analysis routes
      {
        element: <ProtectedRoute allowedRoles={['developer', 'admin']} />,
        children: [
          { path: "stage1", Component: Stage1Instrumental },
          { path: "stage2", Component: Stage2SemiTrained },
          { path: "survey-analysis", Component: SurveyAnalysis },
          { path: "decision", Component: Stage4Enhanced },
          { path: "dairy-comparison", Component: DairyComparison },
        ],
      },

      // Admin-only: configuration
      {
        element: <ProtectedRoute allowedRoles={['admin']} />,
        children: [
          { path: "admin", Component: AdminConfig },
        ],
      },

      // Panelist-only: dashboard
      {
        element: <ProtectedRoute allowedRoles={['panelist']} />,
        children: [
          { path: "panelist", Component: PanelistDashboard },
        ],
      },

      // Questionnaire routes: accessible to all authenticated roles
      { path: "questionnaire-info/:productId", Component: QuestionnaireDescription },
      { path: "questionnaire/:productId", Component: QuestionnaireForm },
      { path: "multi-sample-info/:productId", Component: MultiSampleDescription },
      { path: "multi-sample/:productId", Component: MultiSampleQuestionnaire },

      { path: "*", Component: NotFound },
    ],
  },
]);
