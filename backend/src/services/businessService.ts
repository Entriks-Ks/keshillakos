import { notify, notifyUsers, notifyAdmins } from './notificationService'
import { paginateItems, queryPage, type PaginationInput } from './pagination'
import { Types } from 'mongoose'
import { Business, type BusinessDoc } from '../models/Business'
import { City } from '../models/City'
import { Country } from '../models/Country'
import { User } from '../models/User'
import { ProviderProfile } from '../models/ProviderProfile'
import type { Location } from '../models/location'
import { applySocialLinks, normalizeSocialLinks, type SocialLinks } from '../models/socialLinks'
import { findDomainById } from './domainService'
import { deleteUploads, normalizeUploadPath } from './mediaService'
import { effectiveRoles } from './userService'

export async function userIdForUid(uid: string) {
  const user = await User.findOne({ uid }).select('_id').lean()
  if (!user) throw new Error('Llogaria nuk u gjet')
  return user._id
}

export function canManageBusiness(business: Pick<BusinessDoc, 'owners' | 'members'>, userId: Types.ObjectId) {
  return business.owners.some((owner) => owner.equals(userId)) ||
    business.members.some((member) => member.user.equals(userId) && member.role === 'manager')
}

export function toPublicBusiness(business: BusinessDoc & { _id: Types.ObjectId }) {
  return {
    id: String(business._id),
    _id: String(business._id),
    publicName: business.publicName,
    legalName: business.legalName,
    logoUrl: business.logoUrl,
    coverUrl: business.coverUrl,
    description: business.description,
    website: business.website,
    contactEmail: business.contactEmail,
    contactPhone: business.contactPhone,
    categoryIds: business.categoryIds ?? [],
    location: business.location
      ? { countryId: String(business.location.countryId), cityId: String(business.location.cityId) }
      : undefined,
    socialLinks: business.socialLinks || {},
    branches: business.branches ?? [],
    verification: business.verification,
    status: business.status,
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
  }
}

function normalizeWebsite(value: string | null | undefined) {
  if (value === undefined) return undefined
  if (value === null) return null
  const website = value.trim()
  if (!website) return null
  if (!/^https?:\/\/.+/i.test(website)) {
    throw new Error('Website duhet të fillojë me http:// ose https://')
  }
  let url: URL
  try {
    url = new URL(website)
  } catch {
    throw new Error('Website nuk është i vlefshëm')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Website duhet të fillojë me http:// ose https://')
  }
  return url.toString()
}

export async function createBusiness(input: {
  ownerUid: string
  publicName: string
  legalName?: string
  logoUrl?: string
  description?: string
  website?: string
  contactEmail?: string
  contactPhone?: string
  categoryIds?: string[]
  location?: { countryId: string; cityId: string }
  branches?: Array<{ name: string; location: Location }>
}) {
  const owner = await userIdForUid(input.ownerUid)
  const existing = await Business.findOne({ owners: owner, status: { $ne: 'closed' } }).select('_id publicName status').lean()
  if (existing) throw new Error('Ke tashmë një kompani. Mund të krijosh vetëm një.')

  const publicName = input.publicName.trim()
  if (!publicName) throw new Error('Emri i kompanisë është i detyrueshëm')

  const contactEmail = input.contactEmail?.trim().toLowerCase()
  if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new Error('Email i kontaktit është i detyrueshëm dhe duhet të jetë i vlefshëm')
  }

  const contactPhone = input.contactPhone?.trim()
  if (!contactPhone || !/^\+[1-9]\d{1,14}$/.test(contactPhone)) {
    throw new Error('Numri i telefonit duhet të jetë në formatin ndërkombëtar (+383…)')
  }

  const description = input.description?.trim()
  if (!description) throw new Error('Përshkrimi është i detyrueshëm')

  const categoryIds = [...new Set((input.categoryIds ?? []).map((id) => id.trim()).filter(Boolean))]
  if (!categoryIds.length || !(await Promise.all(categoryIds.map((id) => findDomainById(id)))).every(Boolean)) {
    throw new Error('Kategoria është e detyrueshme')
  }

  if (!input.location) throw new Error('Qyteti është i detyrueshëm')
  const { countryId, cityId } = input.location
  if (!Types.ObjectId.isValid(countryId) || !Types.ObjectId.isValid(cityId)) throw new Error('Lokacioni është i pavlefshëm')
  const [country, city] = await Promise.all([
    Country.exists({ _id: countryId, isActive: true }),
    City.exists({ _id: cityId, countryId, isActive: true }),
  ])
  if (!country || !city) throw new Error('Qyteti dhe shteti nuk përputhen ose nuk janë aktivë')

  const website = normalizeWebsite(input.website ?? null) || undefined

  return Business.create({
    publicName,
    legalName: input.legalName?.trim() || undefined,
    logoUrl: normalizeUploadPath(input.logoUrl) || undefined,
    description,
    website,
    contactEmail,
    contactPhone,
    categoryIds,
    location: { countryId: new Types.ObjectId(countryId), cityId: new Types.ObjectId(cityId) },
    owners: [owner],
    branches: input.branches ?? [],
    // Company exists immediately; verification stays separate from lifecycle status.
    status: 'active',
    verification: { status: 'unverified' },
  })
}

