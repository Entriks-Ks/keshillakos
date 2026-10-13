export const PLAN_LIMITS = {
  basicBio: 250,
  proBio: 2000,
  galleryPhotos: 10,
  videos: 1,
  specialties: 10,
  faqs: 10,
  references: 5,
  qualifications: 10,
  trialDays: 14,
  monthlyPrice: 19.9,
  yearlyPrice: 199,
} as const

export type PlanAudience = 'provider' | 'company'
export type PlanChoice = 'basic' | 'monthly' | 'yearly' | 'trial'

export function isPlanTestMode() {
  return process.env.NODE_ENV !== 'production' || process.env.PLAN_TEST_MODE === 'true'
}

export function addDays(from: Date, days: number) {
  const next = new Date(from)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export type PlanSnapshot = {
  plan: 'basic' | 'pro'
  interval?: 'monthly' | 'yearly'
  status: 'active' | 'trialing' | 'expired'
  trialEndsAt?: Date | null
  periodEndsAt?: Date | null
}

/** Effective public plan. Expired Pro stays stored; callers must not delete profile data. */
export function effectivePlan(snapshot: PlanSnapshot | null | undefined, now = new Date()): 'basic' | 'pro' {
  if (!snapshot || snapshot.plan !== 'pro') return 'basic'
  if (snapshot.status === 'trialing') {
    return snapshot.trialEndsAt && snapshot.trialEndsAt.getTime() > now.getTime() ? 'pro' : 'basic'
  }
  if (snapshot.status === 'expired') return 'basic'
  if (snapshot.periodEndsAt && snapshot.periodEndsAt.getTime() <= now.getTime()) return 'basic'
  return snapshot.status === 'active' ? 'pro' : 'basic'
}
