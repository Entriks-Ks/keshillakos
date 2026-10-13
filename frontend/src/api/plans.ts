import api from './auth'

export type PlanAudience = 'provider' | 'company'
export type PlanChoice = 'basic' | 'monthly' | 'yearly' | 'trial'

export type PlanSubscription = {
  audience: PlanAudience
  plan: 'basic' | 'pro'
  storedPlan: 'basic' | 'pro'
  interval: 'monthly' | 'yearly' | null
  status: 'active' | 'trialing' | 'expired'
  trialEndsAt: string | null
  periodEndsAt: string | null
  trialAvailable: boolean
  testMode: boolean
  stats: { visits: number; contacts: number; requests: number; clicks: number } | null
}

export async function fetchPlanCatalog() {
  const { data } = await api.get<{ testMode: boolean }>('/api/plans')
  return data
}

export async function fetchMyPlan(audience: PlanAudience) {
  const { data } = await api.get<{ subscription: PlanSubscription }>('/api/plans/mine', { params: { audience } })
  return data.subscription
}

export async function choosePlan(audience: PlanAudience, choice: PlanChoice) {
  const { data } = await api.post<{ subscription: PlanSubscription }>('/api/plans/choose', { audience, choice })
  return data.subscription
}
