import api from './auth'

export type ProviderRatingStats = {
  providerUid: string
  average: number
  count: number
}

export type RatingItem = {
  id: string
  providerUid: string
  providerName: string
  raterUid: string
  raterName: string
  score: number
  comment?: string
  createdAt: string
  updatedAt: string
}

export type RateableProvider = {
  providerUid: string
  providerName: string
  titles: string[]
  average: number
  count: number
}

export async function fetchRateableProviders() {
  const { data } = await api.get<{ providers: RateableProvider[] }>('/api/ratings/providers')
  return data.providers
}

export async function fetchProviderRatings(providerUid: string) {
  const { data } = await api.get<{
    stats: ProviderRatingStats
    ratings: RatingItem[]
  }>(`/api/ratings/provider/${providerUid}`)
  return data
}

export async function submitRating(payload: {
  providerUid: string
  providerName: string
  score: number
  comment?: string
}) {
  const { data } = await api.post<{
    rating: RatingItem
    stats: ProviderRatingStats
  }>('/api/ratings', payload)
  return data
}
