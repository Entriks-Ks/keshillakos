import api from './auth'

export type ServiceDetails = {
  licenseNumber?: string
  licenseVerified?: boolean
  documentsNote?: string
  deadlineNote?: string
  serviceTypeDetail?: string
  audience?: 'b2c' | 'b2b' | 'both'
  deliveryModes?: Array<'online' | 'physical' | 'group'>
  languageFrom?: string
  languageTo?: string
  certifiedTranslation?: boolean
  offerType?: 'package' | 'project' | 'service'
  priceTo?: number
  portfolioUrl?: string
  references?: string
  regulatoryNotice?: string
  coachingDisclaimerAccepted?: boolean
  crossBorder?: boolean
  supportLanguages?: string[]
}

export type ServiceProvider = {
  uid: string
  name: string
  email: string
  role: string
  roleLabel: string
  headline?: string
  bio?: string
  location?: string
  skills?: string[]
  languages?: string[]
  profilePhoto?: string
  ratingAverage: number
  ratingCount: number
}

export type ServiceItem = {
  id: string
  title: string
  description: string
  categoryId: string
  categoryLabel: string
  category?: string
  subcategory: string
  location: string
  priceFrom?: number
  details?: ServiceDetails
  providerUid: string
  providerName: string
  provider?: ServiceProvider
  active: boolean
  createdAt: string
}

export async function createService(payload: {
  title: string
  description: string
  categoryId: string
  subcategory: string
  location: string
  priceFrom?: number
  details?: ServiceDetails
}) {
  const { data } = await api.post<{ service: ServiceItem }>('/api/services', payload)
  return data.service
}

export async function fetchMyServices() {
  const { data } = await api.get<{ services: ServiceItem[] }>('/api/services/mine')
  return data.services
}

export async function fetchActiveServices() {
  const { data } = await api.get<{ services: ServiceItem[] }>('/api/services')
  return data.services
}
