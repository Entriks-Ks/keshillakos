import api from './auth'
import { postPhotoUpload } from './media'
import type { PublicExpert } from './providers'

export type ServiceDetails = {
  licenseNumber?: string
  licenseVerified?: boolean
  documentsNote?: string
  deadlineNote?: string
  serviceTypeDetail?: string
  audience?: string
  deliveryModes?: string[]
  languageFrom?: string
  languageTo?: string
  certifiedTranslation?: boolean
  offerType?: string
  priceTo?: number
  portfolioUrl?: string
  references?: string
  experience?: string
  availabilityMode?: 'by_arrangement' | 'request' | 'slots'
  regulatoryNotice?: string
  coachingDisclaimerAccepted?: boolean
  crossBorder?: boolean
  supportLanguages?: string[]
  photos?: string[]
}

export type ServiceProvider = {
  uid: string
  name: string
  email: string
  role: string
  roleLabel: string
  providerType?: 'individual' | 'business'
  headline?: string
  bio?: string
  location?: string
  skills?: string[]
  languages?: string[]
  profilePhoto?: string
  ratingAverage: number
  ratingCount: number
  yearsOfExperience?: number
  experience?: string
  certifications?: Array<{
    name: string
    issuer: string
    year: number
    credentialUrl?: string
  }>
  verification?: {
    identity?: string
    business?: string
    qualification?: string
  }
}

export type ResponsibleExpert = {
  id: string
  uid: string
  name: string
  headline?: string
  photoUrl?: string
}

export type ServiceItem = {
  id: string
  providerId?: string
  businessId?: string
  staffUserId?: string
  responsibleExpert?: ResponsibleExpert
  title: string
  description: string
  categoryId: string
  categoryLabel: string
  category?: string
  subcategory: string
  subcategoryId?: string
  location: string
  priceFrom?: number
  details?: ServiceDetails
  providerUid: string
  providerName: string
  provider?: ServiceProvider
  experts?: PublicExpert[]
  active: boolean
  createdAt: string
}

export type ServiceWritePayload = {
  title: string
  description: string
  categoryId: string
  subcategory: string
  subcategoryId?: string
  location: string
  priceFrom?: number
  details?: ServiceDetails
  providerId?: string
  businessId?: string
  staffUserId?: string | null
}

export async function createService(payload: ServiceWritePayload) {
  const { data } = await api.post<{ service: ServiceItem }>('/api/services', payload)
  return data.service
}

export async function fetchMyServices() {
  const { data } = await api.get<{ services: ServiceItem[] }>('/api/services/mine')
  return data.services
}

export async function updateService(id: string, payload: ServiceWritePayload) {
  const { data } = await api.patch<{ service: ServiceItem }>(`/api/services/${id}`, payload)
  return data.service
}

export async function deleteService(id: string) {
  await api.delete(`/api/services/${id}`)
}

export async function uploadServicePhoto(file: File) {
  const data = await postPhotoUpload<{ url: string }>(api, '/api/services/photos', file)
  return data.url
}

export type ServiceSearchParams = {
  cityId?: string
  categoryId?: string
  subcategoryId?: string
  serviceId?: string
  q?: string
}

export async function fetchActiveServices(params: ServiceSearchParams = {}, signal?: AbortSignal) {
  const { data } = await api.get<{ services: ServiceItem[] }>('/api/services', { params, signal })
  return data.services
}

export async function fetchService(id: string) {
  const { data } = await api.get<{ service: ServiceItem }>(`/api/services/${id}`)
  return data.service
}
