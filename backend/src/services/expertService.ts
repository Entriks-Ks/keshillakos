import { Types, type PipelineStage } from 'mongoose'
import { Business } from '../models/Business'
import { ProviderProfile } from '../models/ProviderProfile'
import { managedServiceOfferQuery } from './serviceOfferService'
import { queryPage, type PaginationInput } from './pagination'
import { Expert, type ExpertDoc } from '../models/Expert'
import { findDomainById } from './domainService'
import { listManagedBusinesses } from './businessService'
import { createProviderProfile, listMyProviderProfiles, listPublishedProviderProfiles, providerProfilesToLegacyExperts } from './providerProfileService'

export type CreateExpertInput = {
  name: string
  title: string
  categoryId: string
  specialty: string
  bio: string
  location: string
  licenseNumber?: string
  languageFrom?: string
  languageTo?: string
  deliveryModes?: Array<'online' | 'physical' | 'group'>
  crossBorder?: boolean
  ownerUid: string
  ownerName: string
}

function toExpert(doc: ExpertDoc & { _id: { toString(): string } }) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    title: doc.title,
    categoryId: doc.categoryId,
    categoryLabel: doc.categoryLabel,
    specialty: doc.specialty,
    bio: doc.bio,
    location: doc.location,
    licenseNumber: doc.licenseNumber,
    licenseVerified: doc.licenseVerified,
    languageFrom: doc.languageFrom,
    languageTo: doc.languageTo,
    deliveryModes: doc.deliveryModes,
    crossBorder: doc.crossBorder,
    companyUid: doc.companyUid,
    companyName: doc.companyName,
    active: doc.active,
    createdAt: doc.createdAt,
  }
}

export async function createExpert(input: CreateExpertInput) {
  const domain = await findDomainById(input.categoryId)
  if (!domain) throw new Error('Kategoria nuk ekziston')

  if (domain.requirements.includes('license_verification') && !input.licenseNumber?.trim()) {
    throw new Error('Për Ligj duhet numri i licencës së ekspertit')
  }

  if (
    domain.requirements.includes('language_pair') &&
    (!input.languageFrom?.trim() || !input.languageTo?.trim())
  ) {
    throw new Error('Duhet kombinimi i gjuhëve për ekspertin e përkthimit')
  }

  if (domain.requirements.includes('delivery_mode') && !input.deliveryModes?.length) {
    throw new Error('Zgjidh Online / Fizikisht / Grup')
  }

  // Compatibility endpoint: attach to an existing managed Business — never invent a new company here.
  const businesses = await listManagedBusinesses(input.ownerUid)
  const business = businesses[0]
  if (!business) throw new Error('Krijo kompaninë para se të përdorësh këtë endpoint')
  const profile = await createProviderProfile({
    ownerUid: input.ownerUid,
    providerType: 'individual',
    businessId: String(business._id),
    categories: [domain.id],
    languages: [input.languageFrom, input.languageTo].filter((value): value is string => Boolean(value)),
    locations: [{ countryCode: 'XK', cityName: input.location.trim(), online: false }],
    serviceAreas: [{ countryCode: 'XK', cityName: input.location.trim(), online: Boolean(input.crossBorder) }],
    modes: (input.deliveryModes ?? []).filter((mode) => mode !== 'group').map((mode) => mode === 'physical' ? 'on_site' as const : 'online' as const),
    publicProfile: {
      displayName: input.name.trim(),
      title: input.title.trim(),
      shortDescription: input.specialty.trim(),
      description: input.bio.trim(),
    },
    qualificationClaims: input.licenseNumber?.trim() ? [{ categoryId: domain.id, referenceNumber: input.licenseNumber.trim(), status: 'unverified' }] : undefined,
  })
  const [result] = await providerProfilesToLegacyExperts([profile])
  return { ...result, categoryLabel: domain.labelSq, specialty: input.specialty.trim(), languageFrom: input.languageFrom, languageTo: input.languageTo, crossBorder: Boolean(input.crossBorder), licenseVerified: false }
}

export async function listExpertsByCompany(companyUid: string) {
  const [legacy, profiles] = await Promise.all([
    Expert.find({ companyUid }).sort({ createdAt: -1 }),
    listMyProviderProfiles(companyUid),
  ])
  return [...(await providerProfilesToLegacyExperts(profiles)), ...legacy.map(toExpert)]
}

export async function listActiveExperts(cityId?: string) {
  const [legacy, profiles] = await Promise.all([
    cityId ? Promise.resolve([]) : Expert.find({ active: true }).sort({ createdAt: -1 }),
    listPublishedProviderProfiles(cityId),
  ])
  return [...(await providerProfilesToLegacyExperts(profiles)), ...legacy.map(toExpert)]
}

/** Compatibility directory: select IDs across both stores before serializing a page. */
export async function listExpertPage(input: PaginationInput, companyUid?: string) {
  const managed = companyUid ? await managedServiceOfferQuery(companyUid) : undefined
  const branches = managed?.$or as Array<Record<string, unknown>> | undefined
  const profileQuery: Record<string, unknown> = branches ? { $or: branches.map((branch) => 'providerProfile' in branch ? { _id: branch.providerProfile } : branch) } : { status: 'published', 'moderation.status': 'approved' }
  const pipeline: PipelineStage[] = [
    { $match: profileQuery },
    ...(!companyUid ? [
      { $lookup: { from: Business.collection.name, localField: 'business', foreignField: '_id', as: '_business' } },
      { $match: { $or: [{ business: { $exists: false } }, { business: null }, { '_business.status': 'active' }] } },
    ] as PipelineStage[] : []),
    { $project: { _id: 1, createdAt: 1, source: { $literal: 'profile' }, rank: { $literal: 0 } } },
    { $unionWith: { coll: Expert.collection.name, pipeline: [
      { $match: companyUid ? { companyUid } : { active: true } },
      { $project: { _id: 1, createdAt: 1, source: { $literal: 'legacy' }, rank: { $literal: 1 } } },
    ] } },
  ]
  const result = await queryPage(input,
    async () => (await ProviderProfile.aggregate<{ total: number }>([...pipeline, { $count: 'total' }]))[0]?.total ?? 0,
    (skip, limit) => ProviderProfile.aggregate<{ _id: Types.ObjectId; source: 'profile' | 'legacy' }>([...pipeline, { $sort: { rank: 1, createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }]),
  )
  const [profiles, legacy] = await Promise.all([
    ProviderProfile.find({ _id: { $in: result.items.filter((item) => item.source === 'profile').map((item) => item._id) } }),
    Expert.find({ _id: { $in: result.items.filter((item) => item.source === 'legacy').map((item) => item._id) } }),
  ])
  const cards = [...await providerProfilesToLegacyExperts(profiles), ...legacy.map(toExpert)]
  const byId = new Map(cards.map((card) => [card.id, card]))
  return { items: result.items.flatMap((item) => { const card = byId.get(String(item._id)); return card ? [card] : [] }), pagination: result.pagination }
}
