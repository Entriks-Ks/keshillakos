import { Types } from 'mongoose'
import { Business } from '../models/Business'
import { ProviderProfile } from '../models/ProviderProfile'
import { User } from '../models/User'
import { ROLE_LABELS, type UserRole } from '../types/roles'
import { getStatsForProviders } from './ratingService'
import { clampBio, isPro, recordPlanEvent } from './planService'
import { findUserByUid, findUsersByUids, toPublicUser } from './userService'

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
  plan: 'basic' | 'pro'
}

const PUBLIC_PROFILE_ROLES: UserRole[] = ['provider', 'company']

/**
 * `role` follows the dashboard context the user last switched to, so an expert
 * browsing in client mode reports `user`. Public visibility must follow the
 * granted capabilities in `roles` instead.
 */
export function publicProfileRole(user: { role?: UserRole; roles?: UserRole[] }): UserRole | null {
  const granted = user.roles ?? []
  if (user.role === 'admin' || granted.includes('admin')) return null
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
      plan: 'basic',
    })
  }

  return map
}

/** Resolves a provider's User document from any identifier (UID, MongoDB _id, slug, or display name) */
export async function resolveProviderUser(rawIdentifier: string) {
  const id = rawIdentifier?.trim()
  if (!id) return null

  // 1. Direct match on user.uid (Firebase UID)
  let user = await User.findOne({ uid: id }).lean()
  if (user) return user

  // 2. If it's a valid 24-char ObjectId:
  if (Types.ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(id)) {
    // 2a. Could be User._id
    user = await User.findById(id).lean()
    if (user) return user

    // 2b. Could be ProviderProfile._id
    const profile = await ProviderProfile.findById(id).select('ownerUser').lean()
    if (profile?.ownerUser) {
      user = await User.findById(profile.ownerUser).lean()
      if (user) return user
    }

    // 2c. Could be Business._id
    const biz = await Business.findById(id).select('owners').lean()
    if (biz?.owners?.[0]) {
      user = await User.findById(biz.owners[0]).lean()
      if (user) return user
    }
  }

  // 3. Slug suffix extraction: e.g. "av-arben-krasniqi-fire_uid_123" or multi-hyphen strings
  if (id.includes('-')) {
    const parts = id.split('-')
    for (let i = 1; i < parts.length; i++) {
      const candidate = parts.slice(i).join('-')
      user = await User.findOne({ uid: candidate }).lean()
      if (user) return user
      if (Types.ObjectId.isValid(candidate) && /^[a-f\d]{24}$/i.test(candidate)) {
        user = await User.findById(candidate).lean()
        if (user) return user
        const profile = await ProviderProfile.findById(candidate).select('ownerUser').lean()
        if (profile?.ownerUser) {
          user = await User.findById(profile.ownerUser).lean()
          if (user) return user
        }
      }
    }
  }

  // 4. Match by displayName or name (e.g. from slug "avokat-fatmir-berisha" or "fatmir-berisha")
  const cleaned = id
    .replace(/[-_]+/g, ' ')
    .replace(/^avokat\s+/i, '')
    .replace(/^av\s+/i, '')
    .trim()

  if (cleaned.length >= 3) {
    const rx = new RegExp(cleaned, 'i')
    const profile = await ProviderProfile.findOne({
      $or: [
        { 'publicProfile.displayName': rx },
        { 'publicProfile.title': rx },
      ],
      status: 'published',
    }).select('ownerUser').lean()
    if (profile?.ownerUser) {
      user = await User.findById(profile.ownerUser).lean()
      if (user) return user
    }

    user = await User.findOne({
      name: rx,
      roles: { $in: ['provider', 'company'] },
    }).lean()
    if (user) return user

    const biz = await Business.findOne({
      publicName: rx,
      status: 'active',
    }).select('owners').lean()
    if (biz?.owners?.[0]) {
      user = await User.findById(biz.owners[0]).lean()
      if (user) return user
    }
  }

  return null
}

/** Public profile page payload (no email). */
export async function getPublicProviderProfile(uid: string) {
  if (!uid?.trim()) return null

  const userDoc = await resolveProviderUser(uid.trim())
  if (!userDoc) return null

  const user = toPublicUser(userDoc)
  const role = user ? publicProfileRole(user) : null
  if (!user || !role) return null

  const details = await getProvidersPublicDetails([user.uid])
  const provider = details.get(user.uid)
  if (!provider) return null

  const owner = userDoc
  let coverPhoto = ''
  let profilePhoto = provider.profilePhoto
  let name = provider.name
  let bio = provider.bio
  let headline = provider.headline
  let languages = provider.languages
  let languageSkills: import('../models/profileDetails').LanguageSkill[] = []
  let workExperience: import('../models/providerCareer').WorkExperienceEntry[] = []
  if (owner) {
    if (role === 'company') {
      const business = await Business.findOne({ owners: owner._id }).select('publicName description coverUrl logoUrl').lean()
      coverPhoto = business?.coverUrl || ''
      profilePhoto = business?.logoUrl || profilePhoto
      name = business?.publicName || name
      bio = business?.description || bio
    } else {
      const profile = await ProviderProfile.findOne({ ownerUser: owner._id, providerType: 'individual' }).select('publicProfile languages languageSkills workExperience').lean()
      if (profile) {
        bio = profile.publicProfile.description ?? profile.publicProfile.shortDescription ?? bio
        headline = profile.publicProfile.title ?? headline
        languages = profile.languages
        languageSkills = profile.languageSkills || []
        workExperience = profile.workExperience || []
      }
      coverPhoto = profile?.publicProfile?.coverUrl || ''
      profilePhoto = profilePhoto || profile?.publicProfile?.photoUrl || ''
    }
  }

  const audience = role === 'company' ? 'company' as const : 'provider' as const
  const pro = await isPro(user.uid, audience)
  if (pro) await recordPlanEvent(user.uid, audience, 'visits')
  const publicBio = clampBio(bio, pro)
  return {
    uid: provider.uid,
    name,
    role,
    roleLabel: ROLE_LABELS[role],
    headline,
    bio: publicBio,
    location: provider.location,
    skills: pro ? provider.skills : [],
    languages: pro ? languages : [],
    languageSkills: pro ? languageSkills : [],
    workExperience: pro ? workExperience : [],
    profilePhoto: pro ? profilePhoto : '',
    coverPhoto: pro ? coverPhoto : '',
    plan: pro ? 'pro' as const : 'basic' as const,
    ratingAverage: provider.ratingAverage,
    ratingCount: provider.ratingCount,
  }
}
