import { Types } from 'mongoose'
import { Business } from '../models/Business'
import { Category } from '../models/Category'
import { ProviderProfile } from '../models/ProviderProfile'
import { ServiceOffer, type ServiceOfferDoc } from '../models/ServiceOffer'
import { User } from '../models/User'
import type { Location } from '../models/location'
import { validateExtensions } from './categoryConfiguration'
import { canManageBusiness, userIdForUid } from './businessService'
import { DEFAULT_PORTAL, findCategoryById } from './domainService'
import { listMyProviderProfiles } from './providerProfileService'

export type CreateServiceOfferInput = {
  ownerUid: string
  providerId: string
  portal?: string
  categoryId: string
  name: string
  subtitle?: string
  description: string
  price: ServiceOfferDoc['price']
  durationMinutes?: number
  formats?: ServiceOfferDoc['formats']
  modes?: ServiceOfferDoc['modes']
  languages?: string[]
  serviceAreas?: Location[]
  availabilityMode?: ServiceOfferDoc['availabilityMode']
  visibility?: ServiceOfferDoc['visibility']
  extensions?: Record<string, unknown>
  allowCategoryExpansion?: boolean // Only for legacy service form compatibility.
}

async function managedProfile(ownerUid: string, providerId: string) {
  if (!Types.ObjectId.isValid(providerId)) throw new Error('Provider ID i pavlefshëm')
  const userId = await userIdForUid(ownerUid)
  const profile = await ProviderProfile.findById(providerId)
  if (!profile || profile.status === 'suspended') throw new Error('Profili nuk u gjet')
  const business = profile.business ? await Business.findById(profile.business) : null
  if (!profile.ownerUser.equals(userId) && (!business || !canManageBusiness(business, userId))) {
    throw new Error('Nuk ke leje për këtë profil')
  }
  if (business && ['suspended', 'closed'].includes(business.status)) throw new Error('Biznesi nuk është aktiv')
  return profile
}

export async function createServiceOffer(input: CreateServiceOfferInput) {
  const portal = input.portal || DEFAULT_PORTAL
  const [profile, category] = await Promise.all([
    managedProfile(input.ownerUid, input.providerId),
    findCategoryById(input.categoryId, portal),
  ])
  if (!category) throw new Error('Kategoria nuk ekziston')
  if (!profile.categories.includes(category.stableId)) {
    if (!input.allowCategoryExpansion) throw new Error('Profili nuk e mbulon këtë kategori')
    profile.categories.push(category.stableId)
    profile.status = 'pending'
    profile.moderation = { status: 'pending' }
    await profile.save()
  }
  const extensions = validateExtensions(category.extensionFields, input.extensions)
  return ServiceOffer.create({
    portal, providerProfile: profile._id, business: profile.business,
    category: category._id, categoryVersion: category.version,
    name: input.name.trim(), subtitle: input.subtitle?.trim(), description: input.description.trim(),
    price: input.price, durationMinutes: input.durationMinutes,
    formats: input.formats ?? [], modes: input.modes ?? [],
    languages: input.languages?.map((value) => value.trim()).filter(Boolean) ?? [],
    serviceAreas: input.serviceAreas ?? [],
    availabilityMode: input.availabilityMode ?? 'request',
    visibility: input.visibility ?? 'public',
    extensions, status: 'pending', moderation: { status: 'pending' },
  })
}

export async function listMyServiceOffers(uid: string) {
  const profiles = await listMyProviderProfiles(uid)
  return ServiceOffer.find({ providerProfile: { $in: profiles.map((profile) => profile._id) } }).sort({ createdAt: -1 })
}

export async function listPublishedServiceOffers() {
  const offers = await ServiceOffer.find({ status: 'published', visibility: 'public', 'moderation.status': 'approved' })
    .sort({ updatedAt: -1 }).limit(50)
  const [profiles, categories, businesses] = await Promise.all([
    ProviderProfile.find({ _id: { $in: offers.map((offer) => offer.providerProfile) }, status: 'published', 'moderation.status': 'approved' }).select('_id'),
    Category.find({ _id: { $in: offers.map((offer) => offer.category) }, status: 'active' }).select('_id'),
    Business.find({ _id: { $in: offers.map((offer) => offer.business).filter(Boolean) }, status: 'active' }).select('_id'),
  ])
  const profileIds = new Set(profiles.map((profile) => String(profile._id)))
  const categoryIds = new Set(categories.map((category) => String(category._id)))
  const businessIds = new Set(businesses.map((business) => String(business._id)))
  return offers.filter((offer) => profileIds.has(String(offer.providerProfile)) && categoryIds.has(String(offer.category)) && (!offer.business || businessIds.has(String(offer.business))))
}

export function toPublicServiceOffer(offer: ServiceOfferDoc & { _id: Types.ObjectId }) {
  const extensions = { ...offer.extensions }
  delete extensions.licenseNumber
  return {
    id: String(offer._id), portal: offer.portal,
    providerId: String(offer.providerProfile),
    businessId: offer.business ? String(offer.business) : undefined,
    categoryId: String(offer.category), categoryVersion: offer.categoryVersion,
    name: offer.name, subtitle: offer.subtitle, description: offer.description,
    price: offer.price, durationMinutes: offer.durationMinutes,
    formats: offer.formats, modes: offer.modes, languages: offer.languages,
    serviceAreas: offer.serviceAreas, availabilityMode: offer.availabilityMode,
    extensions, updatedAt: offer.updatedAt,
  }
}

