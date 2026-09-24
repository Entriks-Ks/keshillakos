import api from './auth'

export type MatchIntake = {
  need: string
  audience: 'individual' | 'business'
  location: string
  cityId?: string
  categoryId?: string
  subcategoryId?: string
  serviceId?: string
  language: 'Albanian' | 'German' | 'English'
  urgency: 'today' | 'this_week' | 'flexible'
  budget?: string
  contact: 'chat' | 'phone' | 'email'
}

export function toMatchLanguage(value?: string): MatchIntake['language'] {
  if (value === 'German' || value === 'English' || value === 'Albanian') return value
  return 'Albanian'
}

export type MatchedExpert = {
  id: string
  source: 'expert' | 'service'
  providerUid: string
  providerId?: string
  name: string
  title: string
  categoryId?: string
  categoryLabel?: string
  specialty?: string
  location: string
  languages: string[]
  verified: boolean
  licenseNumber?: string
  bio?: string
  priceFrom?: number
  companyName?: string
  score: number
  rating: number
  ratingCount: number
  respondsWithin: string
  reason: string
  providerEmail?: string
  providerRole?: string
  providerRoleLabel?: string
}

export type MatchResponse = {
  intake: MatchIntake
  engine: 'gemini' | 'heuristic' | 'none'
  count: number
  matches: MatchedExpert[]
  message: string
}

export async function runMatch(intake: MatchIntake) {
  const { data } = await api.post<MatchResponse>('/api/match', intake)
  return data
}
