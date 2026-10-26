import api from './auth'

export type AiChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type RecommendedEntity = {
  id: string
  type: 'service' | 'expert' | 'category'
  title: string
  subtitle?: string
  category?: string
  location?: string
  price?: number
  rating?: number
  ratingCount?: number
  url: string
}

export type AiChatResponse = {
  reply: string
  suggestedActions: string[]
  recommendedEntities: RecommendedEntity[]
}

export type AiSuggestionTopic = {
  id: string
  label: string
  prompt: string
  icon: string
}

export type TrustFactor = {
  key: string
  title: string
  score: number
  maxScore: number
  percentage: number
  status: 'excellent' | 'good' | 'moderate' | 'pending'
  detail: string
}

export type ProviderTrustScore = {
  providerUid: string
  providerName: string
  isCompany: boolean
  overallScore: number
  safetyLevel: 'very_high' | 'high' | 'moderate' | 'needs_verification'
  safetyLabel: string
  aiSummary: string
  factors: TrustFactor[]
  highlights: string[]
  analyzedAt: string
}

export type TrustRecommendation = {
  id: string
  title: string
  impact: string
  impactPoints: number
  priority: 'critical' | 'recommended' | 'optional'
  category: 'license' | 'services' | 'experience' | 'availability' | 'reputation' | 'profile' | 'team'
  description: string
  actionLabel: string
  actionPath: string
}

export type ProviderTrustRecommendationsResponse = {
  providerUid: string
  providerName: string
  isCompany: boolean
  currentScore: number
  potentialScore: number
  potentialGain: number
  safetyLabel: string
  aiInsight: string
  recommendations: TrustRecommendation[]
  analyzedAt: string
}

export async function sendAiChatMessage(
  messages: AiChatMessage[],
  context?: { pathname?: string; location?: string; language?: string },
): Promise<AiChatResponse> {
  const { data } = await api.post<AiChatResponse>('/api/ai/chat', {
    messages,
    context,
  })
  return data
}

export async function fetchAiSuggestions(): Promise<{ topics: AiSuggestionTopic[] }> {
  const { data } = await api.get<{ topics: AiSuggestionTopic[] }>('/api/ai/suggestions')
  return data
}

export async function fetchProviderTrustScore(providerUid: string): Promise<ProviderTrustScore> {
  const { data } = await api.get<ProviderTrustScore>(`/api/ai/trust-score/${encodeURIComponent(providerUid)}`)
  return data
}

export async function fetchProviderTrustRecommendations(
  providerUid?: string,
  options?: { refresh?: boolean },
): Promise<ProviderTrustRecommendationsResponse> {
  const path = providerUid
    ? `/api/ai/trust-recommendations/${encodeURIComponent(providerUid)}`
    : '/api/ai/trust-recommendations'
  const { data } = await api.get<ProviderTrustRecommendationsResponse>(path, {
    params: options?.refresh ? { refresh: 'true' } : undefined,
  })
  return data
}
