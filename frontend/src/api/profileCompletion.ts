import api, { type AuthUser } from './auth'
import type { SocialLinkKey } from './socialLinks'

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
  user: AuthUser
}

export async function fetchProfileCompletion(profileType: ProfileType, signal?: AbortSignal) {
  const { data } = await api.get<{ completion: ProfileCompletion }>('/api/auth/me/profile-completion', {
    params: { type: profileType },
    signal,
  })
  return data.completion
}
