export type MatchIntake = {
  need: string
  audience: 'individual' | 'business'
  location: string
  language: 'Albanian' | 'German' | 'English'
  urgency: 'today' | 'this_week' | 'flexible'
  budget?: string
  contact: 'chat' | 'phone' | 'email'
}

export type MatchCandidate = {
  id: string
  source: 'expert' | 'service'
  providerUid: string
  providerId?: string // Canonical ProviderProfile ID; providerUid remains a legacy API alias.
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
  ratingAverage?: number
  ratingCount?: number
  providerEmail?: string
  providerRole?: string
  providerRoleLabel?: string
}

export type MatchedExpert = MatchCandidate & {
  score: number
  rating: number
  ratingCount: number
  respondsWithin: string
  reason: string
}
