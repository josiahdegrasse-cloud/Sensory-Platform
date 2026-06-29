import { useState } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes.tsx";
import { AuthProvider, useAuth } from "./contexts/auth-context.tsx";
import { FoodTypeProvider } from "./contexts/food-type-context.tsx";
import { LoginPage } from "./components/login-page.tsx";
import { SignupPage } from "./components/signup-page.tsx";
import { ResetPasswordPage } from "./components/reset-password-page.tsx";
import { usePublicWorkspaceConfig } from "./lib/hooks.ts";

function AppContent() {
  const { isAuthenticated, isPasswordRecovery, loading } = useAuth();
  const { data: workspaceConfig } = usePublicWorkspaceConfig();
  const [showSignup, setShowSignup] = useState(false);
  const isPublicLegalRoute = ['/privacy', '/terms', '/panelist-consent'].includes(window.location.pathname);
  const isPublicKitRoute = window.location.pathname === '/join' || window.location.pathname.startsWith('/join/');
  const allowSelfSignup = workspaceConfig?.allowSelfSignup ?? false;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (isPasswordRecovery) return <ResetPasswordPage />;

  if (isPublicLegalRoute || isPublicKitRoute) return <RouterProvider router={router} />;

  if (!isAuthenticated) {
    if (showSignup && allowSelfSignup) {
      return <SignupPage onBack={() => setShowSignup(false)} />;
    }
    return (
      <LoginPage
        onSignup={allowSelfSignup ? () => setShowSignup(true) : undefined}
        branding={workspaceConfig ? {
          workspaceName: workspaceConfig.workspaceName,
          logoUrl: workspaceConfig.logoUrl ?? null,
          primaryColor: workspaceConfig.primaryColor ?? null,
        } : undefined}
      />
    );
  }

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <AuthProvider>
      <FoodTypeProvider>
        <AppContent />
      </FoodTypeProvider>
    </AuthProvider>
  );
}
