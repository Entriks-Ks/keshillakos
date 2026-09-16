import { Types } from 'mongoose'
import { Business } from '../models/Business'
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
  modes?: Array<'online' | 'on_site'>
  publicProfile: ProviderProfileDoc['publicProfile']
  qualificationClaims?: ProviderProfileDoc['qualificationClaims']
}

function uniqueText(values: string[] = []) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
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

  return ProviderProfile.create({
    providerType: input.providerType,
    ownerUser,
    business: input.businessId ? new Types.ObjectId(input.businessId) : undefined,
    categories,
    languages: uniqueText(input.languages),
    locations: input.locations ?? [],
    serviceAreas: input.serviceAreas ?? [],
    modes: [...new Set(input.modes ?? [])],
    publicProfile: input.publicProfile,
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

export async function listPublishedProviderProfiles() {
  const profiles = await ProviderProfile.find({ status: 'published', 'moderation.status': 'approved' })
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
    modes: profile.modes,
    publicProfile: profile.publicProfile,
    verification: profile.verification,
    updatedAt: profile.updatedAt,
  }
}

export async function updateProviderProfile(uid: string, id: string, changes: Partial<Pick<ProviderProfileDoc,
  'categories' | 'languages' | 'locations' | 'serviceAreas' | 'modes' | 'publicProfile'>>) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Provider ID i pavlefshëm')
  const userId = await userIdForUid(uid)
  const profile = await ProviderProfile.findById(id)
  if (!profile) throw new Error('Profili nuk u gjet')
  const business = profile.business ? await Business.findById(profile.business) : null
  if (!profile.ownerUser.equals(userId) && (!business || !canManageBusiness(business, userId))) {
    throw new Error('Nuk ke leje për këtë profil')
  }
  if (changes.categories !== undefined) {
    const categories = uniqueText(changes.categories)
    if (!categories.length || !(await Promise.all(categories.map((id) => findDomainById(id)))).every(Boolean)) throw new Error('Kategoria nuk ekziston')
    profile.categories = categories
  }
  if (changes.languages !== undefined) profile.languages = uniqueText(changes.languages)
  if (changes.locations !== undefined) profile.locations = changes.locations
  if (changes.serviceAreas !== undefined) profile.serviceAreas = changes.serviceAreas
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
  const [users, businesses, domains] = await Promise.all([
    User.find({ _id: { $in: ownerIds } }).select('uid').lean(),
    Business.find({ _id: { $in: businessIds } }).select('publicName').lean(),
    Promise.all(categoryIds.map((id) => findDomainById(id))),
  ])
  const uidById = new Map(users.map((user) => [String(user._id), user.uid]))
  const businessById = new Map(businesses.map((business) => [String(business._id), business.publicName]))
  const categoryLabelById = new Map(domains.filter((domain) => domain !== null).map((domain) => [domain.id, domain.labelSq]))

  return profiles.map((profile) => ({
    id: String((profile as ProviderProfileDoc & { _id: Types.ObjectId })._id),
    providerId: String((profile as ProviderProfileDoc & { _id: Types.ObjectId })._id),
    name: profile.publicProfile.displayName,
    title: profile.publicProfile.title || '',
    categoryId: profile.categories[0] || '',
    categoryLabel: categoryLabelById.get(profile.categories[0]) || profile.categories[0] || '',
    specialty: profile.publicProfile.shortDescription || '',
    bio: profile.publicProfile.description || '',
    location: profile.locations[0]?.cityName || profile.serviceAreas[0]?.cityName || (profile.modes.includes('online') ? 'Online' : ''),
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
