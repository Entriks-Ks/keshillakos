import api from './auth'

export type SlotStatus = 'open' | 'held' | 'booked' | 'cancelled'

export type AvailabilitySlot = {
  providerId?: string
  businessId?: string
  serviceOfferId?: string
  staffUserId?: string
  resourceKey?: string
  timezone?: string
  mode?: 'online' | 'on_site'
  capacity?: number
  remainingCapacity?: number
  id: string
  providerUid: string
  providerName: string
  startAt: string
  endAt: string
  status: SlotStatus
  note?: string
  requestId?: string
  createdAt: string
  updatedAt: string
}

export type ProviderSchedule = {
  slots: AvailabilitySlot[]
  free: AvailabilitySlot[]
  busy: AvailabilitySlot[]
}

export async function fetchProviderOpenSlots(providerUid: string) {
  const { data } = await api.get<{ slots: AvailabilitySlot[] }>(
    `/api/availability/provider/${providerUid}`,
  )
  return data.slots
}

export async function fetchProviderSchedule(providerUid: string) {
  const { data } = await api.get<ProviderSchedule>(
    `/api/availability/provider/${providerUid}?view=schedule`,
  )
  return data
}

export async function fetchMyAvailability() {
  const { data } = await api.get<{ slots: AvailabilitySlot[] }>('/api/availability/mine')
  return data.slots
}

export async function createAvailabilitySlot(payload: {
  startAt: string
  endAt: string
  note?: string
  providerId?: string
  businessId?: string
  serviceOfferId?: string
  staffUserId?: string
  resourceKey?: string
  timezone?: string
  mode?: 'online' | 'on_site'
  capacity?: number
}) {
  const { data } = await api.post<{ slot: AvailabilitySlot }>('/api/availability', payload)
  return data.slot
}

export async function createAvailabilitySlotsBulk(payload: {
  slots: Array<{ startAt: string; endAt: string }>
  note?: string
  timezone?: string
  mode?: 'online' | 'on_site'
}) {
  const { data } = await api.post<{ created: AvailabilitySlot[]; skipped: number }>(
    '/api/availability/bulk',
    payload,
  )
  return data
}

export async function deleteAvailabilitySlot(id: string) {
  const { data } = await api.delete<{ deleted: boolean; id: string }>(`/api/availability/${id}`)
  return data
}

/** Ora e fillimit, p.sh. "14:00" */
export function formatSlotTime(startAt: string) {
  try {
    return new Date(startAt).toLocaleTimeString('sq-AL', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return startAt
  }
}

export function formatSlotDay(startAt: string) {
  try {
    return new Date(startAt).toLocaleDateString('sq-AL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return startAt
  }
}
