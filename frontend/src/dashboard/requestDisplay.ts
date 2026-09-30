import type { RequestStatus, ServiceRequestItem } from '../api/requests'

export type ChipColor = 'default' | 'accent' | 'success' | 'warning' | 'danger'

export const REQUEST_STATUS: Record<RequestStatus, { label: string; color: ChipColor }> = {
  draft: { label: 'Draft', color: 'default' },
  open: { label: 'E hapur', color: 'warning' },
  pending: { label: 'Në pritje', color: 'warning' },
  read: { label: 'Lexuar', color: 'warning' },
  accepted: { label: 'Pranuar', color: 'success' },
  completed: { label: 'Përfunduar', color: 'accent' },
  rejected: { label: 'Refuzuar', color: 'danger' },
  withdrawn: { label: 'Tërhequr', color: 'default' },
}

export function formatWhen(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('sq-AL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function formatAmount(offer: NonNullable<ServiceRequestItem['offer']>) {
  if (offer.amount == null) return ''
  return !offer.currency || offer.currency === 'EUR' ? `€${offer.amount}` : `${offer.amount} ${offer.currency}`
}
