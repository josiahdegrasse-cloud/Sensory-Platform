import { useState } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes.tsx";
import { AuthProvider, useAuth } from "./contexts/auth-context.tsx";
import { LoginPage } from "./components/login-page.tsx";
import { SignupPage } from "./components/signup-page.tsx";

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (showSignup) {
      return <SignupPage onBack={() => setShowSignup(false)} />;
    }
    return <LoginPage onSignup={() => setShowSignup(true)} />;
  }

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
