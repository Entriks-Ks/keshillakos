import { Types } from 'mongoose'
import { Business, type BusinessDoc } from '../models/Business'
import { ProviderProfile, type ProviderProfileDoc } from '../models/ProviderProfile'
import { Service } from '../models/Service'
import { ServiceOffer } from '../models/ServiceOffer'
import { User, type UserDoc } from '../models/User'
import { SOCIAL_LINK_KEYS, socialLinkLabel, type SocialLinkKey, type SocialLinks } from '../models/socialLinks'
import { findDomainById } from './domainService'
import { type PublicUser, toPublicUser } from './userService'
import { userIdForUid } from './businessService'

export type ProfileType = 'private' | 'expert' | 'company'

export type ProfileFieldKey =
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'city'
  | 'profilePhoto'
  | 'languages'
  | 'title'
  | 'category'
  | 'subcategory'
  | 'bio'
  | 'skills'
  | 'experience'
  | 'yearsOfExperience'
  | 'serviceLocation'
  | 'license'
  | 'verification'
  | 'pricing'
  | 'workExperience'
  | 'education'
  | 'certifications'
  | 'companyName'
  | 'logo'
  | 'companyEmail'
  | 'companyPhone'
  | 'companyCity'
  | 'companyDescription'
  | 'companyCategory'
  | 'website'
  | 'address'
  | SocialLinkKey

export type ProfileCompletionField = {
  key: ProfileFieldKey
  label: string
  required: boolean
  applicable: boolean
  filled: boolean
}

export type ProfileCompletionSection = {
  type: ProfileType
  label: string
  applicable: boolean
  exists: boolean
  percent: number | null
  filledRequired: number
  totalRequired: number
  fields: ProfileCompletionField[]
  missingRequired: Array<{ key: ProfileFieldKey; label: string }>
}

export type ProfileCompletion = {
  profileType: ProfileType
  exists: boolean
  overallPercent: number | null
  filledRequired: number
  totalRequired: number
  section: ProfileCompletionSection
  user: PublicUser
}

function filledText(value?: string | null) {
  return Boolean(value?.trim())
}

function field(
  key: ProfileFieldKey,
  label: string,
  required: boolean,
  filled: boolean,
  applicable = true,
): ProfileCompletionField {
  return { key, label, required, filled, applicable }
}

function sectionPercent(fields: ProfileCompletionField[]) {
  const required = fields.filter((item) => item.applicable && item.required)
  if (!required.length) return 100
  const filled = required.filter((item) => item.filled).length
  return Math.round((filled / required.length) * 100)
}

function buildSection(
  type: ProfileType,
  label: string,
  exists: boolean,
  fields: ProfileCompletionField[],
): ProfileCompletionSection {
  if (!exists) {
    return {
      type,
      label,
      applicable: false,
      exists: false,
      percent: null,
      filledRequired: 0,
      totalRequired: 0,
      fields: [],
      missingRequired: [],
    }
  }
  const visible = fields.filter((item) => item.applicable)
  const required = visible.filter((item) => item.required)
  return {
    type,
    label,
    applicable: true,
    exists: true,
    percent: sectionPercent(visible),
    filledRequired: required.filter((item) => item.filled).length,
    totalRequired: required.length,
    fields: visible,
    missingRequired: required.filter((item) => !item.filled).map((item) => ({ key: item.key, label: item.label })),
  }
}

function socialFields(links?: SocialLinks | null) {
  return SOCIAL_LINK_KEYS.map((key) => field(key, socialLinkLabel(key), false, Boolean(links?.[key]?.trim())))
}

function hasCity(user: Pick<UserDoc, 'city' | 'location' | 'legacyLocation'>) {
  if (user.location?.cityId) return true
  if (filledText(user.city)) return true
  return filledText(user.legacyLocation)
}

function providerHasServiceLocation(profile?: ProviderProfileDoc | null) {
  if (!profile) return false
  if (profile.location?.cityId) return true
  if (profile.serviceAreaCityIds?.length) return true
  if (profile.locations?.length) return true
  if (profile.serviceAreas?.length) return true
  return profile.modes?.includes('online') ?? false
}

function companyHasCity(business: BusinessDoc) {
  if (business.location?.cityId) return true
  return business.branches.some((branch) => Boolean(branch.location?.cityName || branch.location?.cityId || branch.location?.address))
}

async function domainsRequire(categoryIds: string[], requirement: string) {
  if (!categoryIds.length) return false
  const domains = await Promise.all(categoryIds.map((id) => findDomainById(id)))
  return domains.some((domain) => domain?.requirements.includes(requirement as never))
}

function hasLicenseData(profile?: ProviderProfileDoc | null, services: Array<{ details?: { licenseNumber?: string } }> = []) {
  if (!profile) return false
  if (profile.verification?.qualification === 'pending' || profile.verification?.qualification === 'verified') return true
  if (profile.qualificationClaims?.some((claim) => filledText(claim.referenceNumber))) return true
  return services.some((service) => filledText(service.details?.licenseNumber))
}

function hasPricing(
  services: Array<{ priceFrom?: number }>,
  offers: Array<{ price?: { model?: string; amountFrom?: number } }>,
) {
  if (services.some((service) => typeof service.priceFrom === 'number' && service.priceFrom >= 0)) return true
  return offers.some((offer) => {
    const model = offer.price?.model
    if (model === 'free' || model === 'quote') return true
    return typeof offer.price?.amountFrom === 'number'
  })
}