export async function findOwnedOpenBusiness(uid: string) {
  const userId = await userIdForUid(uid)
  return Business.findOne({ owners: userId, status: { $ne: 'closed' } }).sort({ createdAt: 1 })
}

export async function listMyBusinesses(uid: string) {
  const userId = await userIdForUid(uid)
  return Business.find({
    $or: [{ owners: userId }, { 'members.user': userId }],
    status: { $ne: 'closed' },
  }).sort({ createdAt: -1 })
}

export async function listManagedBusinesses(uid: string) {
  const userId = await userIdForUid(uid)
  return Business.find({ $or: [{ owners: userId }, { members: { $elemMatch: { user: userId, role: 'manager' } } }] }).sort({ createdAt: 1 })
}

export async function businessTeam(uid: string, businessId: string, input: PaginationInput = { page: 1, limit: 20 }, invitationsInput: PaginationInput = input) {
  const { business } = await ownedBusinessById(uid, businessId)
  const members = paginateItems(business.members, input)
  const invitations = paginateItems(business.invitations, invitationsInput)
  const ids = [...business.owners, ...members.items.map((member) => member.user), ...invitations.items.map((invite) => invite.user)]
  const users = await User.find({ _id: { $in: ids } }).select('uid name firstName lastName email headline profilePhoto roles role').lean()
  const profiles = await ProviderProfile.find({
    ownerUser: { $in: ids },
    providerType: 'individual',
  }).select('_id ownerUser publicProfile categories languages status').lean()
  const byId = new Map(users.map((user) => [String(user._id), user]))
  const profileByOwner = new Map(profiles.map((profile) => [String(profile.ownerUser), profile]))
  const person = (id: Types.ObjectId) => {
    const user = byId.get(String(id))
    const profile = profileByOwner.get(String(id))
    const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.name
    return {
      id: String(id),
      uid: user?.uid || '',
      name: userName || profile?.publicProfile?.displayName || 'Ekspert',
      email: user?.email || '',
      headline: profile?.publicProfile?.title || user?.headline || '',
      photoUrl: profile?.publicProfile?.photoUrl || user?.profilePhoto || '',
      categories: profile?.categories ?? [],
      languages: profile?.languages ?? [],
      profileStatus: profile?.status || null,
      providerProfileId: profile ? String(profile._id) : null,
    }
  }
  return {
    business: { id: String(business._id), publicName: business.publicName },
    owners: business.owners.map(person),
    members: members.items.map((member) => ({ ...person(member.user), role: member.role })),
    pagination: members.pagination,
    invitationsPagination: invitations.pagination,
    invitations: invitations.items.map((invite) => ({
      ...person(invite.user),
      invitedAt: invite.invitedAt,
      status: 'pending' as const,
    })),
  }
}

