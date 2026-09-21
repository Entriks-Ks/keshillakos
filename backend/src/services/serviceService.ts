import mongoose, { Types } from 'mongoose'
import { Category } from '../models/Category'
import { City } from '../models/City'
import { Country } from '../models/Country'
import { ProviderProfile } from '../models/ProviderProfile'
import { Service, type ServiceDetails, type ServiceDoc } from '../models/Service'
import { ServiceOffer } from '../models/ServiceOffer'
import { Subcategory } from '../models/Subcategory'
import { User } from '../models/User'
import { validateExtensions } from './categoryConfiguration'
import { findDomainById } from './domainService'
import { createProviderProfile } from './providerProfileService'
import { createServiceOffer, deleteServiceOffer, listMyServiceOffers, listPublishedServiceOffers, offersToLegacyServices, updateServiceOffer } from './serviceOfferService'
import { getProvidersPublicDetails, type ProviderPublicDetails } from './providerPublicService'

export type CreateServiceInput = {
  title: string
  description: string
  categoryId: string
  subcategory: string
  location: string
  priceFrom?: number
  details?: ServiceDetails
  providerUid: string // Legacy API account lookup only.
  providerName: string
  providerId?: string
}

export type ServiceDiscoveryFilters = {
  cityId?: string
  categoryId?: string
  subcategoryId?: string
  serviceId?: string
  q?: string
}