function privateSection(user: UserDoc) {
  return buildSection('private', 'Përdorues privat', true, [
    field('firstName', 'Emri', true, filledText(user.firstName)),
    field('lastName', 'Mbiemri', true, filledText(user.lastName)),
    field('profilePhoto', 'Foto profili', false, filledText(user.profilePhoto)),
    field('phone', 'Numri i telefonit', false, filledText(user.phone)),
    field('city', 'Qyteti', false, hasCity(user)),
    field('languages', 'Gjuhët', false, (user.languages?.length ?? 0) > 0),
    ...socialFields(user.socialLinks),
  ])
}

async function expertSection(
  profile: ProviderProfileDoc | null,
  services: Array<{ priceFrom?: number; subcategoryId?: string; details?: { licenseNumber?: string; experience?: string } }>,
  offers: Array<{ price?: { model?: string; amountFrom?: number }; subcategoryId?: Types.ObjectId }>,
) {
  if (!profile) return buildSection('expert', 'Ekspert', false, [])

  const categories = profile.categories ?? []
  const title = profile.publicProfile?.title
  const bio = profile.publicProfile?.description
  const skills = profile.specializations ?? []
  const hasSubcategory = (profile.subcategoryIds?.length ?? 0) > 0
    || services.some((service) => filledText(service.subcategoryId))
    || offers.some((offer) => Boolean(offer.subcategoryId))
  const yearsFilled = typeof profile.yearsOfExperience === 'number' && profile.yearsOfExperience >= 0

  const licenseApplicable = await domainsRequire(categories, 'license_verification')
  const pricingApplicable = services.length > 0 || offers.length > 0 || await domainsRequire(categories, 'offer_type_packages')
  const verificationApplicable = licenseApplicable

  return buildSection('expert', 'Ekspert', true, [
    field('profilePhoto', 'Foto profili', true, filledText(profile.publicProfile?.photoUrl)),
    field('title', 'Titulli profesional', true, filledText(title)),
    field('category', 'Kategoria', true, categories.length > 0),
    field('subcategory', 'Nënkategoria', true, hasSubcategory),
    field('bio', 'Bio / Përshkrimi', true, filledText(bio)),
    field('skills', 'Specializimet', true, skills.length > 0),
    field('yearsOfExperience', 'Vitet e përvojës', true, yearsFilled),
    field('serviceLocation', 'Qyteti / zona e shërbimit', true, providerHasServiceLocation(profile)),
    ...socialFields(profile.socialLinks),
    field('workExperience', 'Përvoja e punës', false, (profile.workExperience?.length ?? 0) > 0),
    field('education', 'Arsimi', false, (profile.education?.length ?? 0) > 0),
    field('certifications', 'Certifikimet', false, (profile.certifications?.length ?? 0) > 0),
    field('license', 'Licenca / certifikimi', true, hasLicenseData(profile, services), licenseApplicable),
    field('verification', 'Verifikimi', true, profile.verification.qualification !== 'unverified', verificationApplicable),
    field('pricing', 'Çmimi', true, hasPricing(services, offers), pricingApplicable),
  ])
}

function companyHasAddress(business: BusinessDoc) {
  return business.branches?.some((branch) => filledText(branch.location?.address)) ?? false
}

function companySection(business: BusinessDoc | null) {
  if (!business) return buildSection('company', 'Kompani', false, [])

  return buildSection('company', 'Kompani', true, [
    field('companyName', 'Emri i kompanisë', true, filledText(business.publicName)),
    field('logo', 'Logo', true, filledText(business.logoUrl)),
    field('companyEmail', 'Email i kompanisë', true, filledText(business.contactEmail)),
    field('companyPhone', 'Numri i telefonit', true, filledText(business.contactPhone)),
    field('companyCity', 'Qyteti', true, companyHasCity(business)),
    field('companyDescription', 'Përshkrimi', true, filledText(business.description)),
    field('companyCategory', 'Kategoria / industria', true, (business.categoryIds?.length ?? 0) > 0),
    field('website', 'Website', false, filledText(business.website)),
    field('address', 'Adresa', false, companyHasAddress(business)),
    ...socialFields(business.socialLinks),
  ])
}

export function parseProfileType(value: unknown): ProfileType {
  if (value === 'expert' || value === 'company' || value === 'private') return value
  return 'private'
}

export async function getProfileCompletion(uid: string, profileType: ProfileType = 'private'): Promise<ProfileCompletion> {
  const user = await User.findOne({ uid })
  if (!user) throw new Error('Përdoruesi nuk u gjet')

  const userId = await userIdForUid(uid)
  let section: ProfileCompletionSection

  if (profileType === 'private') {
    section = privateSection(user)
  } else if (profileType === 'expert') {
    const individualProfile = await ProviderProfile.findOne({ ownerUser: userId, providerType: 'individual' })
    const services = individualProfile
      ? await Service.find({ providerUid: uid, active: true }).select('priceFrom subcategoryId details').lean()
      : []
    const offers = individualProfile
      ? await ServiceOffer.find({
        providerProfile: individualProfile._id,
        status: { $in: ['draft', 'pending', 'published'] },
      }).select('price subcategoryId').lean()
      : []
    section = await expertSection(individualProfile, services, offers)
  } else {
    const business = await Business.findOne({
      $or: [{ owners: userId }, { members: { $elemMatch: { user: userId, role: 'manager' } } }],
      status: { $ne: 'closed' },
    }).sort({ createdAt: 1 })
    section = companySection(business)
  }

  return {
    profileType,
    exists: section.exists,
    overallPercent: section.exists ? section.percent : null,
    filledRequired: section.filledRequired,
    totalRequired: section.totalRequired,
    section,
    user: toPublicUser(user),
  }
}
