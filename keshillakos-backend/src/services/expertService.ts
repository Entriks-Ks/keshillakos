import { domainRequires } from '../data/domains'
import { Expert, type ExpertDoc } from '../models/Expert'
import { findDomainById } from './domainService'

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
  companyUid: string
  companyName: string
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

  if (domainRequires(input.categoryId, 'license_verification') && !input.licenseNumber?.trim()) {
    throw new Error('Për Ligj duhet numri i licencës së ekspertit')
  }

  if (
    domainRequires(input.categoryId, 'language_pair') &&
    (!input.languageFrom?.trim() || !input.languageTo?.trim())
  ) {
    throw new Error('Duhet kombinimi i gjuhëve për ekspertin e përkthimit')
  }

  if (domainRequires(input.categoryId, 'delivery_mode') && !input.deliveryModes?.length) {
    throw new Error('Zgjidh Online / Fizikisht / Grup')
  }

  const expert = await Expert.create({
    name: input.name.trim(),
    title: input.title.trim(),
    categoryId: domain.id,
    categoryLabel: domain.labelSq,
    specialty: input.specialty.trim(),
    bio: input.bio.trim(),
    location: input.location.trim(),
    licenseNumber: input.licenseNumber?.trim(),
    licenseVerified: false,
    languageFrom: input.languageFrom?.trim(),
    languageTo: input.languageTo?.trim(),
    deliveryModes: input.deliveryModes,
    crossBorder: domainRequires(input.categoryId, 'cross_border_multilingual')
      ? true
      : Boolean(input.crossBorder),
    companyUid: input.companyUid,
    companyName: input.companyName,
    active: true,
  })

  return toExpert(expert)
}

export async function listExpertsByCompany(companyUid: string) {
  const experts = await Expert.find({ companyUid }).sort({ createdAt: -1 })
  return experts.map((e) => toExpert(e))
}

export async function listActiveExperts() {
  const experts = await Expert.find({ active: true }).sort({ createdAt: -1 }).limit(50)
  return experts.map((e) => toExpert(e))
}
