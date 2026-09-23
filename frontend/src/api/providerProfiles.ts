import api from './auth'
import { photoFormData, postPhotoUpload, validateImageFile, MAX_IMAGE_BYTES } from './media'
import type { SavedLocationIds } from './locations'
import type { SocialLinks } from './socialLinks'

export type MonthYear = {
  month: number
  year: number
}

export type WorkExperienceEntry = {
  position: string
  organization: string
  from: MonthYear
  to?: MonthYear
  current: boolean
  description?: string
}

export type EducationEntry = {
  institution: string
  degree: string
  fieldOfStudy: string
  from: MonthYear
  to?: MonthYear
  current: boolean
}

export type CertificationEntry = {
  name: string
  issuer: string
  year: number
  credentialUrl?: string
}

export type ManagedProviderProfile = {
  _id: string
  id?: string
  providerType: 'individual' | 'business'
  publicProfile: {
    displayName: string
    title?: string
    description?: string
    shortDescription?: string
    photoUrl?: string
    publicEmail?: string
    publicPhone?: string
  }
  categories: string[]
  subcategoryIds?: string[]
  languages?: string[]
  yearsOfExperience?: number
  experience?: string
  specializations?: string[]
  socialLinks?: SocialLinks
  workExperience?: WorkExperienceEntry[]
  education?: EducationEntry[]
  certifications?: CertificationEntry[]
  location?: SavedLocationIds
  serviceAreaCityIds?: string[]
  modes?: Array<'online' | 'on_site'>
  verification?: {
    identity: string
    business: string
    qualification: string
  }
  qualificationClaims?: Array<{ categoryId: string; referenceNumber?: string; status?: string }>
}

export type ProviderProfileUpdatePayload = {
  categories?: string[]
  subcategoryIds?: string[]
  languages?: string[]
  yearsOfExperience?: number | null
  experience?: string
  specializations?: string[]
  socialLinks?: SocialLinks | null
  workExperience?: WorkExperienceEntry[]
  education?: EducationEntry[]
  certifications?: CertificationEntry[]
  location?: SavedLocationIds | null
  serviceAreaCityIds?: string[]
  modes?: Array<'online' | 'on_site'>
  publicProfile?: {
    displayName?: string
    title?: string
    description?: string
    shortDescription?: string
    photoUrl?: string
  }
  qualificationClaims?: Array<{ categoryId: string; referenceNumber?: string; status?: 'unverified' | 'verified' | 'rejected' }>
}

const currentYear = new Date().getFullYear()

export function emptyMonthYear(year = currentYear): MonthYear {
  return { month: 1, year }
}

export function emptyWorkExperience(): WorkExperienceEntry {
  return {
    position: '',
    organization: '',
    from: emptyMonthYear(),
    to: emptyMonthYear(),
    current: false,
    description: '',
  }
}

export function emptyEducation(): EducationEntry {
  return {
    institution: '',
    degree: '',
    fieldOfStudy: '',
    from: emptyMonthYear(),
    to: emptyMonthYear(),
    current: false,
  }
}

export function emptyCertification(): CertificationEntry {
  return {
    name: '',
    issuer: '',
    year: new Date().getFullYear(),
    credentialUrl: '',
  }
}

export async function fetchMyProviderProfiles(signal?: AbortSignal) {
  const { data } = await api.get<{ providers: ManagedProviderProfile[] }>('/api/providers/mine', { signal })
  return data.providers
}

export async function updateProviderLocations(id: string, values: { location: SavedLocationIds | null; serviceAreaCityIds: string[] }) {
  const { data } = await api.patch<{ provider: ManagedProviderProfile }>(`/api/providers/${encodeURIComponent(id)}`, values)
  return data.provider
}

export async function updateMyProviderProfile(id: string, values: ProviderProfileUpdatePayload) {
  const { data } = await api.patch<{ provider: ManagedProviderProfile }>(`/api/providers/${encodeURIComponent(id)}`, values)
  return data.provider
}

export async function uploadProviderPhoto(id: string, file: File) {
  const data = await postPhotoUpload<{ provider: ManagedProviderProfile }>(
    api,
    `/api/providers/${encodeURIComponent(id)}/photo`,
    file,
  )
  return data.provider
}

// Re-export for callers that validate images before provider photo upload.
export { validateImageFile, MAX_IMAGE_BYTES, photoFormData }
