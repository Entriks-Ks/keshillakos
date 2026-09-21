import { Types } from 'mongoose'
import { Business } from '../models/Business'
import { City } from '../models/City'
import { Country } from '../models/Country'
import { ProviderProfile, type ProviderProfileDoc } from '../models/ProviderProfile'
import type { Location } from '../models/location'
import { User } from '../models/User'
import { findDomainById } from './domainService'
import { canManageBusiness, ownedBusinessById, userIdForUid } from './businessService'

export type CreateProviderProfileInput = {
  ownerUid: string
  providerType: 'individual' | 'business'
  businessId?: string
  categories: string[]
  languages?: string[]
  locations?: Location[]
  serviceAreas?: Location[]
  location?: { countryId: string; cityId: string }
  serviceAreaCityIds?: string[]
  modes?: Array<'online' | 'on_site'>
  publicProfile: ProviderProfileDoc['publicProfile']
  qualificationClaims?: ProviderProfileDoc['qualificationClaims']
}

function uniqueText(values: string[] = []) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export async function validateProviderLocations(location?: { countryId: string; cityId: string } | null, serviceAreaCityIds?: string[]) {
  if (location) {
    if (!Types.ObjectId.isValid(location.countryId) || !Types.ObjectId.isValid(location.cityId)) throw new Error('Lokacioni është i pavlefshëm')
    const [country, city] = await Promise.all([
      Country.exists({ _id: location.countryId, isActive: true }),
      City.exists({ _id: location.cityId, countryId: location.countryId, isActive: true }),
    ])
    if (!country || !city) throw new Error('Qyteti dhe shteti nuk përputhen ose nuk janë aktivë')
  }
  if (serviceAreaCityIds !== undefined) {
    if (serviceAreaCityIds.some((id) => !Types.ObjectId.isValid(id)) || new Set(serviceAreaCityIds).size !== serviceAreaCityIds.length) throw new Error('Qytetet e zonës së shërbimit janë të pavlefshme')
    if (serviceAreaCityIds.length) {
      const cities = await City.find({ _id: { $in: serviceAreaCityIds }, isActive: true }).select('countryId').lean()
      const countries = await Country.find({ _id: { $in: cities.map((city) => city.countryId) }, isActive: true }).select('_id').lean()
      const activeCountryIds = new Set(countries.map((country) => String(country._id)))
      if (cities.length !== serviceAreaCityIds.length || cities.some((city) => !activeCountryIds.has(String(city.countryId)))) throw new Error('Zona e shërbimit përmban qytete joaktive ose të pavlefshme')
    }
  }
}

export async function createProviderProfile(input: CreateProviderProfileInput) {
  const ownerUser = await userIdForUid(input.ownerUid)
  const categories = uniqueText(input.categories)
  if (!categories.length || !(await Promise.all(categories.map((id) => findDomainById(id)))).every(Boolean)) {
    throw new Error('Kategoria nuk ekziston')
  }
  if (!input.publicProfile?.displayName?.trim()) throw new Error('Emri publik është i detyrueshëm')
  if (input.providerType === 'business' && !input.businessId) throw new Error('Biznesi është i detyrueshëm')
  if (input.businessId) await ownedBusinessById(input.ownerUid, input.businessId)
  await validateProviderLocations(input.location, input.serviceAreaCityIds)
  const owner = await User.findById(ownerUser).select('profilePhoto').lean()
  const publicProfile = {
    ...input.publicProfile,
    photoUrl: input.publicProfile.photoUrl || owner?.profilePhoto,
  }

  return ProviderProfile.create({
    providerType: input.providerType,
    ownerUser,
    business: input.businessId ? new Types.ObjectId(input.businessId) : undefined,
    categories,
    languages: uniqueText(input.languages),
    locations: input.locations ?? [],
    serviceAreas: input.serviceAreas ?? [],
    location: input.location,
    serviceAreaCityIds: input.serviceAreaCityIds ?? [],
    modes: [...new Set(input.modes ?? [])],
    publicProfile,
    qualificationClaims: input.qualificationClaims,
    status: 'pending',
    moderation: { status: 'pending' },
  })
}