function normalized(value?: string | null) {
  return (value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function filterDiscoveredServices<T extends {
  id: string; categoryId: string; categoryLabel: string; subcategory: string
  title: string; description: string; providerName: string
}>(services: T[], filters: Omit<ServiceDiscoveryFilters, 'cityId' | 'subcategoryId'> & { subcategoryNames?: string[] }) {
  const category = normalized(filters.categoryId || '')
  const names = filters.subcategoryNames?.map(normalized) ?? []
  const query = normalized(filters.q || '')
  return services.filter((service) => {
    if (filters.serviceId && service.id !== filters.serviceId) return false
    if (category && ![service.categoryId, service.categoryLabel].some((value) => normalized(value) === category)) return false
    if (names.length && !names.includes(normalized(service.subcategory))) return false
    if (query && !normalized([service.title, service.description, service.subcategory, service.categoryLabel, service.providerName].join(' ')).includes(query)) return false
    return true
  })
}

export async function isActiveDiscoveryCity(cityId: string) {
  if (!Types.ObjectId.isValid(cityId)) throw new Error('City ID i pavlefshëm')
  const city = await City.findOne({ _id: cityId, isActive: true }).select('countryId').lean()
  return Boolean(city && await Country.exists({ _id: city.countryId, isActive: true }))
}

function legacyService(doc: ServiceDoc & { _id: { toString(): string } }, provider?: ProviderPublicDetails) {
  return {
    id: doc._id.toString(), title: doc.title, description: doc.description,
    categoryId: doc.categoryId, categoryLabel: doc.categoryLabel, category: doc.categoryLabel,
    subcategory: doc.subcategory, location: doc.location, priceFrom: doc.priceFrom,
    details: doc.details ?? {}, providerUid: doc.providerUid,
    providerName: provider?.name || doc.providerName,
    provider: provider ?? { uid: doc.providerUid, name: doc.providerName, email: '', role: 'unknown' as const, roleLabel: 'Ofrues', headline: '', bio: '', location: '', skills: [], languages: [], profilePhoto: '', ratingAverage: 0, ratingCount: 0 },
    active: doc.active, createdAt: doc.createdAt,
  }
}

async function withLegacyProviders(docs: Array<ServiceDoc & { _id: { toString(): string } }>) {
  const providers = await getProvidersPublicDetails(docs.map((doc) => doc.providerUid), new Map(docs.map((doc) => [doc.providerUid, doc.providerName])))
  return docs.map((doc) => legacyService(doc, providers.get(doc.providerUid)))
}

export async function validateServiceDetails(categoryId: string, details: ServiceDetails = {}) {
  const category = await findDomainById(categoryId)
  if (!category) throw new Error('Kategoria nuk ekziston')
  // This field is a legacy client claim, never a source of verification truth.
  const { licenseVerified: _ignored, photos: _photos, ...raw } = details
  const allowed = new Set(category.extensionFields.map((field) => field.key))
  const extensions = Object.fromEntries(Object.entries(raw).filter(([key, value]) => allowed.has(key) && value !== undefined && value !== ''))
  return validateExtensions(category.extensionFields, extensions)
}

function cleanPhotos(photos?: string[]) {
  if (!Array.isArray(photos)) return []
  return [...new Set(photos.filter((value) => typeof value === 'string' && value.startsWith('/uploads/')))].slice(0, 8)
}

async function resolveLegacyProvider(uid: string, providerName: string, categoryId: string, location: string) {
  const user = await User.findOne({ uid }).select('_id').lean()
  if (!user) throw new Error('Llogaria nuk u gjet')
  const profile = await ProviderProfile.findOne({ ownerUser: user._id, providerType: 'individual', business: { $exists: false } }).sort({ createdAt: 1 })
  if (profile) return String(profile._id)
  const online = location.trim().toLowerCase() === 'online'
  const created = await createProviderProfile({
    ownerUid: uid, providerType: 'individual', categories: [categoryId],
    languages: [],
    locations: online ? [] : [{ countryCode: 'XK', cityName: location, online: false }],
    serviceAreas: [{ countryCode: 'XK', cityName: online ? undefined : location, online }],
    modes: online ? ['online'] : ['on_site'],
    publicProfile: { displayName: providerName },
  })
  return String(created._id)
}

export async function createService(input: CreateServiceInput) {
  const category = await findDomainById(input.categoryId)
  if (!category) throw new Error('Kategoria nuk ekziston')
  const extensions = await validateServiceDetails(input.categoryId, input.details)
  const providerId = input.providerId || await resolveLegacyProvider(input.providerUid, input.providerName, input.categoryId, input.location)
  const modeValues = Array.isArray(extensions.deliveryModes) ? extensions.deliveryModes as string[] : []
  const online = input.location.trim().toLowerCase() === 'online'
  const modes = [...new Set(modeValues.filter((mode) => mode !== 'group').map((mode) => mode === 'physical' ? 'on_site' as const : 'online' as const))]
  if (!modes.length) modes.push(online ? 'online' : 'on_site')
  const languages = [extensions.languageFrom, extensions.languageTo, ...(Array.isArray(extensions.supportLanguages) ? extensions.supportLanguages : [])]
    .filter((value): value is string => typeof value === 'string')
  const offer = await createServiceOffer({
    ownerUid: input.providerUid, providerId, categoryId: category.id,
    name: input.title, subtitle: input.subcategory, description: input.description,
    price: input.priceFrom === undefined ? { model: 'quote' } : { model: 'starting_at', amountFrom: input.priceFrom, currency: 'EUR', amountTo: typeof extensions.priceTo === 'number' ? extensions.priceTo : undefined },
    formats: modeValues.includes('group') ? ['group'] : ['individual'],
    modes, languages,
    serviceAreas: [{ countryCode: 'XK', cityName: online ? undefined : input.location, online }],
    photos: cleanPhotos(input.details?.photos),
    availabilityMode: 'request', extensions, allowCategoryExpansion: true,
  })
  const [result] = await offersToLegacyServices([offer])
  return result
}

export async function updateService(id: string, uid: string, input: Omit<CreateServiceInput, 'providerUid' | 'providerName' | 'providerId'>) {
  const category = await findDomainById(input.categoryId)
  if (!category) throw new Error('Kategoria nuk ekziston')
  const extensions = await validateServiceDetails(input.categoryId, input.details)
  const modeValues = Array.isArray(extensions.deliveryModes) ? extensions.deliveryModes as string[] : []
  const online = input.location.trim().toLowerCase() === 'online'
  const modes = [...new Set(modeValues.filter((mode) => mode !== 'group').map((mode) => mode === 'physical' ? 'on_site' as const : 'online' as const))]
  if (!modes.length) modes.push(online ? 'online' : 'on_site')
  const languages = [extensions.languageFrom, extensions.languageTo, ...(Array.isArray(extensions.supportLanguages) ? extensions.supportLanguages : [])]
    .filter((value): value is string => typeof value === 'string')
  const offer = await ServiceOffer.findById(id)
  if (offer) {
    const updated = await updateServiceOffer(uid, id, {
      categoryId: category.id,
      name: input.title, subtitle: input.subcategory, description: input.description,
      price: input.priceFrom === undefined ? { model: 'quote' } : { model: 'starting_at', amountFrom: input.priceFrom, currency: 'EUR', amountTo: typeof extensions.priceTo === 'number' ? extensions.priceTo : undefined },
      formats: modeValues.includes('group') ? ['group'] : ['individual'],
      modes, languages,
      serviceAreas: [{ countryCode: 'XK', cityName: online ? undefined : input.location, online }],
      photos: cleanPhotos(input.details?.photos),
      extensions,
    })
    const [result] = await offersToLegacyServices([updated])
    return result
  }

  const service = await Service.findById(id)
  if (!service) throw new Error('Shërbimi nuk u gjet')
  if (service.providerUid !== uid) throw new Error('Nuk ke leje për këtë shërbim')
  service.title = input.title
  service.description = input.description
  service.categoryId = category.id
  service.categoryLabel = category.labelSq
  service.subcategory = input.subcategory
  service.location = input.location
  service.priceFrom = input.priceFrom
  service.details = { ...extensions, photos: cleanPhotos(input.details?.photos) }
  await service.save()
  const [result] = await withLegacyProviders([service])
  return result
}

export async function deleteService(id: string, uid: string) {
  const offer = await ServiceOffer.findById(id)
  if (offer) {
    await deleteServiceOffer(uid, id)
    return { deleted: true, id }
  }
  const service = await Service.findById(id)
  if (!service) throw new Error('Shërbimi nuk u gjet')
  if (service.providerUid !== uid) throw new Error('Nuk ke leje për këtë shërbim')
  await service.deleteOne()
  return { deleted: true, id }
}

export async function listServicesByProvider(providerUid: string) {
  const [legacy, offers] = await Promise.all([
    Service.find({ providerUid }).sort({ createdAt: -1 }),
    listMyServiceOffers(providerUid),
  ])
  return [...(await offersToLegacyServices(offers)), ...(await withLegacyProviders(legacy))]
}

export async function listActiveServices(filters: ServiceDiscoveryFilters = {}) {
  let providerIds: Types.ObjectId[] | undefined
  let providerUids: string[] | undefined
  if (filters.cityId) {
    if (!await isActiveDiscoveryCity(filters.cityId)) return []
    const profiles = await ProviderProfile.find({
      serviceAreaCityIds: new Types.ObjectId(filters.cityId),
      status: 'published', 'moderation.status': 'approved',
    }).select('_id ownerUser').lean()
    if (!profiles.length) return []
    providerIds = profiles.map((profile) => profile._id)
    const users = await User.find({ _id: { $in: profiles.map((profile) => profile.ownerUser) } }).select('uid').lean()
    providerUids = users.map((user) => user.uid)
  }
  const [legacy, offers] = await Promise.all([
    Service.find({ active: true, ...(providerUids ? { providerUid: { $in: providerUids } } : {}) })
      .sort({ createdAt: -1 }).limit(filters.cityId ? 0 : 50),
    listPublishedServiceOffers(providerIds),
  ])
  let categoryId = filters.categoryId
  if (categoryId && Types.ObjectId.isValid(categoryId)) {
    const category = await Category.findById(categoryId).select('stableId').lean()
    categoryId = category?.stableId ?? categoryId
  }
  let subcategoryNames: string[] | undefined
  if (filters.subcategoryId) {
    const subcategory = Types.ObjectId.isValid(filters.subcategoryId)
      ? await Subcategory.findById(filters.subcategoryId).lean()
      : await Subcategory.findOne({ slug: filters.subcategoryId }).lean()
    if (!subcategory?.isActive) return []
    subcategoryNames = [subcategory.name.sq, subcategory.name.en]
    if (!categoryId) {
      const parent = await Category.findById(subcategory.categoryId).select('stableId').lean()
      categoryId = parent?.stableId
    }
  }
  const services = [...(await offersToLegacyServices(offers, true)), ...(await withLegacyProviders(legacy))]
  return filterDiscoveredServices(services, { ...filters, categoryId, subcategoryNames })
}
export async function getActiveServiceById(id: string) {
  if (!mongoose.isValidObjectId(id)) return null

  const offer = await ServiceOffer.findOne({
    _id: id,
    status: 'published',
    visibility: 'public',
    'moderation.status': 'approved',
  })
  if (offer) {
    const [enriched] = await offersToLegacyServices([offer], true)
    if (enriched?.active) return enriched
  }

  const service = await Service.findOne({ _id: id, active: true })
  if (!service) return null
  const [enriched] = await withLegacyProviders([service])
  return enriched
}

export async function listActiveServicesByProvider(providerUid: string) {
  const [legacy, offers] = await Promise.all([
    Service.find({ providerUid, active: true }).sort({ createdAt: -1 }),
    listMyServiceOffers(providerUid),
  ])
  const publishedOffers = offers.filter(
    (offer) => offer.status === 'published' && offer.moderation.status === 'approved' && offer.visibility === 'public',
  )
  return [
    ...(await offersToLegacyServices(publishedOffers, true)),
    ...(await withLegacyProviders(legacy)),
  ]
}
