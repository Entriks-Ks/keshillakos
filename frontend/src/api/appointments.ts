import { pagedItems, type PaginationMeta, type CollectionSummary } from './pagination'
import api from './auth'

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export type AppointmentItem = {
  _id: string
  user: string
  providerProfile: string
  business?: string
  serviceOffer?: string
  userRequest?: string
  requestDelivery?: string
  availabilitySlot?: string
  startAt: string
  endAt: string
  timezone: string
  mode: 'online' | 'on_site'
  status: AppointmentStatus
  createdAt: string
  updatedAt: string
}

export async function fetchMyAppointments(signal?: AbortSignal) {
  const { data } = await api.get<{ appointments: AppointmentItem[]; pagination: PaginationMeta; summary: CollectionSummary }>('/api/appointments/mine', {
    signal,
    params: { page: 1, limit: 10, upcoming: true },
  })
  return pagedItems(data.appointments, data.pagination, data.summary)
}

export async function fetchProviderAppointments(signal?: AbortSignal) {
  const { data } = await api.get<{ appointments: AppointmentItem[]; pagination: PaginationMeta; summary: CollectionSummary }>('/api/appointments/provider', {
    signal,
    params: { page: 1, limit: 10, upcoming: true },
  })
  return pagedItems(data.appointments, data.pagination, data.summary)
}

export function upcomingAppointments(appointments: AppointmentItem[], now = new Date()) {
  return appointments
    .filter(
      (item) =>
        (item.status === 'confirmed' || item.status === 'pending') &&
        new Date(item.startAt).getTime() >= now.getTime(),
    )
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
}
