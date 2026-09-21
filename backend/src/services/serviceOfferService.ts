import { Types } from 'mongoose'
import { Business } from '../models/Business'
import { Category } from '../models/Category'
import { ProviderProfile } from '../models/ProviderProfile'
import { City } from '../models/City'
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
  photos?: string[]
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
  }

  // Marketplace MVP: publish profile + offer so services appear on home immediately.
  // Admin can still suspend later via moderation endpoints.
  if (profile.status !== 'suspended') {
    profile.status = 'published'
    profile.moderation = { status: 'approved', reviewedAt: new Date() }
  }
  await profile.save()

  // Heal earlier posts that stayed pending under the old moderation flow.
  await ServiceOffer.updateMany(
    {
      providerProfile: profile._id,
      visibility: 'public',
      $or: [{ status: 'pending' }, { 'moderation.status': 'pending' }],
    },
    {
      $set: {
        status: 'published',
        moderation: { status: 'approved', reviewedAt: new Date() },
      },
    },
  )

  const extensions = validateExtensions(category.extensionFields, input.extensions)
  const visibility = input.visibility ?? 'public'
  return ServiceOffer.create({
    portal, providerProfile: profile._id, business: profile.business,
    category: category._id, categoryVersion: category.version,
    name: input.name.trim(), subtitle: input.subtitle?.trim(), description: input.description.trim(),
    price: input.price, durationMinutes: input.durationMinutes,
    formats: input.formats ?? [], modes: input.modes ?? [],
    languages: input.languages?.map((value) => value.trim()).filter(Boolean) ?? [],
    serviceAreas: input.serviceAreas ?? [],
    photos: (input.photos ?? []).filter((value) => typeof value === 'string' && value.startsWith('/uploads/')).slice(0, 8),
    availabilityMode: input.availabilityMode ?? 'request',
    visibility,
    extensions,
    status: visibility === 'public' ? 'published' : 'draft',
    moderation: {
      status: visibility === 'public' ? 'approved' : 'pending',
      reviewedAt: visibility === 'public' ? new Date() : undefined,
    },
  })
}

export async function listMyServiceOffers(uid: string) {
  const profiles = await listMyProviderProfiles(uid)
  return ServiceOffer.find({ providerProfile: { $in: profiles.map((profile) => profile._id) } }).sort({ createdAt: -1 })
}

export async function listPublishedServiceOffers(providerIds?: Types.ObjectId[]) {
  const offers = await ServiceOffer.find({
    status: 'published', visibility: 'public', 'moderation.status': 'approved',
    ...(providerIds ? { providerProfile: { $in: providerIds } } : {}),
  }).sort({ updatedAt: -1 }).limit(providerIds ? 0 : 50)
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
  'name' | 'subtitle' | 'description' | 'price' | 'durationMinutes' | 'formats' | 'modes' | 'languages' | 'serviceAreas' | 'photos' | 'availabilityMode' | 'visibility' | 'extensions'>> & { categoryId?: string }) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Service ID i pavlefshëm')
  const offer = await ServiceOffer.findById(id)
  if (!offer) throw new Error('Shërbimi nuk u gjet')
  await managedProfile(uid, String(offer.providerProfile))
  if (changes.categoryId) {
    const nextCategory = await findCategoryById(changes.categoryId, offer.portal)
    if (!nextCategory) throw new Error('Kategoria nuk ekziston')
    offer.category = nextCategory._id
    offer.categoryVersion = nextCategory.version
  }
  const category = await Category.findById(offer.category)
  if (!category) throw new Error('Kategoria nuk u gjet')
  for (const key of ['name', 'subtitle', 'description', 'price', 'durationMinutes', 'formats', 'modes', 'languages', 'serviceAreas', 'availabilityMode', 'visibility'] as const) {
    if (changes[key] !== undefined) offer.set(key, changes[key])
  }
  if (changes.photos !== undefined) {
    offer.photos = [...new Set(changes.photos.filter((value) => typeof value === 'string' && value.startsWith('/uploads/')))].slice(0, 8)
  }
  if (changes.extensions !== undefined) offer.extensions = validateExtensions(category.extensionFields, changes.extensions)
  offer.categoryVersion = category.version
  if (offer.visibility === 'public') {
    offer.status = 'published'
    offer.moderation = { status: 'approved', reviewedAt: new Date() }
  }
  await offer.save()
  return offer
}

