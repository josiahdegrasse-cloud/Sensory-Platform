import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../contexts/auth-context';

type Role = 'panelist' | 'admin';

export function ProtectedRoute({ allowedRoles }: { allowedRoles: Role[] }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/" replace />;

  if (!allowedRoles.includes(user.role)) {
    if (user.role === 'panelist') return <Navigate to="/panelist" replace />;
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
