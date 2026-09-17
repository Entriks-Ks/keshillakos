import { Types } from 'mongoose'
import { Category } from '../models/Category'
import { ProviderProfile } from '../models/ProviderProfile'
import { RequestDelivery, type DeliveryStatus } from '../models/RequestDelivery'
import { Service } from '../models/Service'
import { ServiceOffer } from '../models/ServiceOffer'
import { User } from '../models/User'
import { UserRequest, type UserRequestDoc } from '../models/UserRequest'
import type { Location } from '../models/location'
import { getSlotById, holdSlotForRequest, syncSlotWithRequestStatus } from './availabilityService'
import { DEFAULT_PORTAL, findCategoryById } from './domainService'
import { listMyProviderProfiles } from './providerProfileService'
import { confirmAppointmentFromDelivery, completeAppointmentFromDelivery } from './appointmentService'

export type NewRequestInput = {
  uid: string
  categoryId?: string
  problem: string
  description: string
  location?: Location
  legacyLocation?: string
  language?: string
  budget?: UserRequestDoc['budget']
  urgency?: UserRequestDoc['urgency']
  preferredMode?: UserRequestDoc['preferredMode']
  contactPreference: UserRequestDoc['contactPreference']
  portal?: string
  source?: UserRequestDoc['source']
  providerIds?: string[]
  providerUid?: string // Compatibility input only; resolved to ProviderProfile._id.
  serviceId?: string
  slotId?: string
  draft?: boolean
}

export function canSeeDelivery(providerIds: Iterable<string>, deliveryProviderId: string, isAdmin = false) {
  return isAdmin || new Set(providerIds).has(deliveryProviderId)
}

async function resolveCategory(input: NewRequestInput) {
  const portal = input.portal || DEFAULT_PORTAL
  if (input.categoryId) return findCategoryById(input.categoryId, portal)
  if (input.serviceId && Types.ObjectId.isValid(input.serviceId)) {
    const offer = await ServiceOffer.findById(input.serviceId)
    if (offer) return Category.findOne({ _id: offer.category, portal, status: 'active' })
    const legacyService = await Service.findById(input.serviceId)
    if (legacyService) return findCategoryById(legacyService.categoryId, portal)
  }
  return findCategoryById('other', portal)
}

async function resolveProviders(input: NewRequestInput, categoryId: string) {
  const ids = [...new Set(input.providerIds ?? [])]
  if (input.providerUid && !ids.length) {
    const user = await User.findOne({ uid: input.providerUid }).select('_id').lean()
    if (!user) throw new Error('Ofruesi nuk u gjet')
    const matches = await ProviderProfile.find({ ownerUser: user._id, categories: categoryId, status: { $ne: 'suspended' } }).sort({ createdAt: 1 })
    if (matches.length !== 1) throw new Error('Zgjidh profilin e saktë të ofruesit')
    ids.push(String(matches[0]._id))
  }
  if (ids.length > 20) throw new Error('Maksimumi 20 ofrues për kërkesë')
  if (ids.some((id) => !Types.ObjectId.isValid(id))) throw new Error('ProviderProfile ID i pavlefshëm')
  const profiles = await ProviderProfile.find({ _id: { $in: ids }, status: { $ne: 'suspended' } })
  if (profiles.length !== ids.length || profiles.some((profile) => !profile.categories.includes(categoryId))) throw new Error('Ofruesi nuk e mbulon këtë kategori')
  return profiles
}

