import mongoose from 'mongoose'
import { ProviderProfile } from '../models/ProviderProfile'
import { Service, type ServiceDetails, type ServiceDoc } from '../models/Service'
import { User } from '../models/User'
import { validateExtensions } from './categoryConfiguration'
import { findDomainById } from './domainService'
import { createProviderProfile } from './providerProfileService'
import { createServiceOffer, listMyServiceOffers, listPublishedServiceOffers, offersToLegacyServices } from './serviceOfferService'
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
  const { licenseVerified: _ignored, ...extensions } = details
  return validateExtensions(category.extensionFields, extensions)
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
    availabilityMode: 'request', extensions, allowCategoryExpansion: true,
  })
  const [result] = await offersToLegacyServices([offer])
  return result
}

export async function listServicesByProvider(providerUid: string) {
  const [legacy, offers] = await Promise.all([
    Service.find({ providerUid }).sort({ createdAt: -1 }),
    listMyServiceOffers(providerUid),
  ])
  return [...(await offersToLegacyServices(offers)), ...(await withLegacyProviders(legacy))]
}

export async function listActiveServices() {
  const [legacy, offers] = await Promise.all([
    Service.find({ active: true }).sort({ createdAt: -1 }).limit(50),
    listPublishedServiceOffers(),
  ])
  return [...(await offersToLegacyServices(offers, true)), ...(await withLegacyProviders(legacy))]
}
export async function getActiveServiceById(id: string) {
  if (!mongoose.isValidObjectId(id)) return null
  const service = await Service.findOne({ _id: id, active: true })
  if (!service) return null
  const [enriched] = await withLegacyProviders([service])
  return enriched
}

export async function listActiveServicesByProvider(providerUid: string) {
  const services = await Service.find({ providerUid, active: true }).sort({ createdAt: -1 })
  return withLegacyProviders(services)
}
