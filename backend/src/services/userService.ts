import { User, type UserDoc } from '../models/User'
import { ProviderProfile } from '../models/ProviderProfile'
import { City } from '../models/City'
import { Country } from '../models/Country'
import { Types } from 'mongoose'
import { isUserRole, type UserRole } from '../types/roles'
import { deleteUpload, normalizeUploadPath } from './mediaService'

export type SavedLocation = { countryId: string; cityId: string }
export type PublicUser = Omit<UserDoc, 'location'> & { location: string; savedLocation?: SavedLocation }

export function effectiveRoles(user: Pick<UserDoc, 'role' | 'roles'>): UserRole[] {
  const granted = user.roles?.filter(isUserRole)
  if (granted) return [...new Set<UserRole>(['user', ...granted])]
  // Existing admin accounts were not available through public registration.
  return user.role === 'admin' ? ['user', 'admin'] : ['user']
}

function cleanOptional(value?: string) {
  return value?.trim() || undefined
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/)
  return { firstName: parts.shift() || undefined, lastName: parts.join(' ') || undefined }
}

export function toPublicUser(user: {
  uid: string
  email: string
  name: string
  role?: UserRole
  roles?: UserRole[]
  requestedRole?: UserRole
  firstName?: string
  lastName?: string
  phone?: string
  locale?: string
  country?: string
  city?: string
  verification?: UserDoc['verification']
  privacy?: UserDoc['privacy']
  accountStatus?: UserDoc['accountStatus']
  headline?: string
  bio?: string
  location?: UserDoc['location'] | string
  legacyLocation?: string
  savedLocation?: SavedLocation
  skills?: string[]
  languages?: string[]
  profilePhoto?: string
  createdAt?: Date
  updatedAt?: Date
}): PublicUser {
  const roles = effectiveRoles({ role: user.role ?? 'user', roles: user.roles })
  return {
    uid: user.uid,
    email: user.email,
    name: user.name,
    role: roles.find((role) => role !== 'user') ?? 'user',
    roles,
    requestedRole: user.requestedRole,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    locale: user.locale,
    country: user.country,
    city: user.city,
    verification: user.verification,
    privacy: user.privacy,
    accountStatus: user.accountStatus ?? 'active',
    headline: user.headline || '',
    bio: user.bio || '',
    location: typeof user.location === 'string' ? user.location : user.legacyLocation || '',
    savedLocation: user.savedLocation ?? (user.location && typeof user.location !== 'string'
      ? { countryId: String(user.location.countryId), cityId: String(user.location.cityId) }
      : undefined),
    skills: user.skills ?? [],
    languages: user.languages ?? [],
    profilePhoto: user.profilePhoto || '',
    createdAt: user.createdAt ?? new Date(),
    updatedAt: user.updatedAt ?? user.createdAt ?? new Date(),
  }
}

export async function upsertUser(input: {
  uid: string
  email: string
  name: string
  firstName?: string
  lastName?: string
  /** Registration preference, not an authorization grant. */
  requestedRole?: UserRole
  /** Only trusted admin paths may supply granted roles. */
  grantedRoles?: UserRole[]
  /** When true, overwrite name (register / explicit rename) */
  updateName?: boolean
}): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase()
  const name = input.name.trim() || input.email.split('@')[0] || 'User'

  const $set: Record<string, unknown> = { email }
  if (input.updateName) Object.assign($set, {
    name,
    firstName: input.firstName ?? splitName(name).firstName,
    lastName: input.lastName ?? splitName(name).lastName,
  })

  // MongoDB forbids the same path in both $set and $setOnInsert
  const $setOnInsert: Record<string, unknown> = {
    uid: input.uid,
    role: input.grantedRoles?.find((role) => role !== 'user') ?? 'user',
    roles: input.grantedRoles ?? ['user'],
    requestedRole: input.requestedRole,
  }
  if (!input.updateName) Object.assign($setOnInsert, { name, ...splitName(name) })

  const user = await User.findOneAndUpdate(
    { uid: input.uid },
    { $set, $setOnInsert },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  )

  return toPublicUser(user)
}

export async function grantCapability(uid: string, role: 'provider' | 'company') {
  const existing = await User.findOne({ uid, accountStatus: 'active' })
  if (!existing) throw new Error('Llogaria nuk u gjet ose nuk është aktive')
  existing.roles = [...new Set<UserRole>(['user', ...(existing.roles?.filter(isUserRole) ?? []), role])]
  if (existing.role !== 'admin') existing.role = role
  existing.requestedRole = undefined
  await existing.save()
  return toPublicUser(existing)
}

export async function requestRoleChange(uid: string, role: 'provider' | 'company') {
  const existing = await User.findOne({ uid })
  if (!existing) throw new Error('Përdoruesi nuk u gjet')
  if (existing.accountStatus && existing.accountStatus !== 'active') {
    throw new Error('Llogaria nuk është aktive')
  }
  const roles = effectiveRoles(existing)
  if (roles.includes(role)) throw new Error('Ke tashmë këtë rol')
  if (existing.requestedRole && existing.requestedRole !== role && !roles.includes(existing.requestedRole)) {
    throw new Error('Ke tashmë një kërkesë roli në pritje')
  }
  existing.requestedRole = role
  await existing.save()
  return toPublicUser(existing)
}