export async function publicExpertsForOwner(ownerUid: string) {
  const owner = await User.findOne({ uid: ownerUid }).select('_id').lean()
  if (!owner) return []
  const business = await Business.findOne({ owners: owner._id, status: 'active' }).select('members')
  if (!business?.members.length) return []
  const ids = business.members.map((member) => member.user)
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: ids }, accountStatus: 'active' }).select('uid name firstName lastName email headline profilePhoto').lean(),
    ProviderProfile.find({ ownerUser: { $in: ids }, providerType: 'individual' }).select('ownerUser publicProfile').lean(),
  ])
  const profileByOwner = new Map(profiles.map((profile) => [String(profile.ownerUser), profile]))
  return users
    .filter((user) => user.uid)
    .map((user) => {
      const profile = profileByOwner.get(String(user._id))
      const userName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.name
      return {
        uid: user.uid,
        name: userName || profile?.publicProfile?.displayName || 'Ekspert',
        headline: profile?.publicProfile?.title || user.headline || '',
        photoUrl: profile?.publicProfile?.photoUrl || user.profilePhoto || '',
      }
    })
}

export async function publicExpertPageForOwner(ownerUid: string, input: PaginationInput) {
  const owner = await User.findOne({ uid: ownerUid }).select('_id').lean()
  const business = owner ? await Business.findOne({ owners: owner._id, status: 'active' }).select('members').lean() : null
  const query: Record<string, unknown> = { _id: { $in: business?.members.map((member) => member.user) ?? [] }, accountStatus: 'active', uid: { $exists: true, $ne: '' } }
  const result = await queryPage(input, () => User.countDocuments(query), (skip, limit) => User.find(query).select('uid name firstName lastName headline profilePhoto').sort({ name: 1, _id: 1 }).skip(skip).limit(limit).lean())
  const profiles = await ProviderProfile.find({ ownerUser: { $in: result.items.map((user) => user._id) }, providerType: 'individual' }).select('ownerUser publicProfile').lean()
  const byOwner = new Map(profiles.map((profile) => [String(profile.ownerUser), profile]))
  return { experts: result.items.map((user) => {
    const profile = byOwner.get(String(user._id))
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.name
    return { uid: user.uid, name: name || profile?.publicProfile.displayName || 'Ekspert', headline: profile?.publicProfile.title || user.headline || '', photoUrl: profile?.publicProfile.photoUrl || user.profilePhoto || '' }
  }), pagination: result.pagination }
}

export async function lookupBusinessExpert(uid: string, businessId: string, email: string) {
  const { business } = await ownedBusinessById(uid, businessId)
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return { status: 'invalid' as const }

  const expert = await User.findOne({ email: normalized, accountStatus: 'active' })
    .select('uid name firstName lastName email headline profilePhoto roles role')
    .lean()
  if (!expert) return { status: 'missing' as const }
  if (!effectiveRoles(expert).includes('provider')) return { status: 'not_expert' as const }

  const profile = await ProviderProfile.findOne({ ownerUser: expert._id, providerType: 'individual' })
    .select('publicProfile')
    .lean()
  if (!profile) return { status: 'not_expert' as const }

  const userName = [expert.firstName, expert.lastName].filter(Boolean).join(' ').trim() || expert.name
  const person = {
    id: String(expert._id),
    uid: expert.uid || '',
    name: userName || profile.publicProfile?.displayName || 'Ekspert',
    email: expert.email || normalized,
    headline: profile.publicProfile?.title || expert.headline || '',
    photoUrl: profile.publicProfile?.photoUrl || expert.profilePhoto || '',
  }
  if (business.owners.some((owner) => owner.equals(expert._id))) return { status: 'owner' as const, person }
  if (business.members.some((member) => member.user.equals(expert._id))) return { status: 'member' as const, person }
  if (business.invitations.some((invite) => invite.user.equals(expert._id))) return { status: 'invited' as const, person }
  return { status: 'ready' as const, person }
}

