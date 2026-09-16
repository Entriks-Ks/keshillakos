import type { UserRole } from '../api/auth'

export type DashNavItem = {
  to: string
  label: string
  end?: boolean
}

const sharedProfile = (base: string): DashNavItem => ({
  to: `${base}/profile`,
  label: 'Profili',
})

const sharedSettings = (base: string): DashNavItem => ({
  to: `${base}/settings`,
  label: 'Cilësimet',
})

export function getDashboardNav(role: UserRole): DashNavItem[] {
  switch (role) {
    case 'user':
      return [
        { to: '/dashboard/user', label: 'Përmbledhje', end: true },
        { to: '/dashboard/user/requests', label: 'Kërkesat e mia' },
        { to: '/dashboard/user/messages', label: 'Mesazhet' },
        { to: '/dashboard/user/ratings', label: 'Vlerëso ofruesit' },
        { to: '/', label: 'Kërko ndihmë', end: true },
        sharedProfile('/dashboard/user'),
        sharedSettings('/dashboard/user'),
      ]
    case 'provider':
      return [
        { to: '/dashboard/provider', label: 'Përmbledhje', end: true },
        { to: '/dashboard/provider/inbox', label: 'Kërkesat' },
        { to: '/dashboard/provider/messages', label: 'Mesazhet' },
        { to: '/dashboard/provider/services', label: 'Shërbimet' },
        { to: '/dashboard/provider/availability', label: 'Disponueshmëria' },
        { to: '/dashboard/provider/ratings', label: 'Vlerësimet' },
        sharedProfile('/dashboard/provider'),
        sharedSettings('/dashboard/provider'),
      ]
    case 'company':
      return [
        { to: '/dashboard/company', label: 'Përmbledhje', end: true },
        { to: '/dashboard/company/inbox', label: 'Kërkesat' },
        { to: '/dashboard/company/messages', label: 'Mesazhet' },
        { to: '/dashboard/company/experts', label: 'Ekspertët' },
        { to: '/dashboard/company/availability', label: 'Disponueshmëria' },
        { to: '/dashboard/company/ratings', label: 'Vlerësimet' },
        sharedProfile('/dashboard/company'),
        sharedSettings('/dashboard/company'),
      ]
    case 'admin':
      return [
        { to: '/dashboard/admin', label: 'Përmbledhje', end: true },
        { to: '/dashboard/admin/users', label: 'Përdoruesit' },
        { to: '/dashboard/admin/requests', label: 'Të gjitha kërkesat' },
        { to: '/dashboard/admin/inbox', label: 'Inbox' },
        { to: '/dashboard/admin/messages', label: 'Mesazhet' },
        { to: '/dashboard/admin/domains', label: 'Kategoritë' },
        { to: '/dashboard/admin/services', label: 'Shërbimet' },
        { to: '/dashboard/admin/availability', label: 'Disponueshmëria' },
        { to: '/dashboard/admin/experts', label: 'Ekspertët' },
        { to: '/dashboard/admin/ratings', label: 'Vlerësimet' },
        sharedProfile('/dashboard/admin'),
        sharedSettings('/dashboard/admin'),
      ]
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Përdorues',
  provider: 'Ofrues shërbimi',
  company: 'Kompani',
  admin: 'Admin',
}
