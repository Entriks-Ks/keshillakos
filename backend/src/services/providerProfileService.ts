import { Types } from 'mongoose'
import { Business } from '../models/Business'
import { Category } from '../models/Category'
import { City } from '../models/City'
import { Country } from '../models/Country'
import { ProviderProfile, type ProviderProfileDoc } from '../models/ProviderProfile'
import { ServiceOffer } from '../models/ServiceOffer'
import { Subcategory } from '../models/Subcategory'
import type { Location } from '../models/location'
import { User } from '../models/User'
import { applySocialLinks, normalizeSocialLinks, type SocialLinks } from '../models/socialLinks'
import {
  normalizeCertifications,
  normalizeEducation,
  normalizeWorkExperience,
  type CertificationEntry,
  type EducationEntry,
  type WorkExperienceEntry,
} from '../models/providerCareer'
import { DEFAULT_PORTAL, findDomainById } from './domainService'
import { canManageBusiness, ownedBusinessById, userIdForUid } from './businessService'
import { normalizeUploadPath } from './mediaService'
import { getStatsForProviders } from './ratingService'

export type CreateProviderProfileInput = {
  ownerUid: string
  providerType: 'individual' | 'business'
  businessId?: string
  categories: string[]
  subcategoryIds?: string[]
  languages?: string[]
  locations?: Location[]
  serviceAreas?: Location[]
  location?: { countryId: string; cityId: string }
  serviceAreaCityIds?: string[]
  modes?: Array<'online' | 'on_site'>
  experience?: string
  publicProfile: ProviderProfileDoc['publicProfile']
  qualificationClaims?: ProviderProfileDoc['qualificationClaims']
}