export async function inviteBusinessExpert(uid: string, businessId: string, email: string) {
  const { business, userId } = await ownedBusinessById(uid, businessId)
  if (business.status === 'suspended' || business.status === 'closed') {
    throw new Error('Kompania e pezulluar ose e mbyllur nuk mund të ftojë ekspertë')
  }
  const expert = await User.findOne({ email: email.trim().toLowerCase(), accountStatus: 'active' })
  if (!expert || !effectiveRoles(expert).includes('provider')) throw new Error('Eksperti me këtë email nuk u gjet')
  const profile = await ProviderProfile.exists({ ownerUser: expert._id, providerType: 'individual' })
  if (!profile) throw new Error('Përdoruesi nuk ka profil eksperti')
  if (business.owners.some((owner) => owner.equals(expert._id)) || business.members.some((member) => member.user.equals(expert._id))) {
    throw new Error('Eksperti është tashmë pjesë e kompanisë')
  }
  if (business.invitations.some((invite) => invite.user.equals(expert._id))) {
    throw new Error('Ftesa ekziston tashmë')
  }
  // Persist membership changes before notifying the affected accounts.
  const updated = await Business.findOneAndUpdate(
    {
      _id: business._id,
      status: { $nin: ['suspended', 'closed'] },
      'invitations.user': { $ne: expert._id },
      'members.user': { $ne: expert._id },
    },
    { $push: { invitations: { user: expert._id, invitedBy: userId, invitedAt: new Date() } } },
    { new: true, runValidators: true },
  )
  if (!updated) throw new Error('Ftesa nuk u dërgua')
  await notify([expert.uid], { type: 'company:invitation', title: 'Ftesë nga kompania', body: business.publicName, href: '/dashboard/provider/profile', eventKey: `invite:${business._id}:${expert._id}:${updated.updatedAt.toISOString()}`, actorUid: uid })
  return businessTeam(uid, businessId)
}

export async function listMyBusinessInvitations(uid: string, input: PaginationInput = { page: 1, limit: 20 }) {
  const userId = await userIdForUid(uid)
  const query: Record<string, unknown> = { 'invitations.user': userId, status: { $nin: ['suspended', 'closed'] } }
  const result = await queryPage(input, () => Business.countDocuments(query), (skip, limit) => Business.find(query).select('publicName invitations').sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean())
  return Object.assign(result.items.map((business) => {
    const invite = business.invitations.find((item) => String(item.user) === String(userId))
    return {
      id: String(business._id),
      publicName: business.publicName,
      invitedAt: invite?.invitedAt ?? null,
      status: 'pending' as const,
    }
  }), { pagination: result.pagination })
}

export async function acceptBusinessInvitation(uid: string, businessId: string) {
  if (!Types.ObjectId.isValid(businessId)) throw new Error('Business ID i pavlefshëm')
  const userId = await userIdForUid(uid)
  const user = await User.findById(userId)
  if (!user || !effectiveRoles(user).includes('provider')) throw new Error('Vetëm ekspertët mund ta pranojnë ftesën')
  const business = await Business.findOneAndUpdate(
    { _id: businessId, 'invitations.user': userId, status: { $nin: ['suspended', 'closed'] } },
    { $pull: { invitations: { user: userId } }, $addToSet: { members: { user: userId, role: 'member' } } },
    { new: true, runValidators: true },
  )
  if (!business) throw new Error('Ftesa nuk u gjet')
  await notifyUsers(business.owners, { type: 'company:invitation-accepted', title: 'Ftesa u pranua', body: business.publicName, href: '/dashboard/company/experts', eventKey: `invite:${business._id}:${userId}:accepted:${business.updatedAt.toISOString()}`, actorUid: uid })
  return { id: String(business._id), publicName: business.publicName }
}