export async function listMyProviderProfiles(uid: string) {
  const userId = await userIdForUid(uid)
  const managedBusinesses = await Business.find({ $or: [{ owners: userId }, { members: { $elemMatch: { user: userId, role: 'manager' } } }] }).select('_id').lean()
  return ProviderProfile.find({ $or: [
    { ownerUser: userId },
    { business: { $in: managedBusinesses.map((business) => business._id) } },
  ] }).sort({ createdAt: -1 })
}

export async function listPublishedProviderProfiles(cityId?: string) {
  const profiles = await ProviderProfile.find({
    status: 'published', 'moderation.status': 'approved',
    ...(cityId ? { serviceAreaCityIds: new Types.ObjectId(cityId) } : {}),
  })
    .select('-qualificationClaims -moderation.reason')
    .sort({ updatedAt: -1 }).limit(50)
  const ids = profiles.map((profile) => profile.business).filter((id): id is Types.ObjectId => Boolean(id))
  if (!ids.length) return profiles
  const activeBusinesses = await Business.find({ _id: { $in: ids }, status: 'active' }).select('_id').lean()
  const activeIds = new Set(activeBusinesses.map((business) => String(business._id)))
  return profiles.filter((profile) => !profile.business || activeIds.has(String(profile.business)))
}

export function toPublicProvider(profile: ProviderProfileDoc & { _id: Types.ObjectId }) {
  return {
    id: String(profile._id),
    providerType: profile.providerType,
    businessId: profile.business ? String(profile.business) : undefined,
    categories: profile.categories,
    languages: profile.languages,
    locations: profile.locations,
    serviceAreas: profile.serviceAreas,
    location: profile.location,
    serviceAreaCityIds: profile.serviceAreaCityIds,
    modes: profile.modes,
    publicProfile: profile.publicProfile,
    verification: profile.verification,
    updatedAt: profile.updatedAt,
  }
}

export async function updateProviderProfile(uid: string, id: string, changes: Partial<Pick<ProviderProfileDoc,
  'categories' | 'languages' | 'locations' | 'serviceAreas' | 'modes' | 'publicProfile'>> & {
  location?: { countryId: string; cityId: string } | null; serviceAreaCityIds?: string[]
}) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Provider ID i pavlefshëm')
  const userId = await userIdForUid(uid)
  const profile = await ProviderProfile.findById(id)
  if (!profile) throw new Error('Profili nuk u gjet')
  const business = profile.business ? await Business.findById(profile.business) : null
  if (!profile.ownerUser.equals(userId) && (!business || !canManageBusiness(business, userId))) {
    throw new Error('Nuk ke leje për këtë profil')
  }
  await validateProviderLocations(changes.location, changes.serviceAreaCityIds)
  if (changes.categories !== undefined) {
    const categories = uniqueText(changes.categories)
    if (!categories.length || !(await Promise.all(categories.map((id) => findDomainById(id)))).every(Boolean)) throw new Error('Kategoria nuk ekziston')
    profile.categories = categories
  }
  if (changes.languages !== undefined) profile.languages = uniqueText(changes.languages)
  if (changes.locations !== undefined) profile.locations = changes.locations
  if (changes.serviceAreas !== undefined) profile.serviceAreas = changes.serviceAreas
  if (changes.location !== undefined) profile.location = changes.location === null ? undefined : {
    countryId: new Types.ObjectId(changes.location.countryId), cityId: new Types.ObjectId(changes.location.cityId),
  }
  if (changes.serviceAreaCityIds !== undefined) profile.serviceAreaCityIds = changes.serviceAreaCityIds.map((id) => new Types.ObjectId(id))
  if (changes.modes !== undefined) profile.modes = [...new Set(changes.modes)]
  if (changes.publicProfile !== undefined) {
    for (const key of ['displayName', 'title', 'shortDescription', 'description', 'photoUrl', 'publicEmail', 'publicPhone'] as const) {
      if (changes.publicProfile[key] !== undefined) profile.set(`publicProfile.${key}`, changes.publicProfile[key])
    }
  }
  profile.status = 'pending'
  profile.moderation = { status: 'pending' }
  await profile.save()
  return profile
}

