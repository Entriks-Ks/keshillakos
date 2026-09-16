export const ROLES = ['user', 'provider', 'company', 'admin'] as const

export type UserRole = (typeof ROLES)[number]

/** Roles allowed during public registration */
export const PUBLIC_ROLES = ['user', 'provider', 'company'] as const

export type PublicRole = (typeof PUBLIC_ROLES)[number]

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function isPublicRole(value: unknown): value is PublicRole {
  return typeof value === 'string' && (PUBLIC_ROLES as readonly string[]).includes(value)
}

export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Përdorues',
  provider: 'Ofrues shërbimi',
  company: 'Kompani',
  admin: 'Admin',
}
