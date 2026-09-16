import { Types } from 'mongoose'
import { Business, type BusinessDoc } from '../models/Business'
import { User } from '../models/User'
import { ProviderProfile } from '../models/ProviderProfile'
import type { Location } from '../models/location'
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

export async function createBusiness(input: {
  ownerUid: string
  publicName: string
  legalName?: string
  logoUrl?: string
  branches?: Array<{ name: string; location: Location }>
}) {
  const owner = await userIdForUid(input.ownerUid)
  return Business.create({
    publicName: input.publicName,
    legalName: input.legalName?.trim() || undefined,
    logoUrl: input.logoUrl?.trim() || undefined,
    owners: [owner],
    branches: input.branches ?? [],
    status: 'draft',
  })
}

export async function listMyBusinesses(uid: string) {
  const userId = await userIdForUid(uid)
  return Business.find({ $or: [{ owners: userId }, { 'members.user': userId }] }).sort({ createdAt: -1 })
}

export async function listManagedBusinesses(uid: string) {
  const userId = await userIdForUid(uid)
  return Business.find({ $or: [{ owners: userId }, { members: { $elemMatch: { user: userId, role: 'manager' } } }] }).sort({ createdAt: 1 })
}

export async function businessTeam(uid: string, businessId: string) {
  const { business } = await ownedBusinessById(uid, businessId)
  const ids = [...business.owners, ...business.members.map((member) => member.user), ...business.invitations.map((invite) => invite.user)]
  const users = await User.find({ _id: { $in: ids } }).select('name email roles role').lean()
  const byId = new Map(users.map((user) => [String(user._id), user]))
  const person = (id: Types.ObjectId) => {
    const user = byId.get(String(id))
    return { id: String(id), name: user?.name || 'Ekspert', email: user?.email || '' }
  }
  return {
    business: { id: String(business._id), publicName: business.publicName },
    owners: business.owners.map(person),
    members: business.members.map((member) => ({ ...person(member.user), role: member.role })),
    invitations: business.invitations.map((invite) => ({ ...person(invite.user), invitedAt: invite.invitedAt })),
  }
}

export async function inviteBusinessExpert(uid: string, businessId: string, email: string) {
  const { business, userId } = await ownedBusinessById(uid, businessId)
  const expert = await User.findOne({ email: email.trim().toLowerCase(), accountStatus: 'active' })
  if (!expert || !effectiveRoles(expert).includes('provider')) throw new Error('Eksperti me këtë email nuk u gjet')
  const profile = await ProviderProfile.exists({ ownerUser: expert._id, providerType: 'individual' })
  if (!profile) throw new Error('Përdoruesi nuk ka profil eksperti')
  if (business.owners.some((owner) => owner.equals(expert._id)) || business.members.some((member) => member.user.equals(expert._id))) {
    throw new Error('Eksperti është tashmë pjesë e kompanisë')
  }
  const updated = await Business.findOneAndUpdate(
    { _id: business._id, 'invitations.user': { $ne: expert._id }, 'members.user': { $ne: expert._id } },
    { $push: { invitations: { user: expert._id, invitedBy: userId, invitedAt: new Date() } } },
    { new: true, runValidators: true },
  )
  if (!updated) throw new Error('Ftesa ekziston tashmë')
  return businessTeam(uid, businessId)
}

export async function listMyBusinessInvitations(uid: string) {
  const userId = await userIdForUid(uid)
  const businesses = await Business.find({ 'invitations.user': userId, status: { $nin: ['suspended', 'closed'] } }).select('publicName invitations').lean()
  return businesses.map((business) => ({ id: String(business._id), publicName: business.publicName }))
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
  return { id: String(business._id), publicName: business.publicName }
}

export async function removeBusinessExpert(uid: string, businessId: string, memberId: string) {
  const { business } = await ownedBusinessById(uid, businessId)
  if (!Types.ObjectId.isValid(memberId)) throw new Error('User ID i pavlefshëm')
  const member = business.members.find((item) => String(item.user) === memberId)
  if (!member) throw new Error('Anëtari nuk u gjet')
  business.members = business.members.filter((item) => String(item.user) !== memberId)
  await business.save()
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
  publicName?: string; legalName?: string | null; logoUrl?: string | null
  branches?: Array<{ name: string; location: Location }>
}) {
  const { business } = await ownedBusinessById(uid, businessId)
  if (changes.publicName !== undefined) business.publicName = changes.publicName.trim()
  if (changes.legalName !== undefined) business.legalName = changes.legalName?.trim() || undefined
  if (changes.logoUrl !== undefined) business.logoUrl = changes.logoUrl?.trim() || undefined
  if (changes.branches !== undefined) business.branches = changes.branches
  // Verification is an admin decision; an edited business must be reviewed again.
  if (business.verification.status === 'verified') business.verification.status = 'pending'
  business.status = 'draft'
  await business.save()
  return business
}

export async function reviewBusiness(id: string, reviewerUid: string, status: 'active' | 'suspended', verification?: 'unverified' | 'verified' | 'rejected') {
  if (!Types.ObjectId.isValid(id)) throw new Error('Business ID i pavlefshëm')
  const reviewer = await userIdForUid(reviewerUid)
  const business = await Business.findById(id)
  if (!business) throw new Error('Biznesi nuk u gjet')
  business.status = status
  if (verification) {
    business.verification = { status: verification, reviewedAt: new Date(), reviewedBy: reviewer }
  }
  await business.save()
  return business
}
