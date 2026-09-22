import type { UserRole } from '../api/auth'
import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  CalendarDays,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  Search,
  Send,
  Settings,
  Star,
  UserRound,
  Users,
} from 'lucide-react'

export type DashNavGroup = 'main' | 'manage' | 'account'

export type DashNavItem = {
  to: string
  label: string
  /** Short label for bottom mobile nav. */
  shortLabel?: string
  end?: boolean
  icon: LucideIcon
  section?: DashNavGroup
  /** Shown in mobile bottom bar (max ~4 per role). */
  mobilePrimary?: boolean
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
        {
          to: '/dashboard/user',
          label: 'Përmbledhje',
          shortLabel: 'Fillimi',
          end: true,
          icon: LayoutDashboard,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/user/requests',
          label: 'Kërkesat e mia',
          shortLabel: 'Kërkesat',
          icon: Inbox,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/user/messages',
          label: 'Mesazhet',
          shortLabel: 'Chat',
          icon: MessageCircle,
          mobilePrimary: true,
        },
        {
          to: '/',
          label: 'Kërko ndihmë',
          shortLabel: 'Kërko',
          end: true,
          icon: Search,
          mobilePrimary: true,
        },
        profile('/dashboard/user'),
        settings('/dashboard/user'),
      ]
    case 'provider':
      return [
        {
          to: '/dashboard/provider',
          label: 'Përmbledhje',
          shortLabel: 'Fillimi',
          end: true,
          icon: LayoutDashboard,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/provider/inbox',
          label: 'Kërkesat e marra',
          shortLabel: 'Inbox',
          icon: Inbox,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/provider/my-requests',
          label: 'Kërkesat e mia',
          shortLabel: 'Të miat',
          icon: Send,
        },
        {
          to: '/dashboard/provider/messages',
          label: 'Mesazhet',
          shortLabel: 'Chat',
          icon: MessageCircle,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/provider/services',
          label: 'Shërbimet',
          shortLabel: 'Ofertat',
          icon: Briefcase,
          mobilePrimary: true,
        },
        { to: '/dashboard/provider/availability', label: 'Disponueshmëria', icon: CalendarDays },
        { to: '/dashboard/provider/ratings', label: 'Vlerësimet', icon: Star },
        profile('/dashboard/provider'),
        settings('/dashboard/provider'),
      ]
    case 'company':
      return [
        {
          to: '/dashboard/company',
          label: 'Përmbledhje',
          shortLabel: 'Fillimi',
          end: true,
          icon: LayoutDashboard,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/company/inbox',
          label: 'Kërkesat e marra',
          shortLabel: 'Inbox',
          icon: Inbox,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/company/my-requests',
          label: 'Kërkesat e mia',
          shortLabel: 'Të miat',
          icon: Send,
        },
        {
          to: '/dashboard/company/messages',
          label: 'Mesazhet',
          shortLabel: 'Chat',
          icon: MessageCircle,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/company/experts',
          label: 'Ekspertët',
          shortLabel: 'Ekipi',
          icon: Users,
          mobilePrimary: true,
        },
        { to: '/dashboard/company/availability', label: 'Disponueshmëria', icon: CalendarDays },
        { to: '/dashboard/company/ratings', label: 'Vlerësimet', icon: Star },
        profile('/dashboard/company'),
        settings('/dashboard/company'),
      ]
    case 'admin':
      return [
        {
          to: '/dashboard/admin',
          label: 'Përmbledhje',
          shortLabel: 'Fillimi',
          end: true,
          icon: LayoutDashboard,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/admin/users',
          label: 'Përdoruesit',
          shortLabel: 'Llogaritë',
          icon: Users,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/admin/requests',
          label: 'Të gjitha kërkesat',
          shortLabel: 'Kërkesat',
          icon: FolderKanban,
          mobilePrimary: true,
        },
        { to: '/dashboard/admin/inbox', label: 'Inbox', icon: Inbox },
        {
          to: '/dashboard/admin/messages',
          label: 'Mesazhet',
          shortLabel: 'Chat',
          icon: MessageCircle,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/admin/ratings',
          label: 'Vlerësimet',
          icon: Star,
          section: 'manage',
        },
        profile('/dashboard/admin'),
        settings('/dashboard/admin'),
      ]
  }
}

export function groupDashboardNav(items: DashNavItem[]) {
  const main = items.filter((item) => !item.section || item.section === 'main')
  const manage = items.filter((item) => item.section === 'manage')
  const account = items.filter((item) => item.section === 'account')
  return { main, manage, account }
}

export function getMobilePrimaryNav(items: DashNavItem[]) {
  const primary = items.filter((item) => item.mobilePrimary)
  return primary.length > 0 ? primary.slice(0, 4) : items.slice(0, 4)
}

export const NAV_GROUP_LABELS: Record<DashNavGroup, string> = {
  main: 'Menu',
  manage: 'Platforma',
  account: 'Llogaria',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Përdorues',
  provider: 'Ofrues shërbimi',
  company: 'Kompani',
  admin: 'Admin',
}

export const ROLE_HINTS: Record<UserRole, string> = {
  user: 'Gjej ndihmë, ndiq kërkesat dhe flit me ofruesit.',
  provider: 'Prano kërkesa, menaxho ofertat dhe oraret.',
  company: 'Koordino ekipin, kërkesat dhe komunikimin.',
  admin: 'Mbikëqyr përdoruesit, kërkesat dhe vlerësimet.',
}
