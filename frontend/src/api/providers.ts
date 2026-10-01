import api from './auth'
import type { ServiceItem } from './services'
import type {
  CertificationEntry,
  EducationEntry,
  MarketplaceProvider,
  WorkExperienceEntry,
} from './providerProfiles'
import { socialLinksFrom, type SocialLinks } from './socialLinks'
import { normalizeMarketplaceProvider } from '../utils/marketplaceProvider'

export type PublicProvider = {
  uid: string
  name: string
  role: string
  roleLabel: string
  headline?: string
  bio?: string
  location?: string
  skills?: string[]
  languages?: string[]
  profilePhoto?: string
  coverPhoto?: string
  ratingAverage: number
  ratingCount: number
}

export type PublicExpert = {
  uid: string
  name: string
  headline?: string
  photoUrl?: string
}

/** The provider's published directory profile (same data as the Ekspertët / Kompanitë cards). */
export type PublicProviderProfile = MarketplaceProvider & {
  about: string
  socialLinks: SocialLinks
  workExperience: WorkExperienceEntry[]
  education: EducationEntry[]
  certifications: CertificationEntry[]
}

function listOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function publicProfileFrom(raw: unknown): PublicProviderProfile | null {
  const card = normalizeMarketplaceProvider(raw)
  if (!card || typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  return {
    ...card,
    about: typeof record.about === 'string' ? record.about.trim() : '',
    socialLinks: socialLinksFrom(record.socialLinks as SocialLinks | undefined),
    workExperience: listOf<WorkExperienceEntry>(record.workExperience),
    education: listOf<EducationEntry>(record.education),
    certifications: listOf<CertificationEntry>(record.certifications),
  }
}

export async function fetchProviderProfile(uid: string) {
  const { data } = await api.get<{
    provider: PublicProvider
    services: ServiceItem[]
    experts?: PublicExpert[]
    profile?: unknown
  }>(`/api/providers/${uid}`)
  return { ...data, profile: publicProfileFrom(data.profile) }
}
