import { Business } from '../models/Business'
import { ProviderProfile } from '../models/ProviderProfile'
import { User } from '../models/User'
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
  coverPhoto: string
  ratingAverage: number
  ratingCount: number
}

const PUBLIC_PROFILE_ROLES: UserRole[] = ['provider', 'company', 'admin']

/**
 * `role` follows the dashboard context the user last switched to, so an expert
 * browsing in client mode reports `user`. Public visibility must follow the
 * granted capabilities in `roles` instead.
 */
export function publicProfileRole(user: { role?: UserRole; roles?: UserRole[] }): UserRole | null {
  const granted = user.roles ?? []
  if (user.role && granted.includes(user.role) && PUBLIC_PROFILE_ROLES.includes(user.role)) return user.role
  return PUBLIC_PROFILE_ROLES.find((role) => granted.includes(role)) ?? null
}

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
      coverPhoto: '',
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
  const role = user ? publicProfileRole(user) : null
  if (!user || !role) return null

  const details = await getProvidersPublicDetails([user.uid])
  const provider = details.get(user.uid)
  if (!provider) return null

  const owner = await User.findOne({ uid: user.uid }).select('_id').lean()
  let coverPhoto = ''
  let profilePhoto = provider.profilePhoto
  if (owner) {
    if (role === 'company') {
      const business = await Business.findOne({ owners: owner._id }).select('coverUrl logoUrl').lean()
      coverPhoto = business?.coverUrl || ''
      profilePhoto = business?.logoUrl || profilePhoto
    } else {
      const profile = await ProviderProfile.findOne({ ownerUser: owner._id, providerType: 'individual' }).select('publicProfile.coverUrl publicProfile.photoUrl').lean()
      coverPhoto = profile?.publicProfile?.coverUrl || ''
      profilePhoto = profilePhoto || profile?.publicProfile?.photoUrl || ''
    }
  }

  return {
    uid: provider.uid,
    name: provider.name,
    role,
    roleLabel: ROLE_LABELS[role],
    headline: provider.headline,
    bio: provider.bio,
    location: provider.location,
    skills: provider.skills,
    languages: provider.languages,
    profilePhoto,
    coverPhoto,
    ratingAverage: provider.ratingAverage,
    ratingCount: provider.ratingCount,
  }
}
