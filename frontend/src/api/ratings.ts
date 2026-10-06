import { pagedItems, type PageParams, type PaginationMeta } from './pagination'
import api from './auth'

export type ProviderRatingStats = {
  providerUid: string
  average: number
  count: number
  verifiedCount?: number
}

export type RatingItem = {
  id: string
  providerUid: string
  providerName: string
  raterUid: string
  raterName: string
  score: number
  comment?: string
  verified?: boolean
  response?: string
  createdAt: string
  updatedAt: string
}

export type EligibleInteraction = {
  kind: 'appointment' | 'request_delivery'
  id: string
  providerId: string
}

export type RateableProvider = {
  providerId: string
  providerUid: string
  providerName: string
  titles: string[]
  average: number
  count: number
  verifiedCount?: number
  interaction?: EligibleInteraction
}

export async function fetchRateableProviders(params: PageParams = {}) {
  const { data } = await api.get<{ providers: RateableProvider[]; pagination: PaginationMeta }>('/api/ratings/providers', { params })
  return pagedItems(data.providers, data.pagination)
}

export async function fetchEligibleByProviderUid(providerUid: string, params: PageParams = {}) {
  const { data } = await api.get<{
    interactions: EligibleInteraction[]
    pagination: PaginationMeta
    providerId: string | null
  }>(`/api/ratings/eligible-uid/${providerUid}`, { params })
  return data
}

export async function fetchProviderRatings(providerUid: string, params: PageParams = {}) {
  const { data } = await api.get<{
    stats: ProviderRatingStats
    ratings: RatingItem[]
    pagination: PaginationMeta
    buckets: Array<{ stars: number; count: number; pct: number }>
  }>(`/api/ratings/provider/${providerUid}`, { params })
  return data
}

export async function submitRating(payload: {
  providerId: string
  interactionKind: 'appointment' | 'request_delivery'
  interactionId: string
  stars: number
  text?: string
}) {
  const { data } = await api.post<{ review: { id?: string; moderation?: { status?: string } } }>('/api/ratings', {
    providerId: payload.providerId,
    interactionKind: payload.interactionKind,
    interactionId: payload.interactionId,
    stars: payload.stars,
    text: payload.text,
  })
  return data
}

export type AdminReviewItem = {
  id: string
  stars: number
  text?: string
  status: 'pending' | 'published' | 'rejected'
  subjectName: string
  reviewerName: string
  createdAt: string
}

export async function fetchModerationQueue(params: PageParams & { publishedPage?: number } = {}) {
  const { data } = await api.get<{ reviews: AdminReviewItem[]; published: AdminReviewItem[]; pagination: PaginationMeta; publishedPagination: PaginationMeta }>(
    '/api/ratings/moderation/pending', { params },
  )
  return { pending: pagedItems(data.reviews, data.pagination), published: pagedItems(data.published, data.publishedPagination) }
}

export async function moderateRating(
  id: string,
  payload: { decision: 'published' | 'rejected'; reason?: string },
) {
  const { data } = await api.patch<{ review: unknown }>(`/api/ratings/${id}/moderation`, payload)
  return data
}

export async function respondToRating(id: string, text: string) {
  const { data } = await api.patch<{ review: { response?: { text?: string } } }>(`/api/ratings/${id}/response`, {
    text,
  })
  return data
}