export async function reviewServiceOffer(id: string, reviewerUid: string, decision: 'approved' | 'rejected') {
  if (!Types.ObjectId.isValid(id)) throw new Error('Service ID i pavlefshëm')
  const reviewer = await userIdForUid(reviewerUid)
  const offer = await ServiceOffer.findById(id)
  if (!offer) throw new Error('Shërbimi nuk u gjet')
  if (decision === 'approved') {
    const [profile, category, business] = await Promise.all([
      ProviderProfile.findById(offer.providerProfile), Category.findById(offer.category),
      offer.business ? Business.findById(offer.business) : Promise.resolve(null),
    ])
    if (profile?.status !== 'published' || profile.moderation.status !== 'approved' || category?.status !== 'active' || (offer.business && business?.status !== 'active')) {
      throw new Error('Profili, biznesi dhe kategoria duhet të jenë aktive')
    }
  }
  offer.status = decision === 'approved' ? 'published' : 'draft'
  offer.moderation = { status: decision, reviewedAt: new Date(), reviewedBy: reviewer }
  await offer.save()
  return offer
}

export async function updateServiceOffer(uid: string, id: string, changes: Partial<Pick<ServiceOfferDoc,
  'name' | 'subtitle' | 'description' | 'price' | 'durationMinutes' | 'formats' | 'modes' | 'languages' | 'serviceAreas' | 'availabilityMode' | 'visibility' | 'extensions'>>) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Service ID i pavlefshëm')
  const offer = await ServiceOffer.findById(id)
  if (!offer) throw new Error('Shërbimi nuk u gjet')
  await managedProfile(uid, String(offer.providerProfile))
  const category = await Category.findById(offer.category)
  if (!category) throw new Error('Kategoria nuk u gjet')
  for (const key of ['name', 'subtitle', 'description', 'price', 'durationMinutes', 'formats', 'modes', 'languages', 'serviceAreas', 'availabilityMode', 'visibility'] as const) {
    if (changes[key] !== undefined) offer.set(key, changes[key])
  }
  if (changes.extensions !== undefined) offer.extensions = validateExtensions(category.extensionFields, changes.extensions)
  offer.categoryVersion = category.version
  offer.status = 'pending'
  offer.moderation = { status: 'pending' }
  await offer.save()
  return offer
}

export async function offersToLegacyServices(offers: ServiceOfferDoc[], publicOnly = false) {
  const [profiles, categories, businesses] = await Promise.all([
    ProviderProfile.find({ _id: { $in: offers.map((offer) => offer.providerProfile) } }),
    Category.find({ _id: { $in: offers.map((offer) => offer.category) } }),
    Business.find({ _id: { $in: offers.map((offer) => offer.business).filter(Boolean) } }).select('publicName'),
  ])
  const profileById = new Map(profiles.map((profile) => [String(profile._id), profile]))
  const categoryById = new Map(categories.map((category) => [String(category._id), category]))
  const businessById = new Map(businesses.map((business) => [String(business._id), business]))
  const users = await User.find({ _id: { $in: profiles.map((profile) => profile.ownerUser) } }).select('uid').lean()
  const uidById = new Map(users.map((user) => [String(user._id), user.uid]))
  return offers.map((offer) => {
    const profile = profileById.get(String(offer.providerProfile))
    const category = categoryById.get(String(offer.category))
    const business = offer.business ? businessById.get(String(offer.business)) : undefined
    const uid = profile ? uidById.get(String(profile.ownerUser)) || '' : ''
    const providerName = profile?.publicProfile.displayName || business?.publicName || ''
    const extensions = { ...offer.extensions }
    if (publicOnly) delete extensions.licenseNumber
    const area = offer.serviceAreas[0]?.cityName || (offer.modes.includes('online') ? 'Online' : '')
    return {
      id: String((offer as ServiceOfferDoc & { _id: Types.ObjectId })._id),
      serviceOfferId: String((offer as ServiceOfferDoc & { _id: Types.ObjectId })._id),
      providerId: String(offer.providerProfile), businessId: offer.business ? String(offer.business) : undefined,
      title: offer.name, description: offer.description,
      categoryId: category?.stableId || '', categoryLabel: category?.labels.get('sq') || '', category: category?.labels.get('sq') || '',
      subcategory: offer.subtitle || '', location: area,
      priceFrom: offer.price.amountFrom, details: extensions,
      providerUid: uid, providerName,
      provider: { uid, name: providerName, email: profile?.publicProfile.publicEmail || '', role: profile?.providerType === 'business' ? 'company' : 'provider', roleLabel: 'Ofrues', headline: profile?.publicProfile.title || '', bio: profile?.publicProfile.description || '', location: area, skills: [], languages: profile?.languages || [], profilePhoto: profile?.publicProfile.photoUrl || '', ratingAverage: 0, ratingCount: 0 },
      active: offer.status === 'published' && offer.moderation.status === 'approved',
      createdAt: offer.createdAt,
    }
  })
}
