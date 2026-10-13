import type { AuthUser } from '../api/auth'
import { getDashboardPath, resolveActiveContext } from './dashboardPath.ts'

export type MarketplaceLinkId = 'services' | 'experts' | 'companies'

export type MarketplaceLink = {
  id: MarketplaceLinkId
  label: string
  to: string
}

export const MARKETPLACE_LINKS: MarketplaceLink[] = [
  { id: 'services', label: 'Shërbimet', to: '/ofertat' },
  { id: 'experts', label: 'Ekspertët', to: '/ofertat?tab=experts' },
  { id: 'companies', label: 'Kompanitë', to: '/ofertat?tab=companies' },
]

export function marketplaceLink(id: MarketplaceLinkId): MarketplaceLink {
  return MARKETPLACE_LINKS.find((link) => link.id === id) ?? { id, label: 'Shërbimet', to: '/ofertat' }
}

export function activeMarketplaceLink(pathname: string, search: string): MarketplaceLinkId | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path.startsWith('/services/')) return 'services'
  if (path !== '/ofertat') return null
  const tab = new URLSearchParams(search).get('tab')
  if (tab === 'experts') return 'experts'
  if (tab === 'companies') return 'companies'
  return 'services'
}

export type AccountMenuId =
  | 'profile'
  | 'dashboard'
  | 'offers'
  | 'team'
  | 'messages'
  | 'settings'

export type AccountMenuItem = {
  id: AccountMenuId
  label: string
  to: string
}

type MenuUser = Pick<AuthUser, 'role' | 'roles' | 'activeContext'>

export function getAccountMenu(user: MenuUser): AccountMenuItem[] {
  const context = resolveActiveContext(user)
  const base = getDashboardPath(context)

  switch (context) {
    case 'admin':
      return [
        { id: 'dashboard', label: 'menu.adminDashboard', to: base },
        { id: 'settings', label: 'menu.settings', to: `${base}/settings` },
      ]
    case 'company':
      return [
        { id: 'profile', label: 'menu.companyProfile', to: `${base}/profile` },
        { id: 'dashboard', label: 'menu.myDashboard', to: base },
        { id: 'offers', label: 'menu.myOffers', to: `${base}/services` },
        { id: 'team', label: 'menu.experts', to: `${base}/experts` },
        { id: 'messages', label: 'menu.messages', to: `${base}/messages` },
        { id: 'settings', label: 'menu.settings', to: `${base}/settings` },
      ]
    case 'provider':
      return [
        { id: 'profile', label: 'menu.myProfile', to: `${base}/profile` },
        { id: 'dashboard', label: 'menu.myDashboard', to: base },
        { id: 'offers', label: 'menu.myOffers', to: `${base}/services` },
        { id: 'messages', label: 'menu.messages', to: `${base}/messages` },
        { id: 'settings', label: 'menu.settings', to: `${base}/settings` },
      ]
    case 'user':
    default:
      return [
        { id: 'profile', label: 'menu.myProfile', to: `${base}/profile` },
        { id: 'dashboard', label: 'menu.myDashboard', to: base },
      ]
  }
}

export function userDisplayName(user: Pick<AuthUser, 'name' | 'firstName' | 'lastName'>) {
  const full = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean).join(' ')
  return full || user.name?.trim() || ''
}
