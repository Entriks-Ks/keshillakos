import type { PageParams, PaginationMeta } from './pagination'
import api from './auth'
import type { ServiceItem } from './services'
import { fetchProviderOpenSlots, type AvailabilitySlot } from './availability'
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
  plan?: 'basic' | 'pro'
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

export async function fetchProviderProfile(uid: string, params: PageParams & { expertsPage?: number } = {}) {
  const { data } = await api.get<{
    pagination: PaginationMeta
    expertsPagination: PaginationMeta
    provider: PublicProvider
    services: ServiceItem[]
    experts?: PublicExpert[]
    profile?: unknown
  }>(`/api/providers/${uid}`, { params })
  return { ...data, profile: publicProfileFrom(data.profile) }
}

export type ProviderComparisonItem = {
  uid: string
  provider: PublicProvider
  profile: PublicProviderProfile | null
  services: ServiceItem[]
  openSlots: AvailabilitySlot[]
}

const compareCache = new Map<string, { data: ProviderComparisonItem; timestamp: number }>()
const CACHE_TTL = 300_000 // 5 minutes

export async function fetchProvidersComparison(uids: string[]): Promise<ProviderComparisonItem[]> {
  const cleanUids = uids.filter(Boolean).slice(0, 3)
  if (cleanUids.length === 0) return []

  const now = Date.now()
  const cachedItems = new Map<string, ProviderComparisonItem>()
  const missingUids: string[] = []

  for (const uid of cleanUids) {
    const cached = compareCache.get(uid)
    if (cached && now - cached.timestamp < CACHE_TTL) {
      cachedItems.set(uid, cached.data)
    } else {
      missingUids.push(uid)
    }
  }

  // If all requested UIDs are fresh in memory, return immediately (0ms!)
  if (missingUids.length === 0) {
    return cleanUids.map((id) => cachedItems.get(id)!).filter(Boolean)
  }

  // Fetch only the missing UIDs
  let fetchedItems: ProviderComparisonItem[] = []
  try {
    const { data } = await api.get<{
      providers: Array<{
        uid: string
        provider: PublicProvider
        profile: unknown
        services: ServiceItem[]
        openSlots: AvailabilitySlot[]
      }>
    }>('/api/providers/compare', {
      params: { uids: missingUids.join(',') },
    })

    if (Array.isArray(data?.providers)) {
      fetchedItems = data.providers.map((item) => ({
        uid: item.uid,
        provider: item.provider,
        profile: publicProfileFrom(item.profile),
        services: item.services || [],
        openSlots: item.openSlots || [],
      }))
    }
  } catch (err) {
    console.warn('Backend compare endpoint fallback:', err)
  }

  // Fallback to individual fetches in parallel for any still-missing items
  const fetchedMap = new Map<string, ProviderComparisonItem>()
  for (const item of fetchedItems) {
    fetchedMap.set(item.uid, item)
    compareCache.set(item.uid, { data: item, timestamp: now })
  }

  const stillMissing = missingUids.filter((id) => !fetchedMap.has(id))
  if (stillMissing.length > 0) {
    const fallbackResults = await Promise.all(
      stillMissing.map(async (uid) => {
        try {
          const [profileData, slots] = await Promise.all([
            fetchProviderProfile(uid).catch(() => null),
            fetchProviderOpenSlots(uid).catch(() => []),
          ])
          if (!profileData) return null
          return {
            uid,
            provider: profileData.provider,
            profile: profileData.profile,
            services: profileData.services || [],
            openSlots: slots || [],
          }
        } catch {
          return null
        }
      }),
    )

    for (const item of fallbackResults) {
      if (item) {
        fetchedMap.set(item.uid, item)
        compareCache.set(item.uid, { data: item, timestamp: now })
      }
    }
  }

  // Return all requested UIDs in original order
  return cleanUids
    .map((id) => cachedItems.get(id) || fetchedMap.get(id))
    .filter((item): item is ProviderComparisonItem => Boolean(item))
}
