import type { UserRole } from '../api/auth'
import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  Building2,
  CalendarDays,
  FolderKanban,
  Home,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  Search,
  Settings,
  Star,
  Tags,
  UserRound,
  Users,
} from 'lucide-react'

export type DashNavItem = {
  to: string
  label: string
  end?: boolean
  icon: LucideIcon
  section?: 'main' | 'account'
}

const profile = (base: string): DashNavItem => ({
  to: `${base}/profile`,
  label: 'Profili',
  icon: UserRound,
  section: 'account',
})

const settings = (base: string): DashNavItem => ({
  to: `${base}/settings`,
  label: 'Cilësimet',
  icon: Settings,
  section: 'account',
})

export function getDashboardNav(role: UserRole): DashNavItem[] {
  switch (role) {
    case 'user':
      return [
        { to: '/dashboard/user', label: 'Përmbledhje', end: true, icon: LayoutDashboard },
        { to: '/dashboard/user/requests', label: 'Kërkesat e mia', icon: Inbox },
        { to: '/dashboard/user/messages', label: 'Mesazhet', icon: MessageCircle },
        { to: '/dashboard/user/ratings', label: 'Vlerëso ofruesit', icon: Star },
        { to: '/', label: 'Kërko ndihmë', end: true, icon: Search },
        profile('/dashboard/user'),
        settings('/dashboard/user'),
      ]
    case 'provider':
      return [
        { to: '/dashboard/provider', label: 'Përmbledhje', end: true, icon: LayoutDashboard },
        { to: '/dashboard/provider/inbox', label: 'Kërkesat', icon: Inbox },
        { to: '/dashboard/provider/messages', label: 'Mesazhet', icon: MessageCircle },
        { to: '/dashboard/provider/services', label: 'Shërbimet', icon: Briefcase },
        { to: '/dashboard/provider/availability', label: 'Disponueshmëria', icon: CalendarDays },
        { to: '/dashboard/provider/ratings', label: 'Vlerësimet', icon: Star },
        profile('/dashboard/provider'),
        settings('/dashboard/provider'),
      ]
    case 'company':
      return [
        { to: '/dashboard/company', label: 'Përmbledhje', end: true, icon: LayoutDashboard },
        { to: '/dashboard/company/inbox', label: 'Kërkesat', icon: Inbox },
        { to: '/dashboard/company/messages', label: 'Mesazhet', icon: MessageCircle },
        { to: '/dashboard/company/experts', label: 'Ekspertët', icon: Users },
        { to: '/dashboard/company/availability', label: 'Disponueshmëria', icon: CalendarDays },
        { to: '/dashboard/company/ratings', label: 'Vlerësimet', icon: Star },
        profile('/dashboard/company'),
        settings('/dashboard/company'),
      ]
    case 'admin':
      return [
        { to: '/dashboard/admin', label: 'Përmbledhje', end: true, icon: LayoutDashboard },
        { to: '/dashboard/admin/users', label: 'Përdoruesit', icon: Users },
        { to: '/dashboard/admin/requests', label: 'Të gjitha kërkesat', icon: FolderKanban },
        { to: '/dashboard/admin/inbox', label: 'Inbox', icon: Inbox },
        { to: '/dashboard/admin/messages', label: 'Mesazhet', icon: MessageCircle },
        { to: '/dashboard/admin/domains', label: 'Kategoritë', icon: Tags },
        { to: '/dashboard/admin/services', label: 'Shërbimet', icon: Briefcase },
        { to: '/dashboard/admin/availability', label: 'Disponueshmëria', icon: CalendarDays },
        { to: '/dashboard/admin/experts', label: 'Ekspertët', icon: Building2 },
        { to: '/dashboard/admin/ratings', label: 'Vlerësimet', icon: Star },
        profile('/dashboard/admin'),
        settings('/dashboard/admin'),
      ]
  }
}

export function groupDashboardNav(items: DashNavItem[]) {
  const main = items.filter((item) => item.section !== 'account')
  const account = items.filter((item) => item.section === 'account')
  return { main, account }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Përdorues',
  provider: 'Ofrues shërbimi',
  company: 'Kompani',
  admin: 'Admin',
}
