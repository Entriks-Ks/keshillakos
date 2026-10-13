import { Types } from 'mongoose'
import { Subscription, type SubscriptionDoc } from '../models/Subscription'
import { User } from '../models/User'
import {
  PLAN_LIMITS,
  addDays,
  effectivePlan,
  isPlanTestMode,
  type PlanAudience,
  type PlanChoice,
} from '../plans/catalog'

export class PlanError extends Error {
  status: number
  constructor(message: string, status = 402) {
    super(message)
    this.status = status
  }
}

const emptyStats = { visits: 0, contacts: 0, requests: 0, clicks: 0 }

function view(doc: SubscriptionDoc | null, audience: PlanAudience) {
  const now = new Date()
  const plan = effectivePlan(doc, now)
  return {
    audience,
    plan,
    storedPlan: doc?.plan ?? 'basic',
    interval: doc?.interval ?? null,
    status: doc?.status ?? 'active',
    trialEndsAt: doc?.trialEndsAt ?? null,
    periodEndsAt: doc?.periodEndsAt ?? null,
    trialAvailable: !doc?.trialUsed,
    testMode: isPlanTestMode(),
    stats: plan === 'pro' ? (doc?.stats ?? emptyStats) : null,
    limits: plan === 'pro'
      ? { bio: PLAN_LIMITS.proBio, photos: PLAN_LIMITS.galleryPhotos, videos: PLAN_LIMITS.videos, specialties: PLAN_LIMITS.specialties, faqs: PLAN_LIMITS.faqs, references: PLAN_LIMITS.references, qualifications: PLAN_LIMITS.qualifications }
      : { bio: PLAN_LIMITS.basicBio, photos: 0, videos: 0, specialties: 0, faqs: 0, references: 0, qualifications: 0 },
  }
}

async function load(ownerUid: string, audience: PlanAudience) {
  const doc = await Subscription.findOne({ ownerUid, audience })
  if (!doc) return null
  const now = new Date()
  let dirty = false
  if (doc.status === 'trialing' && doc.trialEndsAt && doc.trialEndsAt.getTime() <= now.getTime()) {
    doc.status = 'expired'
    dirty = true
  }
  if (doc.plan === 'pro' && doc.status === 'active' && doc.periodEndsAt && doc.periodEndsAt.getTime() <= now.getTime()) {
    doc.status = 'expired'
    dirty = true
  }
  if (dirty) await doc.save()
  return doc
}

export async function getPlan(ownerUid: string, audience: PlanAudience) {
  return view(await load(ownerUid, audience), audience)
}

export async function isPro(ownerUid: string, audience: PlanAudience) {
  return (await getPlan(ownerUid, audience)).plan === 'pro'
}

export async function assertPro(ownerUid: string, audience: PlanAudience) {
  if (!(await isPro(ownerUid, audience))) {
    throw new PlanError('Kjo kërkon planin Pro. Zgjidh Pro mujor, Pro vjetor, ose provën 14-ditore.')
  }
}

export async function choosePlan(ownerUid: string, audience: PlanAudience, choice: PlanChoice) {
  const current = (await load(ownerUid, audience)) ?? new Subscription({ ownerUid, audience, plan: 'basic', status: 'active', trialUsed: false, stats: emptyStats })
  const now = new Date()

  if (choice === 'basic') {
    current.plan = 'basic'
    current.interval = undefined
    current.status = 'active'
    current.trialEndsAt = undefined
    current.periodEndsAt = undefined
    await current.save()
    return view(current, audience)
  }

  if (choice === 'trial') {
    if (current.trialUsed) throw new PlanError('Prova 14-ditore është përdorur një herë.', 409)
    current.plan = 'pro'
    current.interval = undefined
    current.status = 'trialing'
    current.trialUsed = true
    current.trialEndsAt = addDays(now, PLAN_LIMITS.trialDays)
    current.periodEndsAt = undefined
    await current.save()
    return view(current, audience)
  }

  if (!isPlanTestMode()) {
    throw new PlanError('Pagesa nuk është e lidhur. Në development, TEST MODE aktivizon planin pa pagesë.')
  }

  current.plan = 'pro'
  current.interval = choice === 'yearly' ? 'yearly' : 'monthly'
  current.status = 'active'
  current.trialEndsAt = undefined
  current.periodEndsAt = addDays(now, choice === 'yearly' ? 365 : 30)
  await current.save()
  return view(current, audience)
}

export async function liveProUids() {
  const docs = await Subscription.find({ plan: 'pro', status: { $in: ['active', 'trialing'] } }).select('ownerUid audience trialEndsAt periodEndsAt status plan interval').lean()
  const now = new Date()
  const live = docs.filter((doc) => effectivePlan(doc, now) === 'pro')
  return {
    providers: new Set(live.filter((doc) => doc.audience === 'provider').map((doc) => doc.ownerUid)),
    companies: new Set(live.filter((doc) => doc.audience === 'company').map((doc) => doc.ownerUid)),
  }
}

export async function proOwnerIds() {
  const sets = await liveProUids()
  const live: Array<{ ownerUid: string; audience: 'provider' | 'company' }> = [
    ...[...sets.providers].map((ownerUid) => ({ ownerUid, audience: 'provider' as const })),
    ...[...sets.companies].map((ownerUid) => ({ ownerUid, audience: 'company' as const })),
  ]
  if (live.length === 0) return { providers: [] as Types.ObjectId[], companies: [] as Types.ObjectId[] }
  const users = await User.find({ uid: { $in: live.map((doc) => doc.ownerUid) } }).select('_id uid').lean()
  const idByUid = new Map(users.map((user) => [user.uid, user._id]))
  const providers: Types.ObjectId[] = []
  const companies: Types.ObjectId[] = []
  for (const doc of live) {
    const id = idByUid.get(doc.ownerUid)
    if (!id) continue
    if (doc.audience === 'company') companies.push(id)
    else providers.push(id)
  }
  return { providers, companies }
}

export async function recordPlanEvent(ownerUid: string, audience: PlanAudience, kind: keyof SubscriptionDoc['stats']) {
  if (!(await isPro(ownerUid, audience))) return
  await Subscription.updateOne(
    { ownerUid, audience },
    { $inc: { [`stats.${kind}`]: 1 } },
  )
}

export function clampBio(text: string, pro: boolean) {
  const max = pro ? PLAN_LIMITS.proBio : PLAN_LIMITS.basicBio
  return text.length > max ? text.slice(0, max) : text
}
