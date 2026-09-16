import { User, type UserDoc } from '../models/User'
import { isUserRole, type UserRole } from '../types/roles'

function cleanList(values?: string[]) {
  if (!values) return []
  return [
    ...new Set(
      values
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 30),
    ),
  ]
}

export function toPublicUser(user: {
  uid: string
  email: string
  name: string
  role?: UserRole
  headline?: string
  bio?: string
  location?: string
  skills?: string[]
  languages?: string[]
  profilePhoto?: string
  createdAt?: Date
}): UserDoc {
  return {
    uid: user.uid,
    email: user.email,
    name: user.name,
    role: user.role ?? 'user',
    headline: user.headline || '',
    bio: user.bio || '',
    location: user.location || '',
    skills: user.skills ?? [],
    languages: user.languages ?? [],
    profilePhoto: user.profilePhoto || '',
    createdAt: user.createdAt ?? new Date(),
  }
}

export async function upsertUser(input: {
  uid: string
  email: string
  name: string
  /** Set only on first insert; existing users keep their role */
  role?: UserRole
  /** When true, overwrite name (register / explicit rename) */
  updateName?: boolean
}): Promise<UserDoc> {
  const email = input.email.toLowerCase()
  const name = input.name.trim() || input.email.split('@')[0] || 'User'

  const $set: Record<string, string> = { email }
  if (input.updateName) $set.name = name

  const user = await User.findOneAndUpdate(
    { uid: input.uid },
    {
      $set,
      $setOnInsert: {
        uid: input.uid,
        name,
        role: input.role ?? 'user',
        skills: [],
        languages: [],
        headline: '',
        bio: '',
        location: '',
        profilePhoto: '',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
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
    query.role = filters.role
  }
  if (filters?.q?.trim()) {
    const q = filters.q.trim()
    query.$or = [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { uid: { $regex: q, $options: 'i' } },
    ]
  }

  const users = await User.find(query).sort({ createdAt: -1 }).lean()
  return users.map((u) => toPublicUser(u))
}

export async function updateOwnProfile(
  uid: string,
  input: {
    name?: string
    headline?: string
    bio?: string
    location?: string
    skills?: string[]
    languages?: string[]
  },
): Promise<UserDoc> {
  const existing = await User.findOne({ uid })
  if (!existing) throw new Error('Përdoruesi nuk u gjet')

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) throw new Error('Emri është i detyrueshëm')
    if (name.length > 80) throw new Error('Emri është shumë i gjatë')
    existing.name = name
  }

  if (input.headline !== undefined) {
    existing.headline = input.headline.trim().slice(0, 120)
  }

  if (input.bio !== undefined) {
    existing.bio = input.bio.trim().slice(0, 1200)
  }

  if (input.location !== undefined) {
    existing.location = input.location.trim().slice(0, 120)
  }

  if (input.skills !== undefined) {
    existing.skills = cleanList(input.skills)
  }

  if (input.languages !== undefined) {
    existing.languages = cleanList(input.languages)
  }

  await existing.save()
  return toPublicUser(existing)
}

export async function updateProfilePhoto(uid: string, profilePhoto: string): Promise<UserDoc> {
  const existing = await User.findOne({ uid })
  if (!existing) throw new Error('Përdoruesi nuk u gjet')
  existing.profilePhoto = profilePhoto
  await existing.save()
  return toPublicUser(existing)
}

export async function updateUserByUid(
  uid: string,
  input: { name?: string; email?: string; role?: UserRole },
): Promise<UserDoc> {
  const existing = await User.findOne({ uid })
  if (!existing) throw new Error('Përdoruesi nuk u gjet')

  if (input.role !== undefined && !isUserRole(input.role)) {
    throw new Error('Roli nuk është i vlefshëm')
  }

  if (input.email?.trim()) {
    const email = input.email.trim().toLowerCase()
    const clash = await User.findOne({ email, uid: { $ne: uid } })
    if (clash) throw new Error('Ky email është i përdorur nga një llogari tjetër')
    existing.email = email
  }

  if (input.name?.trim()) {
    existing.name = input.name.trim()
  }

  if (input.role) {
    existing.role = input.role
  }

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
    { $group: { _id: '$role', count: { $sum: 1 } } },
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
