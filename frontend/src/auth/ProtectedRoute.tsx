import { Navigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { UserRole } from '../api/auth'
import { useAuth } from './AuthContext'
import { getDashboardPath, resolveActiveContext } from '../utils/dashboardPath'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="page-center">
        <p className="muted">{t('notifications.loading')}</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RoleRoute({ roles }: { roles: UserRole[] }) {
  const { user, loading } = useAuth()
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="page-center">
        <p className="muted">{t('notifications.loading')}</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  const userRoles = user.roles ?? ['user']
  if (!roles.some((role) => userRoles.includes(role))) {
    return <Navigate to={getDashboardPath(resolveActiveContext(user))} replace />
  }
  return <Outlet />
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth()
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="page-center">
        <p className="muted">{t('notifications.loading')}</p>
      </div>
    )
  }

  if (user) return <Navigate to={getDashboardPath(resolveActiveContext(user))} replace />
  return <Outlet />
}
