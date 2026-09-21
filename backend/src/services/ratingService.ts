import { Types } from 'mongoose'
import { Appointment } from '../models/Appointment'
import { Business } from '../models/Business'
import { ProviderProfile, type ProviderProfileDoc } from '../models/ProviderProfile'
import { RatingAggregate } from '../models/RatingAggregate'
import { RequestDelivery } from '../models/RequestDelivery'
import { Review, reviewIsAggregateEligible, type ReviewDoc } from '../models/Review'
import { ServiceOffer } from '../models/ServiceOffer'
import { User } from '../models/User'
import { UserRequest } from '../models/UserRequest'
import { canManageBusiness, listManagedBusinesses } from './businessService'
import { DEFAULT_PORTAL } from './domainService'
import { listMyProviderProfiles } from './providerProfileService'
import { resolvePolicyRules, resolvePolicySnapshot } from './policyService'

export type ProviderRatingStats = { providerUid: string; average: number; count: number; verifiedCount: number }
export type InteractionChoice = { kind: 'appointment' | 'request_delivery'; id: string; providerId: string }

export function isCanonicalReviewSubmission(body: { providerId?: string; businessId?: string; interactionKind?: string; interactionId?: string }) {
  return Boolean(body.interactionId && Types.ObjectId.isValid(body.interactionId)) &&
    (body.interactionKind === 'appointment' || body.interactionKind === 'request_delivery') &&
    Boolean(body.providerId) !== Boolean(body.businessId) &&
    Types.ObjectId.isValid(body.providerId || body.businessId || '')
}

export function interactionQualifies(status: string, reviewerId: string, ownerId: string) {
  return status === 'completed' && reviewerId === ownerId
}

async function reviewInteraction(reviewer: { _id: Types.ObjectId }, subjectType: 'provider' | 'business', subjectId: Types.ObjectId, kind: InteractionChoice['kind'], id: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Interaction ID i pavlefshëm')
  if (kind === 'appointment') {
    const appointment = await Appointment.findById(id)
    if (!appointment || !interactionQualifies(appointment.status, String(reviewer._id), String(appointment.user))) throw new Error('Kërkohet rezervim i përfunduar')
    const profile = await ProviderProfile.findById(appointment.providerProfile)
    if (!profile) throw new Error('Ofruesi nuk u gjet')
    if (subjectType === 'provider' && !appointment.providerProfile.equals(subjectId) || subjectType === 'business' && !appointment.business?.equals(subjectId)) throw new Error('Subjekti nuk përputhet me rezervimin')
    const request = appointment.userRequest ? await UserRequest.findById(appointment.userRequest) : null
    return { kind, ref: appointment._id, verified: true, userRequest: request?._id, category: request?.category, appointment: appointment._id, profile, portal: request?.portal || DEFAULT_PORTAL }
  }
  const delivery = await RequestDelivery.findById(id)
  if (!delivery || delivery.status !== 'completed') throw new Error('Kërkohet kërkesë e përfunduar')
  const [request, profile, linkedAppointment] = await Promise.all([
    UserRequest.findById(delivery.request), ProviderProfile.findById(delivery.providerProfile),
    Appointment.findOne({ requestDelivery: delivery._id }),
  ])
  if (!request || !profile || !interactionQualifies(delivery.status, String(reviewer._id), String(request.user))) throw new Error('Kërkesa nuk të përket')
  if (linkedAppointment) throw new Error('Përdor rezervimin e përfunduar për vlerësim')
  if (subjectType === 'provider' && !delivery.providerProfile.equals(subjectId)) throw new Error('Subjekti nuk përputhet me kërkesën')
  if (subjectType === 'business') {
    const offer = delivery.serviceOffer ? await ServiceOffer.findById(delivery.serviceOffer).select('business').lean() : null
    if (!offer?.business?.equals(subjectId)) throw new Error('Biznesi nuk lidhet me këtë ndërveprim')
  }
  return { kind, ref: delivery._id, verified: false, userRequest: request._id, category: request.category, appointment: undefined, profile, portal: request.portal }
}

async function assertNotSelfReview(reviewerId: Types.ObjectId, profile: ProviderProfileDoc | null, businessId?: Types.ObjectId) {
  if (!profile || profile.ownerUser.equals(reviewerId)) throw new Error('Nuk mund ta vlerësosh veten')
  if (businessId) {
    const business = await Business.findById(businessId)
    if (!business || business.owners.some((id) => id.equals(reviewerId)) || business.members.some((member) => member.user.equals(reviewerId))) throw new Error('Nuk mund ta vlerësosh biznesin tënd')
  }
}

