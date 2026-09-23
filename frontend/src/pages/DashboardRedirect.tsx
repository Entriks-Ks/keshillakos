import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath, resolveActiveContext } from '../utils/dashboardPath'

/** Redirects /dashboard → active context dashboard */
export default function DashboardRedirect() {
  const { user } = useAuth()
  return <Navigate to={getDashboardPath(resolveActiveContext(user))} replace />
}
