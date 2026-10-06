import type { AuthUser, DashboardContext } from '../api/auth'
import { resolveActiveContext } from '../utils/dashboardPath.ts'
import type { AppNotification } from '../api/notifications'

export function notificationTarget(notification: Pick<AppNotification, 'type' | 'href'>, user: AuthUser) {
  let role = resolveActiveContext(user)
  const roles = user.roles ?? [user.role]
  if (notification.type === 'company:invitation' && roles.includes('provider')) role = 'provider'
  if (['company:invitation-accepted', 'company:invitation-rejected'].includes(notification.type) && roles.includes('company')) role = 'company'
  if (['request:new', 'request:withdrawn', 'service:review', 'review:new'].includes(notification.type) && role === 'user') {
    if (roles.includes('provider')) role = 'provider'
    else if (roles.includes('company')) role = 'company'
  }
  const base = `/dashboard/${role}`
  let href = notification.href
  if (['request:new', 'request:withdrawn'].includes(notification.type)) href = `${base}/${role === 'admin' ? 'requests' : role === 'user' ? 'requests' : 'inbox'}`
  else if (notification.type === 'request:status') href = `${base}/${role === 'user' || role === 'admin' ? 'requests' : 'my-requests'}`
  else if (notification.type === 'service:review') href = `${base}/services`
  else if (notification.type === 'review:new' && (role === 'provider' || role === 'company')) href = `${base}/ratings`
  else if (notification.type === 'profile:review') href = `${base}/profile`
  return { href, context: role !== 'admin' && role !== resolveActiveContext(user) ? role as DashboardContext : undefined }
}