async function validateSubcategoryIds(categoryStableIds: string[], subcategoryIds?: string[]) {
  if (subcategoryIds === undefined) return
  if (subcategoryIds.some((id) => !Types.ObjectId.isValid(id)) || new Set(subcategoryIds).size !== subcategoryIds.length) {
    throw new Error('Nënkategoritë janë të pavlefshme')
  }
  if (!subcategoryIds.length) return
  const categories = await Category.find({ portal: DEFAULT_PORTAL, stableId: { $in: categoryStableIds }, status: 'active' }).select('_id').lean()
  const categoryObjectIds = new Set(categories.map((category) => String(category._id)))
  if (!categoryObjectIds.size) throw new Error('Kategoria nuk ekziston')
  const children = await Subcategory.find({ _id: { $in: subcategoryIds }, isActive: true }).select('categoryId').lean()
  if (children.length !== subcategoryIds.length || children.some((child) => !categoryObjectIds.has(String(child.categoryId)))) {
    throw new Error('Nënkategoria nuk përputhet me kategorinë')
  }
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
  if (!input.publicProfile?.displayName?.trim() && input.providerType === 'business') {
    throw new Error('Emri publik është i detyrueshëm')
  }
  if (input.providerType === 'business' && !input.businessId) throw new Error('Biznesi është i detyrueshëm')
  if (input.businessId) await ownedBusinessById(input.ownerUid, input.businessId)
  await validateProviderLocations(input.location, input.serviceAreaCityIds)
  await validateSubcategoryIds(categories, input.subcategoryIds)
  const owner = await User.findById(ownerUser).select('firstName lastName name profilePhoto').lean()
  if (!owner) throw new Error('Përdoruesi nuk u gjet')
  const personalName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.name?.trim()
  const displayName = input.providerType === 'business'
    ? (input.publicProfile.displayName?.trim() || personalName)
    : (personalName || input.publicProfile.displayName?.trim())
  if (!displayName) throw new Error('Emri i përdoruesit është i detyrueshëm')
  const publicProfile = {
    ...input.publicProfile,
    displayName,
    photoUrl: input.publicProfile.photoUrl || (input.providerType === 'business' ? undefined : owner.profilePhoto),
  }

  return ProviderProfile.create({
    providerType: input.providerType,
    ownerUser,
    business: input.businessId ? new Types.ObjectId(input.businessId) : undefined,
    categories,
    subcategoryIds: (input.subcategoryIds ?? []).map((id) => new Types.ObjectId(id)),
    languages: uniqueText(input.languages),
    locations: input.locations ?? [],
    serviceAreas: input.serviceAreas ?? [],
    location: input.location,
    serviceAreaCityIds: input.serviceAreaCityIds ?? [],
    modes: [...new Set(input.modes ?? [])],
    experience: input.experience?.trim() || undefined,
    publicProfile,
    qualificationClaims: input.qualificationClaims,
    // Ownership exists immediately; verification/moderation stay separate from capability.
    status: 'draft',
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

/** Find or create the company ProviderProfile used for company-owned service offers. */
export async function ensureBusinessProviderProfile(uid: string, businessId: string, categoryStableId: string) {
  if (!Types.ObjectId.isValid(businessId)) throw new Error('Business ID i pavlefshëm')
  const { business } = await ownedBusinessById(uid, businessId)
  const existing = await ProviderProfile.findOne({ business: business._id, providerType: 'business' })
  if (existing) {
    if (existing.status === 'suspended') throw new Error('Profili i kompanisë është pezulluar')
    if (categoryStableId && !existing.categories.includes(categoryStableId)) {
      existing.categories.push(categoryStableId)
      await existing.save()
    }
    return existing
  }
  return createProviderProfile({
    ownerUid: uid,
    providerType: 'business',
    businessId: String(business._id),
    categories: [categoryStableId],
    languages: [],
    modes: ['online', 'on_site'],
    location: business.location
      ? { countryId: String(business.location.countryId), cityId: String(business.location.cityId) }
      : undefined,
    publicProfile: {
      displayName: business.publicName,
      description: business.description,
      photoUrl: business.logoUrl,
      publicEmail: business.contactEmail,
      publicPhone: business.contactPhone,
    },
  })
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

async function loadManagedProvider(uid: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Provider ID i pavlefshëm')
  const userId = await userIdForUid(uid)
  const profile = await ProviderProfile.findById(id)
  if (!profile) throw new Error('Profili nuk u gjet')
  const business = profile.business ? await Business.findById(profile.business) : null
  if (!profile.ownerUser.equals(userId) && (!business || !canManageBusiness(business, userId))) {
    throw new Error('Nuk ke leje për këtë profil')
  }
  return profile
}

export async function assertCanManageProvider(uid: string, id: string) {
  await loadManagedProvider(uid, id)
}

export function toPublicProvider(profile: ProviderProfileDoc & { _id: Types.ObjectId }) {
  return {
    id: String(profile._id),
    _id: String(profile._id),
    providerType: profile.providerType,
    businessId: profile.business ? String(profile.business) : undefined,
    categories: profile.categories,
    subcategoryIds: (profile.subcategoryIds ?? []).map(String),
    languages: profile.languages,
    locations: profile.locations,
    serviceAreas: profile.serviceAreas,
    location: profile.location
      ? { countryId: String(profile.location.countryId), cityId: String(profile.location.cityId) }
      : undefined,
    serviceAreaCityIds: (profile.serviceAreaCityIds ?? []).map(String),
    modes: profile.modes,
    yearsOfExperience: profile.yearsOfExperience,
    experience: profile.experience || '',
    specializations: profile.specializations ?? [],
    socialLinks: profile.socialLinks || {},
    workExperience: profile.workExperience ?? [],
    education: profile.education ?? [],
    certifications: profile.certifications ?? [],
    publicProfile: profile.publicProfile,
    verification: profile.verification,
    qualificationClaims: profile.qualificationClaims,
    updatedAt: profile.updatedAt,
  }
}

/** Marketplace directory cards (experts + companies) with owner uid and ratings. */
export async function listMarketplaceProviders(cityId?: string) {
  const profiles = await listPublishedProviderProfiles(cityId)
  if (!profiles.length) return []

  const ownerIds = profiles.map((profile) => profile.ownerUser)
  const businessIds = profiles.map((profile) => profile.business).filter((id): id is Types.ObjectId => Boolean(id))
  const cityIds = profiles.flatMap((profile) => [
    profile.location?.cityId,
    ...profile.serviceAreaCityIds,
  ].filter((id): id is Types.ObjectId => Boolean(id)))
  const categoryStableIds = [...new Set(profiles.flatMap((profile) => profile.categories))]

  const [users, businesses, cities, categories, offerCounts, teamBusinesses] = await Promise.all([
    User.find({ _id: { $in: ownerIds } }).select('uid').lean(),
    businessIds.length
      ? Business.find({ _id: { $in: businessIds } })
        .select('publicName logoUrl website contactPhone contactEmail members owners status verification')
        .lean()
      : Promise.resolve([]),
    cityIds.length ? City.find({ _id: { $in: cityIds } }).select('name.sq').lean() : Promise.resolve([]),
    categoryStableIds.length
      ? Category.find({ stableId: { $in: categoryStableIds } }).select('stableId name.sq labels').lean()
      : Promise.resolve([]),
    ServiceOffer.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          providerProfile: { $in: profiles.map((profile) => profile._id) },
          status: 'published',
          visibility: 'public',
          'moderation.status': 'approved',
        },
      },
      { $group: { _id: '$providerProfile', count: { $sum: 1 } } },
    ]),
    Business.find({
      status: 'active',
      $or: [
        { owners: { $in: ownerIds } },
        { 'members.user': { $in: ownerIds } },
      ],
    }).select('publicName owners members website contactPhone').lean(),
  ])

  const memberIds = [
    ...new Set(
      businesses.flatMap((business) => [
        ...(business.owners ?? []),
        ...(business.members ?? []).map((member) => member.user),
      ]).map(String),
    ),
  ]
  const featuredProfiles = memberIds.length
    ? await ProviderProfile.find({
      ownerUser: { $in: memberIds },
      providerType: 'individual',
      status: 'published',
      'moderation.status': 'approved',
    }).select('ownerUser publicProfile').lean()
    : []
  const featuredUsers = featuredProfiles.length
    ? await User.find({ _id: { $in: featuredProfiles.map((profile) => profile.ownerUser) } }).select('uid').lean()
    : []
  const featuredUidByOwner = new Map(featuredUsers.map((user) => [String(user._id), user.uid || '']))
  const featuredByOwner = new Map(featuredProfiles.map((profile) => [String(profile.ownerUser), profile]))

  const uidByOwner = new Map(users.map((user) => [String(user._id), user.uid || '']))
  const businessById = new Map(businesses.map((business) => [String(business._id), business]))
  const cityNameById = new Map(cities.map((city) => [String(city._id), city.name.sq]))
  const categoryLabelById = new Map(categories.map((category) => {
    const labels = category.labels as Map<string, string> | Record<string, string> | undefined
    const fromMap = labels instanceof Map ? labels.get('sq') : labels?.sq
    return [category.stableId, fromMap || category.name?.sq || category.stableId] as const
  }))
  const serviceCountByProfile = new Map(offerCounts.map((row) => [String(row._id), row.count]))
  const companyByMember = new Map<string, { name: string; website?: string; phone?: string }>()
  for (const business of teamBusinesses) {
    for (const owner of business.owners ?? []) {
      companyByMember.set(String(owner), {
        name: business.publicName,
        website: business.website,
        phone: business.contactPhone,
      })
    }
    for (const member of business.members ?? []) {
      companyByMember.set(String(member.user), {
        name: business.publicName,
        website: business.website,
        phone: business.contactPhone,
      })
    }
  }
  const ratings = await getStatsForProviders([...uidByOwner.values()].filter(Boolean))

  return profiles.map((profile) => {
    const uid = uidByOwner.get(String(profile.ownerUser)) || ''
    const business = profile.business ? businessById.get(String(profile.business)) : undefined
    const rating = ratings.get(uid)
    const isCompany = profile.providerType === 'business'
    const locationLabel = (profile.location?.cityId && cityNameById.get(String(profile.location.cityId)))
      || (profile.serviceAreaCityIds[0] && cityNameById.get(String(profile.serviceAreaCityIds[0])))
      || profile.serviceAreas[0]?.cityName
      || profile.locations[0]?.cityName
      || (profile.modes.includes('online') ? 'Online' : '')
    const name = isCompany
      ? (business?.publicName || profile.publicProfile.displayName)
      : profile.publicProfile.displayName
    const affiliation = !isCompany ? companyByMember.get(String(profile.ownerUser)) : undefined
    const featuredMemberId = isCompany
      ? [...(business?.members ?? []).map((member) => String(member.user)), ...(business?.owners ?? []).map(String)]
        .find((id) => featuredByOwner.has(id))
      : undefined
    const featured = featuredMemberId ? featuredByOwner.get(featuredMemberId) : undefined
    const featuredUid = featuredMemberId ? featuredUidByOwner.get(featuredMemberId) : undefined

    return {
      id: String(profile._id),
      uid,
      providerType: profile.providerType,
      businessId: profile.business ? String(profile.business) : undefined,
      name,
      title: profile.publicProfile.title || '',
      photoUrl: profile.publicProfile.photoUrl || (isCompany ? business?.logoUrl : undefined) || '',
      description: profile.publicProfile.shortDescription || profile.publicProfile.description || profile.experience || '',
      location: locationLabel || '',
      languages: profile.languages ?? [],
      modes: profile.modes ?? [],
      categories: profile.categories ?? [],
      categoryLabels: (profile.categories ?? []).map((id) => categoryLabelById.get(id) || id),
      specializations: profile.specializations ?? [],
      yearsOfExperience: profile.yearsOfExperience,
      experience: profile.experience || '',
      verification: profile.verification,
      ratingAverage: rating?.average ?? 0,
      ratingCount: rating?.count ?? 0,
      expertCount: isCompany ? (business?.members?.length ?? 0) : undefined,
      serviceCount: serviceCountByProfile.get(String(profile._id)) ?? 0,
      publicPhone: profile.publicProfile.publicPhone || business?.contactPhone || affiliation?.phone || '',
      publicEmail: profile.publicProfile.publicEmail || business?.contactEmail || '',
      website: business?.website || affiliation?.website || '',
      companyName: affiliation?.name || '',
      featuredExpert: featured && featuredUid ? {
        uid: featuredUid,
        name: featured.publicProfile.displayName,
        title: featured.publicProfile.title || '',
        photoUrl: featured.publicProfile.photoUrl || '',
      } : undefined,
      updatedAt: profile.updatedAt,
      createdAt: profile.createdAt,
    }
  }).filter((item) => Boolean(item.uid))
}

