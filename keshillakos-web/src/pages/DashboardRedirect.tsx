import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../utils/dashboardPath'

/** Redirects /dashboard → role-specific dashboard */
export default function DashboardRedirect() {
  const { user } = useAuth()
  return <Navigate to={getDashboardPath(user?.role)} replace />
}
