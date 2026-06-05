import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../contexts/auth-context';

type Role = 'panelist' | 'admin';

export function ProtectedRoute({ allowedRoles }: { allowedRoles: Role[] }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  if (user.status && user.status !== 'active') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">Account inactive</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your account is not active. Contact the study administrator if you need access restored.
          </p>
        </div>
      </div>
    );
  }

  if (!allowedRoles.includes(user.role)) {
    if (user.role === 'panelist') return <Navigate to="/panelist" replace />;
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
