import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Keeps the two personas apart:
 *  - `requireDoctor` routes are only for doctor accounts (others bounce to patient home).
 *  - patient routes bounce doctor accounts to the doctor home.
 */
export default function RoleRoute({ requireDoctor = false }: { requireDoctor?: boolean }) {
  const { user } = useAuth();
  const isDoctor = user?.role === 'doctor';

  if (requireDoctor && !isDoctor) return <Navigate to="/" replace />;
  if (!requireDoctor && isDoctor) return <Navigate to="/doctor" replace />;
  return <Outlet />;
}
