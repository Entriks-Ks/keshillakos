import { Navigate, Outlet } from 'react-router-dom'
import type { UserRole } from '../api/auth'
import { useAuth } from './AuthContext'
import { getDashboardPath } from '../utils/dashboardPath'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="page-center">
        <p className="muted">Duke u ngarkuar...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RoleRoute({ roles }: { roles: UserRole[] }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="page-center">
        <p className="muted">Duke u ngarkuar...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) {
    return <Navigate to={getDashboardPath(user.role)} replace />
  }
  return <Outlet />
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="page-center">
        <p className="muted">Duke u ngarkuar...</p>
      </div>
    )
  }

  if (user) return <Navigate to={getDashboardPath(user.role)} replace />
  return <Outlet />
}
