import type { UserRole } from '../api/auth'

export function getDashboardPath(role?: UserRole | null) {
  switch (role) {
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