export async function createUserRequest(input: NewRequestInput) {
  const user = await User.findOne({ uid: input.uid }).select('_id').lean()
  if (!user) throw new Error('Përdoruesi nuk u gjet')
  const category = await resolveCategory(input)
  if (!category) throw new Error('Kategoria nuk ekziston')
  const profiles = input.draft ? [] : await resolveProviders(input, category.stableId)
  if (!input.draft && !profiles.length) throw new Error('Zgjidh të paktën një ofrues')
  if (profiles.some((profile) => profile.ownerUser.equals(user._id))) throw new Error('Nuk mund t’i dërgosh kërkesë vetes')
  if (input.slotId && profiles.length !== 1) throw new Error('Termini kërkon saktësisht një ofrues')
  let slot: Awaited<ReturnType<typeof getSlotById>> | null = null
  if (input.slotId) {
    slot = await getSlotById(input.slotId)
    if (!slot || slot.status !== 'open') throw new Error('Termini nuk është më i lirë')
    if (slot.providerId) {
      if (slot.providerId !== String(profiles[0]._id)) throw new Error('Termini nuk i përket këtij ofruesi')
    } else {
      const owner = await User.findById(profiles[0].ownerUser).select('uid').lean()
      if (slot.providerUid !== owner?.uid) throw new Error('Termini nuk i përket këtij ofruesi')
    }
  }
  const location = input.location ?? (input.legacyLocation?.trim() ? {
    countryCode: 'XK', cityName: input.legacyLocation.trim(), online: input.preferredMode === 'online',
  } : undefined)
  const request = await UserRequest.create({
    user: user._id, category: category._id, portal: category.portal,
    problem: input.problem, description: input.description, location,
    language: input.language, budget: input.budget,
    urgency: input.urgency ?? 'flexible', preferredMode: input.preferredMode ?? 'either',
    contactPreference: input.contactPreference, source: input.source ?? 'web',
    status: input.draft ? 'draft' : 'open',
  })
  try {
    const deliveries = await RequestDelivery.insertMany(profiles.map((profile) => ({
      request: request._id, providerProfile: profile._id, status: 'pending', sentAt: new Date(),
      slotId: slot ? input.slotId : undefined,
      requestedStartAt: slot?.startAt, requestedEndAt: slot?.endAt,
    })))
    if (slot) await holdSlotForRequest({ slotId: input.slotId!, providerUid: slot.providerUid, providerId: slot.providerId, requestId: String(deliveries[0]._id) })
    return { request, deliveries }
  } catch (err) {
    // Roll back only documents created by this operation; legacy records are never touched.
    await RequestDelivery.deleteMany({ request: request._id })
    await UserRequest.findByIdAndDelete(request._id)
    throw err
  }
}

export async function sendExistingRequest(uid: string, id: string, providerIds: string[]) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Request ID i pavlefshëm')
  const owner = await User.findOne({ uid }).select('_id').lean()
  const request = await UserRequest.findById(id)
  if (!owner || !request || !request.user.equals(owner._id)) throw new Error('Nuk ke leje për këtë kërkesë')
  if (!['draft', 'open'].includes(request.status)) throw new Error('Kërkesa nuk pranon dërgesa')
  const category = await Category.findById(request.category)
  if (!category || category.status !== 'active') throw new Error('Kategoria nuk është aktive')
  const profiles = await resolveProviders({ uid, providerIds, problem: request.problem, description: request.description, contactPreference: request.contactPreference }, category.stableId)
  if (!profiles.length || profiles.some((profile) => profile.ownerUser.equals(owner._id))) throw new Error('Ofruesit janë të pavlefshëm')
  const existing = await RequestDelivery.exists({ request: request._id, providerProfile: { $in: profiles.map((profile) => profile._id) } })
  if (existing) throw new Error('Kërkesa i është dërguar tashmë njërit prej këtyre ofruesve')
  await RequestDelivery.insertMany(profiles.map((profile) => ({ request: request._id, providerProfile: profile._id, sentAt: new Date(), status: 'pending' })))
  request.status = 'open'
  await request.save()
  return listMyUserRequests(uid)
}

export async function updateUserRequestLifecycle(uid: string, id: string, status: 'closed' | 'cancelled') {
  if (!Types.ObjectId.isValid(id)) throw new Error('Request ID i pavlefshëm')
  const owner = await User.findOne({ uid }).select('_id').lean()
  const request = await UserRequest.findById(id)
  if (!owner || !request || !request.user.equals(owner._id)) throw new Error('Nuk ke leje për këtë kërkesë')
  if (!['draft', 'open'].includes(request.status)) throw new Error('Kërkesa është mbyllur tashmë')
  if (status === 'closed' && request.status === 'draft') throw new Error('Drafti nuk mund të mbyllet')
  request.status = status
  await request.save()
  const pending = await RequestDelivery.find({ request: request._id, status: { $in: ['pending', 'read'] } })
  for (const delivery of pending) {
    delivery.status = 'withdrawn'
    await delivery.save()
    if (delivery.slotId) await syncSlotWithRequestStatus({ requestId: String(delivery._id), status: 'rejected' })
  }
  return listMyUserRequests(uid)
}

