export const ROLES = ['user', 'provider', 'company', 'admin'] as const

export type UserRole = (typeof ROLES)[number]

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Përdorues',
  provider: 'Ofrues shërbimi',
  company: 'Kompani',
  admin: 'Admin',
}
