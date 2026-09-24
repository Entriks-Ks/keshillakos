import api from './auth'

export type RequestStatus = 'draft' | 'open' | 'pending' | 'read' | 'accepted' | 'rejected' | 'completed' | 'withdrawn'
export type ContactMethod = 'chat' | 'phone' | 'email'

export type ServiceRequestItem = {
  id: string
  seekerUid: string
  seekerName: string
  seekerEmail: string
  providerUid?: string
  providerId?: string
  requestId?: string
  deliveryId?: string
  categoryId?: string
  budget?: { min?: number; max?: number; currency: string }
  preferredMode?: 'online' | 'on_site' | 'either'
  portal?: string
  source?: string
  sentAt?: string
  readAt?: string
  respondedAt?: string
  providerName: string
  serviceId?: string
  serviceTitle?: string
  need: string
  message: string
  location?: string
  language?: string
  urgency?: string
  contactMethod: ContactMethod
  contactPhone?: string
  contactEmail?: string
  status: RequestStatus
  providerNote?: string
  offer?: { description: string; amount?: number; currency?: string }
  slotId?: string
  requestedStartAt?: string
  requestedEndAt?: string
  createdAt: string
  updatedAt: string
}

export async function sendServiceRequest(payload: {
  providerUid: string
  providerId?: string
  providerName: string
  categoryId?: string
  serviceId?: string
  serviceTitle?: string
  need: string
  message: string
  location?: string
  language?: string
  urgency?: string
  contactMethod: ContactMethod
  contactPhone?: string
  contactEmail?: string
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