async function view(request: UserRequestDoc & { _id: Types.ObjectId }, delivery?: { _id: Types.ObjectId; providerProfile: Types.ObjectId; status: DeliveryStatus; response?: string; offer?: { description: string; amount?: number; currency?: string }; slotId?: string; requestedStartAt?: Date; requestedEndAt?: Date; sentAt: Date; readAt?: Date; respondedAt?: Date }, providerName = '') {
  const owner = await User.findById(request.user).select('uid firstName lastName email').lean()
  return {
    id: delivery ? String(delivery._id) : String(request._id), requestId: String(request._id),
    deliveryId: delivery ? String(delivery._id) : undefined,
    providerId: delivery ? String(delivery.providerProfile) : undefined,
    seekerUid: owner?.uid || '', seekerName: [owner?.firstName, owner?.lastName].filter(Boolean).join(' '), seekerEmail: owner?.email || '',
    providerName, need: request.problem, message: request.description,
    location: request.location?.cityName || '', language: request.language, urgency: request.urgency,
    contactMethod: request.contactPreference,
    status: delivery?.status || request.status, providerNote: delivery?.response, offer: delivery?.offer,
    slotId: delivery?.slotId, requestedStartAt: delivery?.requestedStartAt?.toISOString(), requestedEndAt: delivery?.requestedEndAt?.toISOString(),
    sentAt: delivery?.sentAt, readAt: delivery?.readAt, respondedAt: delivery?.respondedAt,
    categoryId: String(request.category), budget: request.budget, preferredMode: request.preferredMode,
    portal: request.portal, source: request.source, createdAt: request.createdAt, updatedAt: request.updatedAt,
  }
}

async function viewsForRequests(requests: Array<UserRequestDoc & { _id: Types.ObjectId }>, providerFilter?: Set<string>) {
  const deliveries = await RequestDelivery.find({ request: { $in: requests.map((request) => request._id) } }).sort({ sentAt: -1 })
  const filtered = providerFilter ? deliveries.filter((delivery) => providerFilter.has(String(delivery.providerProfile))) : deliveries
  const profiles = await ProviderProfile.find({ _id: { $in: filtered.map((delivery) => delivery.providerProfile) } }).select('publicProfile.displayName')
  const names = new Map(profiles.map((profile) => [String(profile._id), profile.publicProfile.displayName]))
  const byRequest = new Map<string, typeof filtered>()
  for (const delivery of filtered) byRequest.set(String(delivery.request), [...(byRequest.get(String(delivery.request)) ?? []), delivery])
  const output = []
  for (const request of requests) {
    const rows = byRequest.get(String(request._id)) ?? []
    if (!rows.length && !providerFilter) output.push(await view(request))
    for (const delivery of rows) output.push(await view(request, delivery, names.get(String(delivery.providerProfile))))
  }
  return output
}

export async function listMyUserRequests(uid: string) {
  const owner = await User.findOne({ uid }).select('_id').lean()
  if (!owner) return []
  return viewsForRequests(await UserRequest.find({ user: owner._id }).sort({ createdAt: -1 }).limit(100))
}

export async function listProviderDeliveries(uid: string) {
  const profiles = await listMyProviderProfiles(uid)
  const ids = profiles.map((profile) => profile._id)
  const deliveries = await RequestDelivery.find({ providerProfile: { $in: ids } }).sort({ sentAt: -1 }).limit(100)
  const requests = await UserRequest.find({ _id: { $in: deliveries.map((delivery) => delivery.request) } })
  const byId = new Map(requests.map((request) => [String(request._id), request]))
  const names = new Map(profiles.map((profile) => [String(profile._id), profile.publicProfile.displayName]))
  const output = []
  for (const delivery of deliveries) {
    const request = byId.get(String(delivery.request))
    if (request) output.push(await view(request, delivery, names.get(String(delivery.providerProfile))))
  }
  return output
}

