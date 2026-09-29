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
        { id: 'dashboard', label: 'Paneli administrativ', to: base },
        { id: 'settings', label: 'Cilësimet', to: `${base}/settings` },
      ]
    case 'company':
      return [
        { id: 'profile', label: 'Profili i kompanisë', to: `${base}/profile` },
        { id: 'dashboard', label: 'Paneli im', to: base },
        { id: 'offers', label: 'Ofertat e mia', to: `${base}/services` },
        { id: 'team', label: 'Ekspertët', to: `${base}/experts` },
        { id: 'messages', label: 'Mesazhet', to: `${base}/messages` },
        { id: 'settings', label: 'Cilësimet', to: `${base}/settings` },
      ]
    case 'provider':
      return [
        { id: 'profile', label: 'Profili im', to: `${base}/profile` },
        { id: 'dashboard', label: 'Paneli im', to: base },
        { id: 'offers', label: 'Ofertat e mia', to: `${base}/services` },
        { id: 'messages', label: 'Mesazhet', to: `${base}/messages` },
        { id: 'settings', label: 'Cilësimet', to: `${base}/settings` },
      ]
    case 'user':
    default:
      return [
        { id: 'profile', label: 'Profili im', to: `${base}/profile` },
        { id: 'dashboard', label: 'Paneli im', to: base },
      ]
  }
}

export function userDisplayName(user: Pick<AuthUser, 'name' | 'firstName' | 'lastName'>) {
  const full = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean).join(' ')
  return full || user.name?.trim() || ''
}
