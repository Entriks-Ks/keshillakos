import api from './auth'
import { postPhotoUpload } from './media'
import type { SavedLocationIds } from './locations'
import type { SocialLinks } from './socialLinks'

export type BusinessProfile = {
  _id: string
  publicName: string
  legalName?: string
  logoUrl?: string
  description?: string
  website?: string
  contactEmail?: string
  contactPhone?: string
  categoryIds?: string[]
  location?: SavedLocationIds
  socialLinks?: SocialLinks
  branches?: Array<{ name: string; location: { cityName?: string; address?: string } }>
  verification?: { status: 'unverified' | 'pending' | 'verified' | 'rejected' }
  status?: string
}

export type BusinessUpdatePayload = {
  publicName?: string
  legalName?: string | null
  logoUrl?: string | null
  description?: string | null
  website?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  categoryIds?: string[]
  location?: SavedLocationIds | null
  socialLinks?: SocialLinks | null
  branches?: Array<{
    name: string
    location: {
      countryCode: string
      cityName?: string
      cityId?: string
      address?: string
      online?: boolean
    }
  }>
}

export async function fetchMyBusinesses(signal?: AbortSignal) {
  const { data } = await api.get<{ businesses: BusinessProfile[] }>('/api/businesses/mine', { signal })
  return data.businesses
}

export async function updateBusinessProfile(id: string, values: BusinessUpdatePayload) {
  const { data } = await api.patch<{ business: BusinessProfile }>(`/api/businesses/${encodeURIComponent(id)}`, values)
  return data.business
}

export async function uploadBusinessLogo(id: string, file: File) {
  const data = await postPhotoUpload<{ business: BusinessProfile }>(
    api,
    `/api/businesses/${encodeURIComponent(id)}/logo`,
    file,
  )
  return data.business
}