export async function deleteServiceOffer(uid: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Service ID i pavlefshëm')
  const offer = await ServiceOffer.findById(id)
  if (!offer) throw new Error('Shërbimi nuk u gjet')
  await managedProfile(uid, String(offer.providerProfile))
  await offer.deleteOne()
  return { deleted: true, id }
}

export async function offersToLegacyServices(offers: ServiceOfferDoc[], publicOnly = false) {
  const [profiles, categories, businesses] = await Promise.all([
    ProviderProfile.find({ _id: { $in: offers.map((offer) => offer.providerProfile) } }),
    Category.find({ _id: { $in: offers.map((offer) => offer.category) } }),
    Business.find({ _id: { $in: offers.map((offer) => offer.business).filter(Boolean) } }).select('publicName'),
  ])
  const profileById = new Map(profiles.map((profile) => [String(profile._id), profile]))
  const cityIds = profiles.flatMap((profile) => [profile.location?.cityId, ...profile.serviceAreaCityIds].filter((id): id is Types.ObjectId => Boolean(id)))
  const cities = cityIds.length ? await City.find({ _id: { $in: cityIds } }).select('name.sq').lean() : []
  const cityNameById = new Map(cities.map((city) => [String(city._id), city.name.sq]))
  const categoryById = new Map(categories.map((category) => [String(category._id), category]))
  const businessById = new Map(businesses.map((business) => [String(business._id), business]))
  const users = await User.find({ _id: { $in: profiles.map((profile) => profile.ownerUser) } }).select('uid profilePhoto headline bio skills languages').lean()
  const ownerById = new Map(users.map((user) => [String(user._id), user]))
  return offers.map((offer) => {
    const profile = profileById.get(String(offer.providerProfile))
    const category = categoryById.get(String(offer.category))
    const business = offer.business ? businessById.get(String(offer.business)) : undefined
    const owner = profile ? ownerById.get(String(profile.ownerUser)) : undefined
    const uid = owner?.uid || ''
    const providerName = profile?.publicProfile.displayName || business?.publicName || ''
    const extensions = { ...offer.extensions }
    if (publicOnly) delete extensions.licenseNumber
    if (offer.photos?.length) extensions.photos = offer.photos
    const area = offer.serviceAreas[0]?.cityName || (profile?.serviceAreaCityIds[0] && cityNameById.get(String(profile.serviceAreaCityIds[0]))) ||
      (profile?.location?.cityId && cityNameById.get(String(profile.location.cityId))) || (offer.modes.includes('online') ? 'Online' : '')
    return {
      id: String((offer as ServiceOfferDoc & { _id: Types.ObjectId })._id),
      serviceOfferId: String((offer as ServiceOfferDoc & { _id: Types.ObjectId })._id),
      providerId: String(offer.providerProfile), businessId: offer.business ? String(offer.business) : undefined,
      title: offer.name, description: offer.description,
      categoryId: category?.stableId || '', categoryLabel: category?.labels.get('sq') || '', category: category?.labels.get('sq') || '',
      subcategory: offer.subtitle || '', location: area,
      priceFrom: offer.price.amountFrom, details: extensions,
      providerUid: uid, providerName,
      provider: {
        uid, name: providerName, email: profile?.publicProfile.publicEmail || '',
        role: profile?.providerType === 'business' ? 'company' : 'provider', roleLabel: 'Ofrues',
        headline: profile?.publicProfile.title || owner?.headline || '', bio: profile?.publicProfile.description || owner?.bio || '',
        location: area, skills: owner?.skills || [], languages: profile?.languages?.length ? profile.languages : owner?.languages || [],
        profilePhoto: profile?.publicProfile.photoUrl || owner?.profilePhoto || '',
        ratingAverage: 0, ratingCount: 0,
      },
      active: offer.status === 'published' && offer.moderation.status === 'approved',
      createdAt: offer.createdAt,
    }
  })
}
