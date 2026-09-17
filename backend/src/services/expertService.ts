import { Expert, type ExpertDoc } from '../models/Expert'
import { findDomainById } from './domainService'
import { createBusiness, listManagedBusinesses } from './businessService'
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

  // Compatibility endpoint: create a real Business ID before a managed individual profile.
  // The account name is only an initial public label, never the canonical identity.
  const businesses = await listManagedBusinesses(input.ownerUid)
  const business = businesses[0] ?? await createBusiness({ ownerUid: input.ownerUid, publicName: input.ownerName })
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
    cityId ? Promise.resolve([]) : Expert.find({ active: true }).sort({ createdAt: -1 }).limit(50),
    listPublishedProviderProfiles(cityId),
  ])
  return [...(await providerProfilesToLegacyExperts(profiles)), ...legacy.map(toExpert)]
}
