import api from './auth'

export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'completed'
export type ContactMethod = 'chat' | 'phone' | 'email'

export type ServiceRequestItem = {
  id: string
  seekerUid: string
  seekerName: string
  seekerEmail: string
  providerUid: string
  providerName: string
  serviceId?: string
  serviceTitle?: string
  need: string
  message: string
  location?: string
  language?: string
  urgency?: string
  contactMethod: ContactMethod
  status: RequestStatus
  providerNote?: string
  slotId?: string
  requestedStartAt?: string
  requestedEndAt?: string
  createdAt: string
  updatedAt: string
}

export async function sendServiceRequest(payload: {
  providerUid: string
  providerName: string
  serviceId?: string
  serviceTitle?: string
  need: string
  message: string
  location?: string
  language?: string
  urgency?: string
  contactMethod: ContactMethod
  slotId?: string
}) {
  const { data } = await api.post<{ request: ServiceRequestItem }>('/api/requests', payload)
  return data.request
}

export async function fetchMyRequests() {
  const { data } = await api.get<{ requests: ServiceRequestItem[] }>('/api/requests/mine')
  return data.requests
}

export async function fetchRequestInbox() {
  const { data } = await api.get<{
    requests: ServiceRequestItem[]
    pendingCount: number
  }>('/api/requests/inbox')
  return data
}

export async function fetchAllRequests() {
  const { data } = await api.get<{ requests: ServiceRequestItem[] }>('/api/requests/all')
  return data.requests
}

export async function updateRequestStatus(
  id: string,
  payload: { status: RequestStatus; providerNote?: string },
) {
  const { data } = await api.patch<{ request: ServiceRequestItem }>(
    `/api/requests/${id}/status`,
    payload,
  )
  return data.request
}
