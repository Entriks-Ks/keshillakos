import type { RequestStatus, ServiceRequestItem } from '../api/requests'
import { dateLocale } from '../i18n'

export type ChipColor = 'default' | 'accent' | 'success' | 'warning' | 'danger'

export const REQUEST_STATUS: Record<RequestStatus, { label: string; color: ChipColor }> = {
  draft: { label: 'status.draft', color: 'default' },
  open: { label: 'status.open', color: 'warning' },
  pending: { label: 'status.pending', color: 'warning' },
  read: { label: 'status.read', color: 'warning' },
  accepted: { label: 'status.accepted', color: 'success' },
  completed: { label: 'status.completed', color: 'accent' },
  rejected: { label: 'status.rejected', color: 'danger' },
  withdrawn: { label: 'status.withdrawn', color: 'default' },
}

export function formatWhen(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function formatAmount(offer: NonNullable<ServiceRequestItem['offer']>) {
  if (offer.amount == null) return ''
  return !offer.currency || offer.currency === 'EUR' ? `€${offer.amount}` : `${offer.amount} ${offer.currency}`
}