export async function listAllUserRequests() {
  return viewsForRequests(await UserRequest.find().sort({ createdAt: -1 }).limit(100))
}

export async function updateDeliveryStatus(uid: string, id: string, status: DeliveryStatus, response?: string, isAdmin = false, offer?: { description: string; amount?: number; currency?: string }) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Delivery ID i pavlefshëm')
  const delivery = await RequestDelivery.findById(id)
  if (!delivery) throw new Error('Dërgesa nuk u gjet')
  const profiles = isAdmin ? [] : await listMyProviderProfiles(uid)
  if (!canSeeDelivery(profiles.map((profile) => String(profile._id)), String(delivery.providerProfile), isAdmin)) throw new Error('Nuk ke leje për këtë dërgesë')
  const request = await UserRequest.findById(delivery.request)
  if (!request || request.status !== 'open') throw new Error('Kërkesa nuk është aktive')
  if (status === 'withdrawn') throw new Error('Vetëm kërkuesi mund ta tërheqë dërgesën')

  const allowed: Record<DeliveryStatus, DeliveryStatus[]> = {
    pending: ['read', 'accepted', 'rejected', 'completed'],
    read: ['accepted', 'rejected', 'completed'],
    accepted: ['completed'],
    rejected: [],
    completed: [],
    withdrawn: [],
  }
  if (status !== delivery.status && !allowed[delivery.status].includes(status)) {
    throw new Error(
      delivery.status === 'accepted'
        ? 'Kërkesa e pranuar mund vetëm të përfundojë'
        : 'Kjo dërgesë nuk mund të ndryshohet më',
    )
  }

  if (delivery.slotId && status === 'accepted') await confirmAppointmentFromDelivery(String(delivery._id))
  if (delivery.slotId && status === 'completed') await completeAppointmentFromDelivery(String(delivery._id))
  delivery.status = status
  if (status === 'read' && !delivery.readAt) delivery.readAt = new Date()
  if (['accepted', 'rejected', 'completed'].includes(status)) delivery.respondedAt = new Date()
  if (response !== undefined) delivery.response = response.trim()
  if (offer !== undefined) delivery.offer = offer
  await delivery.save()
  if (delivery.slotId && ['rejected', 'pending'].includes(status)) await syncSlotWithRequestStatus({ requestId: String(delivery._id), status: status as 'rejected' | 'pending' })
  const profile = await ProviderProfile.findById(delivery.providerProfile).select('publicProfile.displayName')
  return view(request, delivery, profile?.publicProfile.displayName)
}

/** Klienti konfirmon që bashkëpunimi me ofruesin ka përfunduar (accepted → completed). */
export async function completeDeliveryAsSeeker(uid: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Delivery ID i pavlefshëm')
  const delivery = await RequestDelivery.findById(id)
  if (!delivery) throw new Error('Dërgesa nuk u gjet')
  const owner = await User.findOne({ uid }).select('_id').lean()
  const request = await UserRequest.findById(delivery.request)
  if (!owner || !request || !request.user.equals(owner._id)) throw new Error('Nuk ke leje për këtë kërkesë')
  if (request.status !== 'open') throw new Error('Kërkesa nuk është aktive')
  if (delivery.status === 'completed') {
    const profile = await ProviderProfile.findById(delivery.providerProfile).select('publicProfile.displayName')
    return view(request, delivery, profile?.publicProfile.displayName)
  }
  if (delivery.status !== 'accepted') {
    throw new Error('Vetëm kërkesat e pranuara mund të shënohen si të përfunduara')
  }
  if (delivery.slotId) await completeAppointmentFromDelivery(String(delivery._id))
  delivery.status = 'completed'
  delivery.respondedAt = delivery.respondedAt || new Date()
  await delivery.save()
  const profile = await ProviderProfile.findById(delivery.providerProfile).select('publicProfile.displayName')
  return view(request, delivery, profile?.publicProfile.displayName)
}

export async function countPendingDeliveries(uid: string) {
  const profiles = await listMyProviderProfiles(uid)
  return RequestDelivery.countDocuments({ providerProfile: { $in: profiles.map((profile) => profile._id) }, status: 'pending' })
}