export async function moderateProviderProfile(id: string, reviewerUid: string, decision: 'approved' | 'rejected', reason?: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Provider ID i pavlefshëm')
  const reviewer = await userIdForUid(reviewerUid)
  const profile = await ProviderProfile.findById(id)
  if (!profile) throw new Error('Profili nuk u gjet')
  if (decision === 'approved' && profile.business) {
    const business = await Business.findById(profile.business)
    if (!business || business.status !== 'active') throw new Error('Biznesi duhet të jetë aktiv')
  }
  profile.moderation = { status: decision, reviewedAt: new Date(), reviewedBy: reviewer, reason: reason?.trim() || undefined }
  profile.status = decision === 'approved' ? 'published' : 'draft'
  await profile.save()
  return profile
}

export async function providerProfilesToLegacyExperts(profiles: ProviderProfileDoc[]) {
  const ownerIds = [...new Set(profiles.map((profile) => String(profile.ownerUser)))]
  const businessIds = [...new Set(profiles.map((profile) => profile.business && String(profile.business)).filter((value): value is string => Boolean(value)))]
  const categoryIds = [...new Set(profiles.flatMap((profile) => profile.categories))]
  const [users, businesses, domains, cities] = await Promise.all([
    User.find({ _id: { $in: ownerIds } }).select('uid').lean(),
    Business.find({ _id: { $in: businessIds } }).select('publicName').lean(),
    Promise.all(categoryIds.map((id) => findDomainById(id))),
    City.find({ _id: { $in: profiles.flatMap((profile) => profile.location ? [profile.location.cityId] : []) } }).select('name.sq').lean(),
  ])
  const uidById = new Map(users.map((user) => [String(user._id), user.uid]))
  const businessById = new Map(businesses.map((business) => [String(business._id), business.publicName]))
  const categoryLabelById = new Map(domains.filter((domain) => domain !== null).map((domain) => [domain.id, domain.labelSq]))
  const cityNameById = new Map(cities.map((city) => [String(city._id), city.name.sq]))

  return profiles.map((profile) => ({
    id: String((profile as ProviderProfileDoc & { _id: Types.ObjectId })._id),
    providerId: String((profile as ProviderProfileDoc & { _id: Types.ObjectId })._id),
    name: profile.publicProfile.displayName,
    title: profile.publicProfile.title || '',
    categoryId: profile.categories[0] || '',
    categoryLabel: categoryLabelById.get(profile.categories[0]) || profile.categories[0] || '',
    specialty: profile.publicProfile.shortDescription || '',
    bio: profile.publicProfile.description || '',
    location: (profile.location && cityNameById.get(String(profile.location.cityId))) || profile.locations[0]?.cityName || profile.serviceAreas[0]?.cityName || (profile.modes.includes('online') ? 'Online' : ''),
    licenseVerified: profile.verification.qualification === 'verified',
    languageFrom: profile.languages[0],
    languageTo: profile.languages[1],
    licenseNumber: undefined,
    publicEmail: profile.publicProfile.publicEmail,
    deliveryModes: profile.modes.map((mode) => mode === 'on_site' ? 'physical' as const : 'online' as const),
    companyUid: uidById.get(String(profile.ownerUser)) || '', // Legacy API alias, not canonical identity.
    companyName: profile.business ? businessById.get(String(profile.business)) || '' : profile.publicProfile.displayName,
    active: profile.status === 'published' && profile.moderation.status === 'approved',
    createdAt: profile.createdAt,
  }))
}