export async function createReview(input: {
  reviewerUid: string; providerId?: string; businessId?: string
  interactionKind: InteractionChoice['kind']; interactionId: string
  stars: number; dimensions?: Record<string, number>; text?: string; language?: string
}) {
  if (Boolean(input.providerId) === Boolean(input.businessId)) throw new Error('Zgjidh ProviderProfile ose Business')
  const subjectType = input.providerId ? 'provider' : 'business'
  const rawId = input.providerId || input.businessId!
  if (!Types.ObjectId.isValid(rawId)) throw new Error('Subject ID i pavlefshëm')
  const subjectId = new Types.ObjectId(rawId)
  const reviewer = await User.findOne({ uid: input.reviewerUid }).select('_id').lean()
  if (!reviewer) throw new Error('Përdoruesi nuk u gjet')
  const interaction = await reviewInteraction(reviewer, subjectType, subjectId, input.interactionKind, input.interactionId)
  await assertNotSelfReview(reviewer._id, interaction.profile, subjectType === 'business' ? subjectId : undefined)
  const policySnapshot = await resolvePolicySnapshot(interaction.portal, interaction.category)
  const policy = policySnapshot.rules
  if (interaction.kind === 'appointment' && !policy.reviewEligibility.completedAppointment || interaction.kind === 'request_delivery' && !policy.reviewEligibility.completedDelivery) throw new Error('Politika nuk lejon vlerësim për këtë ndërveprim')
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) throw new Error('Vlerësimi duhet të jetë nga 1 deri në 5')
  const autoPublish = !policy.moderation.reviewRequiresApproval
  const review = await Review.create({
    reviewer: reviewer._id, subjectType, subjectId,
    providerProfile: subjectType === 'provider' ? subjectId : undefined,
    business: subjectType === 'business' ? subjectId : undefined,
    portal: interaction.portal, source: 'web',
    policy: policySnapshot.policyId, policyVersion: policySnapshot.version,
    interaction: { kind: interaction.kind, ref: interaction.ref, eligible: true, verified: interaction.verified },
    userRequest: interaction.userRequest, appointment: interaction.appointment,
    stars: input.stars, dimensions: input.dimensions ?? {}, text: input.text?.trim(), language: input.language,
    moderation: { status: autoPublish ? 'published' : 'pending' }, abuse: { status: 'clear' },
    publishedAt: autoPublish ? new Date() : undefined,
  })
  if (autoPublish) await refreshRatingAggregate(review.portal, review.subjectType, review.subjectId)
  return review
}

function dimensionEntries(dimensions: ReviewDoc['dimensions'] | Record<string, number>) {
  return dimensions instanceof Map ? [...dimensions.entries()] : Object.entries(dimensions || {})
}

export async function refreshRatingAggregate(portal: string, scope: 'provider' | 'business', subjectId: Types.ObjectId) {
  const reviews = await Review.find({ portal, subjectType: scope, subjectId, 'moderation.status': 'published', 'abuse.status': 'clear', 'interaction.eligible': true, publishedAt: { $exists: true } })
  const eligible = reviews.filter(reviewIsAggregateEligible)
  const count = eligible.length
  const average = count ? Math.round(eligible.reduce((sum, review) => sum + review.stars, 0) / count * 10) / 10 : 0
  const verifiedCount = eligible.filter((review) => review.interaction.verified).length
  const dimensions = new Map<string, { average: number; count: number }>()
  const values = new Map<string, number[]>()
  for (const review of eligible) for (const [key, value] of dimensionEntries(review.dimensions)) values.set(key, [...(values.get(key) ?? []), value])
  for (const [key, scores] of values) dimensions.set(key, { average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10, count: scores.length })
  return RatingAggregate.findOneAndUpdate({ portal, scope, subjectId }, {
    $set: { average, count, verifiedCount, dimensions, calculatedAt: new Date() },
  }, { upsert: true, new: true, setDefaultsOnInsert: true })
}