export async function listPendingRoleRequests() {
  const users = await User.find({ requestedRole: { $in: ['provider', 'company'] } }).sort({ updatedAt: -1 }).lean()
  return users.map(toPublicUser).filter((user) => user.requestedRole && !(user.roles ?? []).includes(user.requestedRole))
}

export async function reviewRoleRequest(uid: string, action: 'accept' | 'reject') {
  const existing = await User.findOne({ uid })
  if (!existing) throw new Error('Përdoruesi nuk u gjet')
  const requested = existing.requestedRole
  if (requested !== 'provider' && requested !== 'company') {
    throw new Error('Nuk ka kërkesë në pritje')
  }
  if (action === 'reject') {
    existing.requestedRole = undefined
    await existing.save()
    return toPublicUser(existing)
  }
  return grantCapability(uid, requested)
}

export async function findUserByUid(uid: string): Promise<PublicUser | null> {
  const user = await User.findOne({ uid }).lean()
  if (!user) return null
  return toPublicUser(user)
}

export async function findUsersByUids(uids: string[]) {
  const unique = [...new Set(uids.filter(Boolean))]
  if (unique.length === 0) return new Map<string, PublicUser>()

  const users = await User.find({ uid: { $in: unique } }).lean()
  const map = new Map<string, PublicUser>()
  for (const user of users) {
    map.set(user.uid, toPublicUser(user))
  }
  return map
}

export async function listUsers(filters?: { role?: UserRole; q?: string }) {
  const query: Record<string, unknown> = {}
  if (filters?.role && isUserRole(filters.role)) {
    query.$or = filters.role === 'user'
      ? [{ roles: 'user' }, { roles: { $exists: false } }]
      : filters.role === 'admin'
        ? [{ roles: 'admin' }, { role: 'admin', roles: { $exists: false } }]
        : [{ roles: filters.role }]
  }
  if (filters?.q?.trim()) {
    const q = filters.q.trim()
    query.$and = [{ $or: [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { uid: { $regex: q, $options: 'i' } },
    ] }]
  }

  const users = await User.find(query).sort({ createdAt: -1 }).lean()
  return users.map((u) => toPublicUser(u))
}

function cleanStringList(values?: string[], maxItems = 20, itemMax = 48) {
  if (!values) return undefined
  return [...new Set(values.map((value) => value.trim()).filter(Boolean).map((value) => value.slice(0, itemMax)))].slice(0, maxItems)
}

export async function updateOwnProfile(
  uid: string,
  input: {
    firstName?: string
    lastName?: string
    phone?: string | null
    locale?: string
    country?: string
    city?: string
    profileVisibility?: 'public' | 'private'
    marketingConsent?: boolean
    savedLocation?: SavedLocation | null
    headline?: string
    bio?: string
    skills?: string[]
    languages?: string[]
    legacyLocation?: string
  },
): Promise<PublicUser> {
  const existing = await User.findOne({ uid })
  if (!existing) throw new Error('Përdoruesi nuk u gjet')

  if (input.firstName !== undefined) {
    const firstName = input.firstName.trim()
    if (!firstName || firstName.length > 80) throw new Error('Emri duhet të jetë 1–80 karaktere')
    existing.firstName = firstName
  }
  if (input.lastName !== undefined) {
    const lastName = input.lastName.trim()
    if (!lastName || lastName.length > 80) throw new Error('Mbiemri duhet të jetë 1–80 karaktere')
    existing.lastName = lastName
  }
  if (input.firstName !== undefined || input.lastName !== undefined) {
    // Retain the legacy display name for existing consumers; the profile API uses separate fields.
    existing.name = [existing.firstName, existing.lastName].filter(Boolean).join(' ')
  }
  if (input.phone !== undefined) existing.phone = cleanOptional(input.phone ?? undefined)
  if (input.locale !== undefined) existing.locale = cleanOptional(input.locale)
  if (input.country !== undefined) existing.country = cleanOptional(input.country)?.toUpperCase()
  if (input.city !== undefined) existing.city = cleanOptional(input.city)
  if (input.profileVisibility !== undefined) {
    existing.set('privacy.profileVisibility', input.profileVisibility)
  }
  if (input.marketingConsent !== undefined) {
    existing.set('privacy.marketingConsent', input.marketingConsent)
  }
  if (input.savedLocation !== undefined) {
    if (existing.legacyLocation) existing.markModified('legacyLocation')
    if (input.savedLocation === null) {
      existing.location = undefined
    } else {
      const { countryId, cityId } = input.savedLocation
      if (!Types.ObjectId.isValid(countryId) || !Types.ObjectId.isValid(cityId)) throw new Error('Lokacioni është i pavlefshëm')
      const [country, city] = await Promise.all([
        Country.exists({ _id: countryId, isActive: true }),
        City.exists({ _id: cityId, countryId, isActive: true }),
      ])
      if (!country || !city) throw new Error('Qyteti dhe shteti nuk përputhen ose nuk janë aktivë')
      existing.location = { countryId: new Types.ObjectId(countryId), cityId: new Types.ObjectId(cityId) }
    }
  }
  if (input.headline !== undefined) {
    const headline = input.headline.trim()
    if (headline.length > 160) throw new Error('Titulli duhet të jetë deri në 160 karaktere')
    existing.headline = headline || undefined
  }
  if (input.bio !== undefined) {
    const bio = input.bio.trim()
    if (bio.length > 3000) throw new Error('Përshkrimi duhet të jetë deri në 3000 karaktere')
    existing.bio = bio || undefined
  }
  if (input.skills !== undefined) existing.skills = cleanStringList(input.skills)
  if (input.languages !== undefined) existing.languages = cleanStringList(input.languages, 12, 40)
  if (input.legacyLocation !== undefined) existing.legacyLocation = cleanOptional(input.legacyLocation)

  await existing.save()

  const publicFields: Record<string, unknown> = {}
  if (input.headline !== undefined) publicFields['publicProfile.title'] = existing.headline || ''
  if (input.bio !== undefined) {
    publicFields['publicProfile.description'] = existing.bio || ''
    publicFields['publicProfile.shortDescription'] = (existing.bio || '').slice(0, 300)
  }
  if (input.languages !== undefined) publicFields.languages = existing.languages || []
  if (Object.keys(publicFields).length) {
    await ProviderProfile.updateMany({ ownerUser: existing._id }, { $set: publicFields })
  }

  return toPublicUser(existing)
}

