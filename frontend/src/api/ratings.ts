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

export async function fetchRateableProviders() {
  const { data } = await api.get<{ providers: RateableProvider[] }>('/api/ratings/providers')
  return data.providers
}

export async function fetchEligibleByProviderUid(providerUid: string) {
  const { data } = await api.get<{
    interactions: EligibleInteraction[]
    providerId: string | null
  }>(`/api/ratings/eligible-uid/${providerUid}`)
  return data
}

export async function fetchProviderRatings(providerUid: string) {
  const { data } = await api.get<{
    stats: ProviderRatingStats
    ratings: RatingItem[]
  }>(`/api/ratings/provider/${providerUid}`)
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

export async function fetchModerationQueue() {
  const { data } = await api.get<{ reviews: AdminReviewItem[]; published: AdminReviewItem[] }>(
    '/api/ratings/moderation/pending',
  )
  return { pending: data.reviews || [], published: data.published || [] }
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
