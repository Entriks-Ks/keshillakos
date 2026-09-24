import { ROLE_LABELS, type UserRole } from '../types/roles'
import { getStatsForProviders } from './ratingService'
import { findUserByUid, findUsersByUids } from './userService'

export type ProviderPublicDetails = {
  uid: string
  name: string
  email: string
  role: UserRole | 'unknown'
  roleLabel: string
  headline: string
  bio: string
  location: string
  skills: string[]
  languages: string[]
  profilePhoto: string
  ratingAverage: number
  ratingCount: number
}

const PUBLIC_PROFILE_ROLES: UserRole[] = ['provider', 'company', 'admin']

export async function getProvidersPublicDetails(
  providerUids: string[],
  fallbackNames: Map<string, string> = new Map(),
): Promise<Map<string, ProviderPublicDetails>> {
  const unique = [...new Set(providerUids.filter(Boolean))]
  const map = new Map<string, ProviderPublicDetails>()
  if (unique.length === 0) return map

  const [users, stats] = await Promise.all([
    findUsersByUids(unique),
    getStatsForProviders(unique),
  ])

  for (const uid of unique) {
    const user = users.get(uid)
    const rating = stats.get(uid)
    const role = user?.role ?? 'unknown'
    map.set(uid, {
      uid,
      name: user?.name || fallbackNames.get(uid) || 'Ofrues',
      email: user?.email || '',
      role,
      roleLabel: role === 'unknown' ? 'Ofrues' : ROLE_LABELS[role],
      headline: user?.headline || '',
      bio: user?.bio || '',
      location: user?.location || '',
      skills: user?.skills ?? [],
      languages: user?.languages ?? [],
      profilePhoto: user?.profilePhoto || '',
      ratingAverage: rating?.average ?? 0,
      ratingCount: rating?.count ?? 0,
    })
  }

  return map
}

/** Public profile page payload (no email). */
export async function getPublicProviderProfile(uid: string) {
  if (!uid?.trim()) return null

  const user = await findUserByUid(uid.trim())
  if (!user || !PUBLIC_PROFILE_ROLES.includes(user.role)) return null

  const details = await getProvidersPublicDetails([user.uid])
  const provider = details.get(user.uid)
  if (!provider) return null

  return {
    uid: provider.uid,
    name: provider.name,
    role: provider.role,
    roleLabel: provider.roleLabel,
    headline: provider.headline,
    bio: provider.bio,
    location: provider.location,
    skills: provider.skills,
    languages: provider.languages,
    profilePhoto: provider.profilePhoto,
    ratingAverage: provider.ratingAverage,
    ratingCount: provider.ratingCount,
  }
}