export async function rejectBusinessInvitation(uid: string, businessId: string) {
  if (!Types.ObjectId.isValid(businessId)) throw new Error('Business ID i pavlefshëm')
  const userId = await userIdForUid(uid)
  const user = await User.findById(userId)
  if (!user || !effectiveRoles(user).includes('provider')) throw new Error('Vetëm ekspertët mund ta refuzojnë ftesën')
  const business = await Business.findOneAndUpdate(
    { _id: businessId, 'invitations.user': userId, status: { $nin: ['suspended', 'closed'] } },
    { $pull: { invitations: { user: userId } } },
    { new: true, runValidators: true },
  )
  if (!business) throw new Error('Ftesa nuk u gjet')
  await notifyUsers(business.owners, { type: 'company:invitation-rejected', title: 'Ftesa u refuzua', body: business.publicName, href: '/dashboard/company/experts', eventKey: `invite:${business._id}:${userId}:rejected:${business.updatedAt.toISOString()}`, actorUid: uid })
  return { id: String(business._id), publicName: business.publicName }
}

export async function cancelBusinessInvitation(uid: string, businessId: string, inviteeUserId: string) {
  const { business } = await ownedBusinessById(uid, businessId)
  if (!Types.ObjectId.isValid(inviteeUserId)) throw new Error('User ID i pavlefshëm')
  const invite = business.invitations.find((item) => String(item.user) === inviteeUserId)
  if (!invite) throw new Error('Ftesa nuk u gjet')
  business.invitations = business.invitations.filter((item) => String(item.user) !== inviteeUserId)
  await business.save()
  await notifyUsers([inviteeUserId], { type: 'company:invitation-cancelled', title: 'Ftesa u anulua', body: business.publicName, href: '/dashboard', eventKey: `invite:${business._id}:${inviteeUserId}:cancelled:${business.updatedAt.toISOString()}`, actorUid: uid })
  return businessTeam(uid, businessId)
}

export async function removeBusinessExpert(uid: string, businessId: string, memberId: string) {
  const { business } = await ownedBusinessById(uid, businessId)
  if (!Types.ObjectId.isValid(memberId)) throw new Error('User ID i pavlefshëm')
  const member = business.members.find((item) => String(item.user) === memberId)
  if (!member) throw new Error('Anëtari nuk u gjet')
  business.members = business.members.filter((item) => String(item.user) !== memberId)
  await business.save()
  await notifyUsers([memberId], { type: 'company:member-removed', title: 'Anëtarësia në kompani përfundoi', body: business.publicName, href: '/dashboard', eventKey: `member:${business._id}:${memberId}:removed:${business.updatedAt.toISOString()}`, actorUid: uid })
  return businessTeam(uid, businessId)
}

export async function ownedBusinessById(uid: string, businessId: string) {
  if (!Types.ObjectId.isValid(businessId)) throw new Error('Business ID i pavlefshëm')
  const userId = await userIdForUid(uid)
  const business = await Business.findById(businessId)
  if (!business || !canManageBusiness(business, userId) || ['suspended', 'closed'].includes(business.status)) {
    throw new Error('Nuk ke leje për këtë biznes')
  }
  return { business, userId }
}