export async function updateProviderProfile(uid: string, id: string, changes: Partial<Pick<ProviderProfileDoc,
  'categories' | 'languages' | 'locations' | 'serviceAreas' | 'modes' | 'experience' | 'specializations'>> & {
  location?: { countryId: string; cityId: string } | null
  serviceAreaCityIds?: string[]
  subcategoryIds?: string[]
  qualificationClaims?: ProviderProfileDoc['qualificationClaims']
  socialLinks?: SocialLinks | null
  workExperience?: WorkExperienceEntry[]
  education?: EducationEntry[]
  certifications?: CertificationEntry[]
  yearsOfExperience?: number | null
  publicProfile?: Partial<ProviderProfileDoc['publicProfile']>
}) {
  const profile = await loadManagedProvider(uid, id)
  await validateProviderLocations(changes.location, changes.serviceAreaCityIds)
  if (changes.categories !== undefined) {
    const categories = uniqueText(changes.categories)
    if (!categories.length || !(await Promise.all(categories.map((id) => findDomainById(id)))).every(Boolean)) throw new Error('Kategoria nuk ekziston')
    profile.categories = categories
  }
  await validateSubcategoryIds(profile.categories, changes.subcategoryIds)
  if (changes.subcategoryIds !== undefined) {
    profile.subcategoryIds = changes.subcategoryIds.map((id) => new Types.ObjectId(id))
  }
  if (changes.languages !== undefined) profile.languages = uniqueText(changes.languages)
  if (changes.locations !== undefined) profile.locations = changes.locations
  if (changes.serviceAreas !== undefined) profile.serviceAreas = changes.serviceAreas
  if (changes.location !== undefined) profile.location = changes.location === null ? undefined : {
    countryId: new Types.ObjectId(changes.location.countryId), cityId: new Types.ObjectId(changes.location.cityId),
  }
  if (changes.serviceAreaCityIds !== undefined) profile.serviceAreaCityIds = changes.serviceAreaCityIds.map((id) => new Types.ObjectId(id))
  if (changes.modes !== undefined) profile.modes = [...new Set(changes.modes)]
  if (changes.experience !== undefined) profile.experience = changes.experience.trim() || undefined
  if (changes.yearsOfExperience !== undefined) {
    if (changes.yearsOfExperience === null) {
      profile.yearsOfExperience = undefined
    } else {
      const years = Number(changes.yearsOfExperience)
      if (!Number.isFinite(years) || years < 0 || years > 60 || !Number.isInteger(years)) {
        throw new Error('Vitet e përvojës duhet të jenë një numër i plotë 0–60')
      }
      profile.yearsOfExperience = years
    }
  }
  if (changes.specializations !== undefined) {
    profile.specializations = uniqueText(changes.specializations).slice(0, 30)
  }
  if (changes.socialLinks !== undefined) {
    const normalized = normalizeSocialLinks(changes.socialLinks)
    profile.socialLinks = applySocialLinks(profile.socialLinks, normalized || {})
  }
  if (changes.workExperience !== undefined) profile.workExperience = normalizeWorkExperience(changes.workExperience)
  if (changes.education !== undefined) profile.education = normalizeEducation(changes.education)
  if (changes.certifications !== undefined) {
    profile.certifications = normalizeCertifications(changes.certifications)
  }
  if (changes.qualificationClaims !== undefined) profile.qualificationClaims = changes.qualificationClaims
  if (changes.publicProfile !== undefined) {
    for (const key of ['displayName', 'title', 'shortDescription', 'description', 'photoUrl', 'publicEmail', 'publicPhone'] as const) {
      if (changes.publicProfile[key] !== undefined) {
        const value = changes.publicProfile[key]
        if (key === 'photoUrl' && value) {
          const path = normalizeUploadPath(value)
          if (!path) throw new Error('Fotoja e profilit nuk është e vlefshme')
          profile.set(`publicProfile.${key}`, path)
        } else {
          profile.set(`publicProfile.${key}`, value)
        }
      }
    }
  }
  profile.status = 'pending'
  profile.moderation = { status: 'pending' }
  await profile.save()
  return profile
}

export async function updateProviderPhoto(uid: string, id: string, photoUrl: string) {
  const path = normalizeUploadPath(photoUrl)
  if (!path) throw new Error('Rruga e fotos nuk është e vlefshme')
  return updateProviderProfile(uid, id, { publicProfile: { photoUrl: path } })
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
