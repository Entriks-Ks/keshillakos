import { pagedItems, type PageParams, type CollectionSummary, type PaginationMeta } from './pagination'
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

export async function fetchMyRequests(params: PageParams = {}) {
  const { data } = await api.get<{ requests: ServiceRequestItem[]; pagination: PaginationMeta; summary: CollectionSummary }>('/api/requests/mine', { params })
  return pagedItems(data.requests, data.pagination, data.summary)
}

export async function fetchRequestInbox(params: PageParams = {}) {
  const { data } = await api.get<{
    requests: ServiceRequestItem[]
    pendingCount: number
    pagination: PaginationMeta; summary: CollectionSummary
  }>('/api/requests/inbox', { params })
  return { ...data, requests: pagedItems(data.requests, data.pagination, data.summary) }
}

export async function fetchAllRequests(params: PageParams = {}) {
  const { data } = await api.get<{ requests: ServiceRequestItem[]; pagination: PaginationMeta; summary: CollectionSummary }>('/api/requests/all', { params })
  return pagedItems(data.requests, data.pagination, data.summary)
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