export async function updateBusiness(uid: string, businessId: string, changes: {
  publicName?: string
  legalName?: string | null
  logoUrl?: string | null
  coverUrl?: string | null
  description?: string | null
  website?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  categoryIds?: string[]
  location?: { countryId: string; cityId: string } | null
  socialLinks?: SocialLinks | null
  branches?: Array<{ name: string; location: Location }>
}) {
  const { business } = await ownedBusinessById(uid, businessId)
  const previousMedia = [business.logoUrl, business.coverUrl]
  if (changes.publicName !== undefined) business.publicName = changes.publicName.trim()
  if (changes.legalName !== undefined) business.legalName = changes.legalName?.trim() || undefined
  if (changes.logoUrl !== undefined) {
    if (changes.logoUrl === null || !changes.logoUrl.trim()) {
      business.logoUrl = undefined
    } else {
      const path = normalizeUploadPath(changes.logoUrl)
      if (!path) throw new Error('Logoja nuk është e vlefshme')
      business.logoUrl = path
    }
  }
  if (changes.coverUrl !== undefined) {
    if (changes.coverUrl === null || !changes.coverUrl.trim()) {
      business.coverUrl = undefined
    } else {
      const path = normalizeUploadPath(changes.coverUrl)
      if (!path) throw new Error('Fotoja e sfondit nuk është e vlefshme')
      business.coverUrl = path
    }
  }
  if (changes.description !== undefined) business.description = changes.description?.trim() || undefined
  if (changes.website !== undefined) {
    const website = normalizeWebsite(changes.website)
    business.website = website || undefined
  }
  if (changes.contactEmail !== undefined) business.contactEmail = changes.contactEmail?.trim().toLowerCase() || undefined
  if (changes.contactPhone !== undefined) {
    const phone = changes.contactPhone?.trim() || undefined
    if (phone && !/^\+[1-9]\d{1,14}$/.test(phone)) throw new Error('Numri i telefonit duhet të jetë në formatin ndërkombëtar (+383…)')
    business.contactPhone = phone
  }
  if (changes.categoryIds !== undefined) {
    const categoryIds = [...new Set(changes.categoryIds.map((id) => id.trim()).filter(Boolean))]
    if (categoryIds.length && !(await Promise.all(categoryIds.map((id) => findDomainById(id)))).every(Boolean)) {
      throw new Error('Kategoria nuk ekziston')
    }
    business.categoryIds = categoryIds
  }
  if (changes.location !== undefined) {
    if (changes.location === null) {
      business.location = undefined
    } else {
      const { countryId, cityId } = changes.location
      if (!Types.ObjectId.isValid(countryId) || !Types.ObjectId.isValid(cityId)) throw new Error('Lokacioni është i pavlefshëm')
      const [country, city] = await Promise.all([
        Country.exists({ _id: countryId, isActive: true }),
        City.exists({ _id: cityId, countryId, isActive: true }),
      ])
      if (!country || !city) throw new Error('Qyteti dhe shteti nuk përputhen ose nuk janë aktivë')
      business.location = { countryId: new Types.ObjectId(countryId), cityId: new Types.ObjectId(cityId) }
    }
  }
  if (changes.socialLinks !== undefined) {
    const normalized = normalizeSocialLinks(changes.socialLinks)
    business.socialLinks = applySocialLinks(business.socialLinks, normalized || {})
  }
  if (changes.branches !== undefined) business.branches = changes.branches
  // Verification is separate from lifecycle status; edits do not demote an active company.
  const newlyPending = business.verification.status === 'verified'
  if (newlyPending) business.verification.status = 'pending'
  await business.save()
  if (changes.logoUrl !== undefined || changes.coverUrl !== undefined) await deleteUploads(previousMedia)
  if (newlyPending) await notifyAdmins({ type: 'company:pending', title: 'Kompani për rishqyrtim', href: '/dashboard/admin', eventKey: `business:${business._id}:pending:${business.updatedAt.toISOString()}`, actorUid: uid })
  return business
}

export async function reviewBusiness(id: string, reviewerUid: string, status: 'active' | 'suspended', verification?: 'unverified' | 'verified' | 'rejected') {
  if (!Types.ObjectId.isValid(id)) throw new Error('Business ID i pavlefshëm')
  const reviewer = await userIdForUid(reviewerUid)
  const business = await Business.findById(id)
  if (!business) throw new Error('Biznesi nuk u gjet')
  const changed = business.status !== status || Boolean(verification && business.verification.status !== verification)
  // Admin can suspend/reactivate; verification badges are optional and independent.
  business.status = status
  if (verification) {
    business.verification = { status: verification, reviewedAt: new Date(), reviewedBy: reviewer }
  }
  await business.save()
  if (changed) await notifyUsers([...business.owners, ...business.members.map(m => m.user)], { type: 'company:review', title: 'Statusi i kompanisë ndryshoi', body: `${business.publicName}: ${status}${verification ? ', ' + verification : ''}`, href: '/dashboard', eventKey: `business:${business._id}:${business.updatedAt.toISOString()}`, actorUid: reviewerUid })
  return business
}
