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
  const { data } = await api.get<{ appointments: AppointmentItem[] }>('/api/appointments/mine', {
    signal,
  })
  return data.appointments
}

export async function fetchProviderAppointments(signal?: AbortSignal) {
  const { data } = await api.get<{ appointments: AppointmentItem[] }>('/api/appointments/provider', {
    signal,
  })
  return data.appointments
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
