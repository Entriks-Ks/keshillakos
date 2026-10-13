import type { UserRole } from '../api/auth'
import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  CreditCard,
  CalendarDays,
  FolderKanban,
  Flag,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  MessageSquarePlus,
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
  label: 'dash.profile',
  icon: UserRound,
  section: 'account',
})

const settings = (base: string): DashNavItem => ({
  to: `${base}/settings`,
  label: 'dash.settings',
  icon: Settings,
  section: 'account',
})

export function getDashboardNav(role: UserRole): DashNavItem[] {
  switch (role) {
    case 'user':
      return [
        {
          to: '/dashboard/user',
          label: 'dash.overview',
          shortLabel: 'dash.home',
          end: true,
          icon: LayoutDashboard,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/user/requests',
          label: 'dash.myRequests',
          shortLabel: 'dash.requests',
          icon: Inbox,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/user/messages',
          label: 'dash.messages',
          shortLabel: 'dash.chat',
          icon: MessageCircle,
          mobilePrimary: true,
        },
        {
          to: '/',
          label: 'dash.findHelp',
          shortLabel: 'dash.search',
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
          label: 'dash.overview',
          shortLabel: 'dash.home',
          end: true,
          icon: LayoutDashboard,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/provider/inbox',
          label: 'dash.received',
          shortLabel: 'dash.inbox',
          icon: Inbox,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/provider/my-requests',
          label: 'dash.myRequests',
          shortLabel: 'dash.mine',
          icon: Send,
        },
        {
          to: '/dashboard/provider/messages',
          label: 'dash.messages',
          shortLabel: 'dash.chat',
          icon: MessageCircle,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/provider/plans',
          label: 'dash.plans',
          icon: CreditCard,
        },
        {
          to: '/dashboard/provider/services',
          label: 'dash.services',
          shortLabel: 'dash.offers',
          icon: Briefcase,
          mobilePrimary: true,
        },
        { to: '/dashboard/provider/availability', label: 'dash.availability', icon: CalendarDays },
        { to: '/dashboard/provider/ratings', label: 'dash.ratings', icon: Star },
        profile('/dashboard/provider'),
        settings('/dashboard/provider'),
      ]
    case 'company':
      return [
        {
          to: '/dashboard/company',
          label: 'dash.overview',
          shortLabel: 'dash.home',
          end: true,
          icon: LayoutDashboard,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/company/inbox',
          label: 'dash.received',
          shortLabel: 'dash.inbox',
          icon: Inbox,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/company/my-requests',
          label: 'dash.myRequests',
          shortLabel: 'dash.mine',
          icon: Send,
        },
        {
          to: '/dashboard/company/messages',
          label: 'dash.messages',
          shortLabel: 'dash.chat',
          icon: MessageCircle,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/company/plans',
          label: 'dash.plans',
          icon: CreditCard,
        },
        {
          to: '/dashboard/company/services',
          label: 'dash.services',
          shortLabel: 'dash.offers',
          icon: Briefcase,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/company/experts',
          label: 'dash.experts',
          shortLabel: 'dash.team',
          icon: Users,
        },
        { to: '/dashboard/company/availability', label: 'dash.availability', icon: CalendarDays },
        { to: '/dashboard/company/ratings', label: 'dash.ratings', icon: Star },
        profile('/dashboard/company'),
        settings('/dashboard/company'),
      ]
    case 'admin':
      return [
        {
          to: '/dashboard/admin',
          label: 'dash.overview',
          shortLabel: 'dash.home',
          end: true,
          icon: LayoutDashboard,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/admin/users',
          label: 'dash.users',
          shortLabel: 'dash.accounts',
          icon: Users,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/admin/requests',
          label: 'dash.allRequests',
          shortLabel: 'dash.requests',
          icon: FolderKanban,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/admin/messages',
          label: 'dash.messages',
          shortLabel: 'dash.chat',
          icon: MessageCircle,
          mobilePrimary: true,
        },
        {
          to: '/dashboard/admin/feedback',
          label: 'dash.feedback',
          icon: MessageSquarePlus,
          section: 'manage',
        },
        { to: '/dashboard/admin/reports', label: 'dash.reports', icon: Flag, section: 'manage' },
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
  main: 'dash.menu',
  manage: 'dash.platform',
  account: 'dash.account',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'role.user',
  provider: 'role.provider',
  company: 'role.company',
  admin: 'role.admin',
}

/** Dashboard context names used by the shared shell (sidebar, top bar, context switch). */
export const CONTEXT_LABELS: Record<UserRole, string> = {
  user: 'role.private',
  provider: 'role.expert',
  company: 'role.company',
  admin: 'role.admin',
}

export const ROLE_HINTS: Record<UserRole, string> = {
  user: 'role.hintUser',
  provider: 'role.hintProvider',
  company: 'role.hintCompany',
  admin: 'role.hintAdmin',
}
