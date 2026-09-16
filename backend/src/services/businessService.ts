import { Types } from 'mongoose'
import { Business, type BusinessDoc } from '../models/Business'
import { User } from '../models/User'
import type { Location } from '../models/location'

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
