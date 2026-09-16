import mongoose from 'mongoose'
import {
  COACHING_DISCLAIMER,
  FINANCE_REGULATORY_NOTICE,
  domainRequires,
} from '../data/domains'
import { Service, type ServiceDetails, type ServiceDoc } from '../models/Service'
import { findDomainById } from './domainService'
import {
  getProvidersPublicDetails,
  type ProviderPublicDetails,
} from './providerPublicService'

export type CreateServiceInput = {
  title: string
  description: string
  categoryId: string
  subcategory: string
  location: string
  priceFrom?: number
  details?: ServiceDetails
  providerUid: string
  providerName: string
}

function toService(
  doc: ServiceDoc & { _id: { toString(): string } },
  provider?: ProviderPublicDetails,
) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    categoryId: doc.categoryId,
    categoryLabel: doc.categoryLabel,
    category: doc.categoryLabel,
    subcategory: doc.subcategory,
    location: doc.location,
    priceFrom: doc.priceFrom,
    details: doc.details ?? {},
    providerUid: doc.providerUid,
    providerName: provider?.name || doc.providerName,
    provider: provider ?? {
      uid: doc.providerUid,
      name: doc.providerName,
      email: '',
      role: 'unknown' as const,
      roleLabel: 'Ofrues',
      headline: '',
      bio: '',
      location: '',
      skills: [],
      languages: [],
      profilePhoto: '',
      ratingAverage: 0,
      ratingCount: 0,
    },
    active: doc.active,
    createdAt: doc.createdAt,
  }
}

export async function validateServiceDetails(
  categoryId: string,
  details: ServiceDetails = {},
): Promise<ServiceDetails> {
  const next: ServiceDetails = { ...details }

  if (domainRequires(categoryId, 'license_verification')) {
    if (!next.licenseNumber?.trim()) {
      throw new Error('Për kategorinë Ligj duhet numri i licencës / verifikimi')
    }
  }

  if (domainRequires(categoryId, 'documents_deadlines')) {
    if (!next.serviceTypeDetail?.trim()) {
      throw new Error('Për Taksa/Kontabilitet duhet lloji i shërbimit')
    }
  }

  if (domainRequires(categoryId, 'audience_b2c_b2b') && !next.audience) {
    throw new Error('Zgjidh audiencën: B2C, B2B ose të dyja')
  }

  if (domainRequires(categoryId, 'delivery_mode')) {
    if (!next.deliveryModes?.length) {
      throw new Error('Zgjidh mënyrën e mbajtjes: Online, Fizikisht ose Grup')
    }
  }

  if (domainRequires(categoryId, 'language_pair')) {
    if (!next.languageFrom?.trim() || !next.languageTo?.trim()) {
      throw new Error('Duhet kombinimi i gjuhëve (p.sh. Shqip → Gjermanisht)')
    }
  }

  if (domainRequires(categoryId, 'offer_type_packages') && !next.offerType) {
    throw new Error('Zgjidh llojin: Service Package ose Project')
  }

  if (domainRequires(categoryId, 'portfolio_references')) {
    if (!next.portfolioUrl?.trim() && !next.references?.trim()) {
      throw new Error('Për Marketing duhet Portfolio ose Referenca')
    }
  }

  if (domainRequires(categoryId, 'regulatory_notice')) {
    next.regulatoryNotice = next.regulatoryNotice?.trim() || FINANCE_REGULATORY_NOTICE
  }

  if (domainRequires(categoryId, 'coaching_boundary')) {
    if (!next.coachingDisclaimerAccepted) {
      throw new Error('Duhet të pranosh kufirin: Coaching ≠ terapi / trajtim mjekësor')
    }
  }

  if (domainRequires(categoryId, 'cross_border_multilingual')) {
    next.crossBorder = true
    if (!next.supportLanguages?.length) {
      throw new Error('Për Diaspora zgjidh të paktën një gjuhë mbështetëse')
    }
  }

  return next
}

async function withProviders(docs: Array<ServiceDoc & { _id: { toString(): string } }>) {
  const fallback = new Map(docs.map((d) => [d.providerUid, d.providerName]))
  const providers = await getProvidersPublicDetails(
    docs.map((d) => d.providerUid),
    fallback,
  )
  return docs.map((doc) => toService(doc, providers.get(doc.providerUid)))
}

export async function createService(input: CreateServiceInput) {
  const domain = await findDomainById(input.categoryId)
  if (!domain) throw new Error('Kategoria nuk ekziston')

  const details = await validateServiceDetails(input.categoryId, input.details)

  const service = await Service.create({
    title: input.title.trim(),
    description: input.description.trim(),
    categoryId: domain.id,
    categoryLabel: domain.labelSq,
    subcategory: input.subcategory.trim(),
    location: input.location.trim(),
    priceFrom: input.priceFrom,
    details,
    providerUid: input.providerUid,
    providerName: input.providerName,
    active: true,
  })

  const [enriched] = await withProviders([service])
  return enriched
}

export async function listServicesByProvider(providerUid: string) {
  const services = await Service.find({ providerUid }).sort({ createdAt: -1 })
  return withProviders(services)
}

export async function listActiveServices() {
  const services = await Service.find({ active: true }).sort({ createdAt: -1 }).limit(50)
  return withProviders(services)
}

export async function getActiveServiceById(id: string) {
  if (!mongoose.isValidObjectId(id)) return null
  const service = await Service.findOne({ _id: id, active: true })
  if (!service) return null
  const [enriched] = await withProviders([service])
  return enriched
}

export async function listActiveServicesByProvider(providerUid: string) {
  const services = await Service.find({ providerUid, active: true }).sort({ createdAt: -1 })
  return withProviders(services)
}

export { COACHING_DISCLAIMER }