export async function updateProfilePhoto(uid: string, profilePhoto: string): Promise<PublicUser> {
  const existing = await User.findOne({ uid })
  if (!existing) throw new Error('Përdoruesi nuk u gjet')
  const nextPhoto = normalizeUploadPath(profilePhoto)
  if (!nextPhoto) throw new Error('Rruga e fotos nuk është e vlefshme')
  const previous = existing.profilePhoto
  existing.profilePhoto = nextPhoto
  await existing.save()
  await ProviderProfile.updateMany(
    { ownerUser: existing._id },
    { $set: { 'publicProfile.photoUrl': nextPhoto } },
  )
  if (previous && previous !== nextPhoto) {
    await deleteUpload(previous)
  }
  return toPublicUser(existing)
}

export async function updateUserByUid(
  uid: string,
  input: { name?: string; email?: string; role?: UserRole; roles?: UserRole[]; accountStatus?: UserDoc['accountStatus'] },
): Promise<PublicUser> {
  const existing = await User.findOne({ uid })
  if (!existing) throw new Error('Përdoruesi nuk u gjet')

  if (input.role !== undefined && !isUserRole(input.role)) {
    throw new Error('Roli nuk është i vlefshëm')
  }
  if (input.roles && input.roles.some((role) => !isUserRole(role))) {
    throw new Error('Rolet nuk janë të vlefshme')
  }

  if (input.email?.trim()) {
    const email = input.email.trim().toLowerCase()
    const clash = await User.findOne({ email, uid: { $ne: uid } })
    if (clash) throw new Error('Ky email është i përdorur nga një llogari tjetër')
    existing.email = email
  }

  if (input.name?.trim()) {
    existing.name = input.name.trim()
    Object.assign(existing, splitName(existing.name))
  }

  if (input.role && !input.roles) {
    existing.role = input.role
    existing.roles = input.role === 'user' ? ['user'] : ['user', input.role]
    if (existing.requestedRole && (input.role === existing.requestedRole || input.role === 'user')) {
      existing.requestedRole = undefined
    }
  }
  if (input.roles) {
    existing.roles = [...new Set(['user' as UserRole, ...input.roles])]
    existing.role = existing.roles.find((role) => role !== 'user') ?? 'user'
  }
  if (input.accountStatus !== undefined) existing.accountStatus = input.accountStatus

  await existing.save()
  return toPublicUser(existing)
}

export async function deleteUserByUid(uid: string) {
  const result = await User.deleteOne({ uid })
  if (result.deletedCount === 0) throw new Error('Përdoruesi nuk u gjet')
  return { deleted: true, uid }
}

export async function countUsersByRole() {
  const rows = await User.aggregate<{ _id: UserRole; count: number }>([
    { $project: { countedRoles: { $ifNull: ['$roles', { $cond: [{ $eq: ['$role', 'admin'] }, ['user', 'admin'], ['user']] }] } } },
    { $unwind: '$countedRoles' },
    { $group: { _id: '$countedRoles', count: { $sum: 1 } } },
  ])

  const counts: Record<UserRole, number> = {
    user: 0,
    provider: 0,
    company: 0,
    admin: 0,
  }
  for (const row of rows) {
    if (isUserRole(row._id)) counts[row._id] = row.count
  }
  return counts
}