export async function moderateReview(id: string, moderatorUid: string, decision: 'published' | 'rejected', abuseStatus: 'clear' | 'flagged' | 'confirmed' = 'clear', reason?: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Review ID i pavlefshëm')
  const [review, moderator] = await Promise.all([Review.findById(id), User.findOne({ uid: moderatorUid }).select('_id').lean()])
  if (!review || !moderator) throw new Error('Vlerësimi nuk u gjet')
  if (decision === 'published' && abuseStatus !== 'clear') throw new Error('Vlerësimet e shënuara për abuzim nuk mund të publikohen')
  review.moderation = { status: decision, reviewedAt: new Date(), reviewedBy: moderator._id, reason: reason?.trim() }
  review.abuse = { status: abuseStatus, reason: abuseStatus === 'clear' ? undefined : reason?.trim() }
  review.publishedAt = decision === 'published' && abuseStatus === 'clear' ? new Date() : undefined
  await review.save()
  await refreshRatingAggregate(review.portal, review.subjectType, review.subjectId)
  return review
}

export async function respondToReview(uid: string, id: string, text: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Review ID i pavlefshëm')
  const [review, responder] = await Promise.all([Review.findById(id), User.findOne({ uid }).select('_id').lean()])
  if (!review || !responder || review.moderation.status !== 'published') throw new Error('Vlerësimi nuk u gjet')
  if (review.subjectType === 'provider') {
    const profiles = await listMyProviderProfiles(uid)
    if (!profiles.some((profile) => profile._id.equals(review.subjectId))) throw new Error('Nuk ke leje për këtë vlerësim')
  } else {
    const business = await Business.findById(review.subjectId)
    if (!business || !canManageBusiness(business, responder._id)) throw new Error('Nuk ke leje për këtë vlerësim')
  }
  review.response = { text: text.trim(), respondedBy: responder._id, respondedAt: new Date() }
  await review.save()
  return review
}

async function profilesForUid(uid: string) {
  try {
    return await listMyProviderProfiles(uid)
  } catch {
    return []
  }
}

async function businessesForUid(uid: string) {
  try {
    return await listManagedBusinesses(uid)
  } catch {
    return []
  }
}

function combinedAverage(aggregates: Array<{ average: number; count: number }>) {
  const count = aggregates.reduce((sum, item) => sum + item.count, 0)
  return count
    ? Math.round(aggregates.reduce((sum, item) => sum + item.average * item.count, 0) / count * 10) / 10
    : 0
}

export async function getProviderStats(providerUid: string): Promise<ProviderRatingStats> {
  const [profiles, businesses] = await Promise.all([profilesForUid(providerUid), businessesForUid(providerUid)])
  const aggregates = await RatingAggregate.find({
    portal: DEFAULT_PORTAL,
    $or: [
      { scope: 'provider', subjectId: { $in: profiles.map((profile) => profile._id) } },
      { scope: 'business', subjectId: { $in: businesses.map((business) => business._id) } },
    ],
  })
  const count = aggregates.reduce((sum, item) => sum + item.count, 0)
  return {
    providerUid,
    count,
    verifiedCount: aggregates.reduce((sum, item) => sum + item.verifiedCount, 0),
    average: combinedAverage(aggregates),
  }
}

export async function getStatsForProviders(providerUids: string[]) {
  const unique = [...new Set(providerUids.filter(Boolean))]
  const pairs = await Promise.all(unique.map(async (uid) => [uid, await getProviderStats(uid)] as const))
  return new Map(pairs)
}

async function toLegacyRating(review: ReviewDoc & { _id: Types.ObjectId }, providerUid: string, providerName: string) {
  const request = review.userRequest ? await UserRequest.findById(review.userRequest).select('category').lean() : null
  const policy = await resolvePolicyRules(review.portal, request?.category)
  const reviewer = policy.privacy.reviewerDisplay === 'first_name' ? await User.findById(review.reviewer).select('firstName').lean() : null
  return { id: String(review._id), providerUid, providerName, raterUid: '', raterName: reviewer?.firstName || 'Përdorues', score: review.stars, comment: review.text, verified: review.interaction.verified, response: review.response?.text, createdAt: review.createdAt, updatedAt: review.updatedAt }
}

