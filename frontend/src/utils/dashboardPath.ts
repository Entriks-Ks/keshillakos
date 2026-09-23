import type { DashboardContext, UserRole } from '../api/auth'

export function getDashboardPath(roleOrContext?: UserRole | DashboardContext | null) {
  switch (roleOrContext) {
    case 'provider':
      return '/dashboard/provider'
    case 'company':
      return '/dashboard/company'
    case 'admin':
      return '/dashboard/admin'
    case 'user':
    default:
      return '/dashboard/user'
  }
}

export function resolveActiveContext(user?: {
  role?: UserRole | null
  roles?: UserRole[] | null
  activeContext?: DashboardContext | null
} | null): DashboardContext | 'admin' {
  if (!user) return 'user'
  const roles = user.roles ?? (user.role ? [user.role] : ['user'])
  if (roles.includes('admin') && user.role === 'admin') return 'admin'
  const context = user.activeContext
  if (context === 'provider' && roles.includes('provider')) return 'provider'
  if (context === 'company' && roles.includes('company')) return 'company'
  if (context === 'user') return 'user'
  return 'user'
}
