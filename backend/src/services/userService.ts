import { User, type UserDoc } from '../models/User'
import { isUserRole, type UserRole } from '../types/roles'

export function effectiveRoles(user: Pick<UserDoc, 'role' | 'roles'>): UserRole[] {
  // Existing admin accounts were never available through public registration.
  // Legacy provider/company roles cannot be trusted: registration selected them.
  const granted = user.roles?.filter(isUserRole)
  if (granted) return [...new Set(['user' as UserRole, ...granted])]
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
  location?: string
  skills?: string[]
  languages?: string[]
  profilePhoto?: string
  createdAt?: Date
  updatedAt?: Date
}): UserDoc {
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
    location: user.location || '',
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
  /** Registration preference, not an authorization grant. */
  requestedRole?: UserRole
  /** Only trusted admin paths may supply granted roles. */
  grantedRoles?: UserRole[]
  /** When true, overwrite name (register / explicit rename) */
  updateName?: boolean
}): Promise<UserDoc> {
  const email = input.email.trim().toLowerCase()
  const name = input.name.trim() || input.email.split('@')[0] || 'User'

  const $set: Record<string, string> = { email }
  if (input.updateName) Object.assign($set, { name, ...splitName(name) })

  // MongoDB forbids the same path in both $set and $setOnInsert
  const $setOnInsert: Record<string, unknown> = {
    uid: input.uid,
    role: input.role ?? 'user',
    skills: [],
    languages: [],
    headline: '',
    bio: '',
    location: '',
    profilePhoto: '',
  }
  if (!input.updateName) $setOnInsert.name = name

  const user = await User.findOneAndUpdate(
    { uid: input.uid },
<<<<<<< Updated upstream
    { $set, $setOnInsert },
    { upsert: true, new: true, setDefaultsOnInsert: true },
=======
    {
      $set,
      $setOnInsert: {
        uid: input.uid,
        name,
        ...splitName(name),
        role: input.requestedRole ?? input.grantedRoles?.find((role) => role !== 'user') ?? 'user',
        roles: input.grantedRoles ?? ['user'],
        requestedRole: input.requestedRole,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
>>>>>>> Stashed changes
  )

  return toPublicUser(user)
}

export async function findUserByUid(uid: string): Promise<UserDoc | null> {
  const user = await User.findOne({ uid }).lean()
  if (!user) return null
  return toPublicUser(user)
}

export async function findUsersByUids(uids: string[]) {
  const unique = [...new Set(uids.filter(Boolean))]
  if (unique.length === 0) return new Map<string, UserDoc>()

  const users = await User.find({ uid: { $in: unique } }).lean()
  const map = new Map<string, UserDoc>()
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

export async function updateOwnProfile(
  uid: string,
  input: {
    name?: string
    firstName?: string
    lastName?: string
    phone?: string | null
    locale?: string
    country?: string
    city?: string
    profileVisibility?: 'public' | 'private'
    marketingConsent?: boolean
  },
): Promise<UserDoc> {
  const existing = await User.findOne({ uid })
  if (!existing) throw new Error('Përdoruesi nuk u gjet')

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) throw new Error('Emri është i detyrueshëm')
    if (name.length > 80) throw new Error('Emri është shumë i gjatë')
    existing.name = name
    Object.assign(existing, splitName(name))
  }
  if (input.firstName !== undefined) existing.firstName = cleanOptional(input.firstName)
  if (input.lastName !== undefined) existing.lastName = cleanOptional(input.lastName)
  if (input.firstName !== undefined || input.lastName !== undefined) {
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

  await existing.save()
  return toPublicUser(existing)
}

export async function updateProfilePhoto(uid: string, profilePhoto: string): Promise<UserDoc> {
  const existing = await User.findOne({ uid })
  if (!existing) throw new Error('Përdoruesi nuk u gjet')
  // Account avatar remains supported; professional media belongs to ProviderProfile.
  existing.profilePhoto = profilePhoto
  await existing.save()
  return toPublicUser(existing)
}

export async function updateUserByUid(
  uid: string,
  input: { name?: string; email?: string; role?: UserRole; roles?: UserRole[]; accountStatus?: UserDoc['accountStatus'] },
): Promise<UserDoc> {
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
