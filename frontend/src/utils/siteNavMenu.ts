import type { AuthUser } from '../api/auth'
import { getDashboardPath, resolveActiveContext } from './dashboardPath.ts'
import { routeKeyOf, routePath, type Locale } from '../routes/routeMap.ts'

export type MarketplaceLinkId = 'services' | 'experts' | 'companies'

export type MarketplaceLink = {
  id: MarketplaceLinkId
  /** i18n key — translate at render time. */
  label: string
  to: string
}

const MARKETPLACE_LABELS: Record<MarketplaceLinkId, string> = {
  services: 'offers.services',
  experts: 'offers.experts',
  companies: 'offers.companies',
}

/** Marketplace link in the active language: /sherbime · /en/services · /de/dienstleistungen, etc. */
export function marketplaceLink(id: MarketplaceLinkId, locale?: Locale): MarketplaceLink {
  return { id, label: MARKETPLACE_LABELS[id] ?? 'offers.services', to: routePath(id, { locale }) }
}

/** Which marketplace entry is current, for any language. Service detail pages belong to "services". */
export function activeMarketplaceLink(pathname: string): MarketplaceLinkId | null {
  const key = routeKeyOf(pathname)
  if (key === 'services' || key === 'serviceDetail') return 'services'
  if (key === 'experts' || key === 'companies') return key
  return null
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