export async function listProviderRatings(providerUid: string, limit = 20) {
  const [profiles, businesses] = await Promise.all([profilesForUid(providerUid), businessesForUid(providerUid)])
  const names = new Map([
    ...profiles.map((profile) => [String(profile._id), profile.publicProfile.displayName] as const),
    ...businesses.map((business) => [String(business._id), business.publicName] as const),
  ])
  const reviews = await Review.find({
    portal: DEFAULT_PORTAL,
    $or: [
      { subjectType: 'provider', subjectId: { $in: profiles.map((profile) => profile._id) } },
      { subjectType: 'business', subjectId: { $in: businesses.map((business) => business._id) } },
    ],
    'moderation.status': 'published',
    'abuse.status': 'clear',
    'interaction.eligible': true,
    publishedAt: { $exists: true },
  }).sort({ publishedAt: -1 }).limit(limit)
  return Promise.all(
    reviews.map((review) =>
      toLegacyRating(review, providerUid, names.get(String(review.subjectId)) || (review.subjectType === 'business' ? 'Kompani' : 'Ofrues')),
    ),
  )
}

export async function findMyRating(raterUid: string, providerUid: string) {
  const [reviewer, profiles] = await Promise.all([User.findOne({ uid: raterUid }).select('_id').lean(), profilesForUid(providerUid)])
  if (!reviewer) return null
  const review = await Review.findOne({ reviewer: reviewer._id, subjectType: 'provider', subjectId: { $in: profiles.map((profile) => profile._id) } }).sort({ createdAt: -1 })
  return review ? toLegacyRating(review, providerUid, profiles.find((profile) => profile._id.equals(review.subjectId))?.publicProfile.displayName || 'Ofrues') : null
}

export async function eligibleInteractions(uid: string, providerId?: string): Promise<InteractionChoice[]> {
  const user = await User.findOne({ uid }).select('_id').lean()
  if (!user) return []
  const appointments = await Appointment.find({ user: user._id, status: 'completed', ...(providerId ? { providerProfile: providerId } : {}) }).sort({ endAt: -1 }).limit(100)
  const requests = await UserRequest.find({ user: user._id }).select('_id').lean()
  const deliveries = await RequestDelivery.find({ request: { $in: requests.map((request) => request._id) }, status: 'completed', ...(providerId ? { providerProfile: providerId } : {}) }).sort({ respondedAt: -1 }).limit(100)
  const linkedAppointments = await Appointment.find({ requestDelivery: { $in: deliveries.map((delivery) => delivery._id) } }).select('requestDelivery').lean()
  const appointmentDeliveryIds = new Set(linkedAppointments.map((appointment) => String(appointment.requestDelivery)))
  const choices: InteractionChoice[] = [
    ...appointments.map((appointment) => ({ kind: 'appointment' as const, id: String(appointment._id), providerId: String(appointment.providerProfile) })),
    ...deliveries.filter((delivery) => !appointmentDeliveryIds.has(String(delivery._id))).map((delivery) => ({ kind: 'request_delivery' as const, id: String(delivery._id), providerId: String(delivery.providerProfile) })),
  ]
  const profiles = await ProviderProfile.find({ _id: { $in: choices.map((choice) => choice.providerId) } }).select('ownerUser').lean()
  const ownProfileIds = new Set(profiles.filter((profile) => profile.ownerUser.equals(user._id)).map((profile) => String(profile._id)))
  const reviewed = await Review.find({ reviewer: user._id, 'interaction.ref': { $in: choices.map((choice) => new Types.ObjectId(choice.id)) } }).select('interaction.ref').lean()
  const seen = new Set(reviewed.map((review) => String(review.interaction.ref)))
  return choices.filter((choice) => !seen.has(choice.id) && !ownProfileIds.has(choice.providerId))
}

export async function listRateableProviders(uid: string) {
  const interactions = await eligibleInteractions(uid)
  const profileIds = [...new Set(interactions.map((item) => item.providerId))]
  const profiles = await ProviderProfile.find({ _id: { $in: profileIds } }).select('publicProfile.displayName ownerUser')
  const users = await User.find({ _id: { $in: profiles.map((profile) => profile.ownerUser) } }).select('uid').lean()
  const uidByUser = new Map(users.map((user) => [String(user._id), user.uid]))
  const aggregateByProfile = new Map((await RatingAggregate.find({ portal: DEFAULT_PORTAL, scope: 'provider', subjectId: { $in: profileIds } })).map((item) => [String(item.subjectId), item]))
  return profiles.map((profile) => {
    const aggregate = aggregateByProfile.get(String(profile._id))
    return { providerId: String(profile._id), providerUid: uidByUser.get(String(profile.ownerUser)) || '', providerName: profile.publicProfile.displayName, titles: [], average: aggregate?.average ?? 0, count: aggregate?.count ?? 0, verifiedCount: aggregate?.verifiedCount ?? 0, interaction: interactions.find((item) => item.providerId === String(profile._id)) }
  })
}
