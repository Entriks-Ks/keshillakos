import { randomUUID } from 'node:crypto'
import { Types } from 'mongoose'
import { AvailabilityLock } from '../models/AvailabilityLock'
import { AvailabilitySlot, type AvailabilitySlotDoc, type SlotStatus } from '../models/AvailabilitySlot'
import { Business } from '../models/Business'
import { ProviderProfile } from '../models/ProviderProfile'
import { ServiceOffer } from '../models/ServiceOffer'
import { User } from '../models/User'
import type { Location } from '../models/location'
import { listMyProviderProfiles } from './providerProfileService'

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart
}

function remaining(doc: AvailabilitySlotDoc) {
  if (!doc.holds?.length && doc.status === 'held' && doc.requestId) return 0
  if (!doc.holds?.length && doc.status === 'booked') return 0
  return Math.max(0, (doc.capacity || 1) - (doc.holds?.length || 0))
}

function toSlot(doc: AvailabilitySlotDoc & { _id: { toString(): string } }) {
  const available = remaining(doc)
  const status = doc.status === 'cancelled' ? 'cancelled' : available > 0 ? 'open'
    : doc.holds?.some((hold) => hold.state === 'booked') || (!doc.holds?.length && doc.status === 'booked') ? 'booked' : 'held'
  return {
    id: doc._id.toString(), providerId: doc.providerProfile ? String(doc.providerProfile) : undefined,
    providerUid: doc.providerUid, providerName: doc.providerName,
    businessId: doc.business ? String(doc.business) : undefined,
    serviceOfferId: doc.serviceOffer ? String(doc.serviceOffer) : undefined,
    staffUserId: doc.staffUser ? String(doc.staffUser) : undefined,
    resourceKey: doc.resourceKey,
    startAt: doc.startAt.toISOString(), endAt: doc.endAt.toISOString(),
    timezone: doc.timezone || 'Europe/Belgrade', mode: doc.mode || 'online', location: doc.location,
    capacity: doc.capacity || 1, remainingCapacity: available,
    status, note: doc.note, createdAt: doc.createdAt, updatedAt: doc.updatedAt,
  }
}

function assertValidRange(startAt: Date, endAt: Date) {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) throw new Error('Data ose ora nuk është e vlefshme')
  if (endAt <= startAt) throw new Error('Ora e mbarimit duhet të jetë pas fillimit')
  if (endAt.getTime() - startAt.getTime() < 15 * 60 * 1000) throw new Error('Termini duhet të jetë të paktën 15 minuta')
  if (startAt.getTime() < Date.now() - 60_000) throw new Error('Nuk mund të shtosh orare në të kaluarën')
}

async function withScheduleLock<T>(key: string, work: () => Promise<T>) {
  const token = randomUUID()
  const now = new Date()
  try {
    await AvailabilityLock.findOneAndUpdate(
      { _id: key, leaseUntil: { $lte: now } },
      { $set: { token, leaseUntil: new Date(now.getTime() + 30_000) } },
      { upsert: true, new: true },
    )
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new Error('Orari po përditësohet; provo përsëri')
    throw err
  }
  try { return await work() }
  finally { await AvailabilityLock.deleteOne({ _id: key, token }) }
}

async function withScheduleLocks<T>(keys: string[], work: () => Promise<T>): Promise<T> {
  const ordered = [...new Set(keys)].sort()
  const acquire = (index: number): Promise<T> => index === ordered.length
    ? work() : withScheduleLock(ordered[index], () => acquire(index + 1))
  return acquire(0)
}

async function managedProfile(uid: string, providerId?: string) {
  const profiles = await listMyProviderProfiles(uid)
  if (providerId) {
    const profile = profiles.find((item) => String(item._id) === providerId)
    if (!profile) throw new Error('Nuk ke leje për këtë profil')
    return profile
  }
  if (profiles.length === 1) return profiles[0]
  if (profiles.length > 1) throw new Error('Zgjidh ProviderProfile për orarin')
  return null // Legacy-only provider account.
}

export async function createAvailabilitySlot(input: {
  providerUid: string; providerName: string; providerId?: string
  businessId?: string; serviceOfferId?: string; staffUserId?: string; resourceKey?: string
  startAt: string | Date; endAt: string | Date; timezone?: string
  mode?: 'online' | 'on_site'; location?: Location; capacity?: number; note?: string
}) {
  const startAt = new Date(input.startAt)
  const endAt = new Date(input.endAt)
  assertValidRange(startAt, endAt)
  const profile = await managedProfile(input.providerUid, input.providerId)
  if (input.businessId && (!profile?.business || String(profile.business) !== input.businessId)) throw new Error('Biznesi nuk i përket profilit')
  if (input.serviceOfferId) {
    if (!Types.ObjectId.isValid(input.serviceOfferId) || !profile) throw new Error('ServiceOffer ID i pavlefshëm')
    const offer = await ServiceOffer.findOne({ _id: input.serviceOfferId, providerProfile: profile._id })
    if (!offer) throw new Error('Shërbimi nuk i përket profilit')
  }
  if (input.staffUserId) {
    if (!Types.ObjectId.isValid(input.staffUserId) || !profile?.business) throw new Error('Staff kërkon profil biznesi')
    const business = await Business.findById(profile.business)
    const staffId = new Types.ObjectId(input.staffUserId)
    if (!business || !business.owners.some((id) => id.equals(staffId)) && !business.members.some((member) => member.user.equals(staffId))) throw new Error('Stafi nuk i përket biznesit')
  }
  const key = profile ? `profile:${profile._id}` : `legacy:${input.providerUid}`
  const locks = [key]
  if (profile?.business && input.staffUserId) locks.push(`staff:${profile.business}:${input.staffUserId}`)
  if (profile?.business && input.resourceKey) locks.push(`resource:${profile.business}:${input.resourceKey}`)
  return withScheduleLocks(locks, async () => {
    const conflictScope: Array<Record<string, unknown>> = profile
      ? [{ providerProfile: profile._id }, { providerUid: input.providerUid, providerProfile: { $exists: false } }]
      : [{ providerUid: input.providerUid }]
    if (profile?.business && input.staffUserId) conflictScope.push({ business: profile.business, staffUser: new Types.ObjectId(input.staffUserId) })
    if (profile?.business && input.resourceKey) conflictScope.push({ business: profile.business, resourceKey: input.resourceKey })
    const overlap = await AvailabilitySlot.findOne({
      $or: conflictScope, status: { $ne: 'cancelled' },
      startAt: { $lt: endAt }, endAt: { $gt: startAt },
    })
    if (overlap) throw new Error('Ky orar përputhet me një termin ekzistues')
    const doc = await AvailabilitySlot.create({
      providerUid: input.providerUid, providerName: input.providerName,
      providerProfile: profile?._id, business: profile?.business,
      serviceOffer: input.serviceOfferId ? new Types.ObjectId(input.serviceOfferId) : undefined,
      staffUser: input.staffUserId ? new Types.ObjectId(input.staffUserId) : undefined,
      resourceKey: input.resourceKey,
      startAt, endAt, timezone: input.timezone || 'Europe/Belgrade',
      mode: input.mode || 'online', location: input.location,
      capacity: input.capacity ?? 1, note: input.note?.trim() || undefined, status: 'open',
    })
    return toSlot(doc)
  })
}

async function providerSlotFilter(identifier: string) {
  if (Types.ObjectId.isValid(identifier)) return { providerProfile: new Types.ObjectId(identifier) }
  const user = await User.findOne({ uid: identifier }).select('_id').lean()
  const profiles = user ? await ProviderProfile.find({ ownerUser: user._id }).select('_id').lean() : []
  return { $or: [{ providerUid: identifier }, { providerProfile: { $in: profiles.map((profile) => profile._id) } }] }
}

export async function listMyAvailability(uid: string) {
  const profiles = await listMyProviderProfiles(uid)
  const docs = await AvailabilitySlot.find({
    $or: [{ providerUid: uid }, { providerProfile: { $in: profiles.map((profile) => profile._id) } }],
    status: { $ne: 'cancelled' }, endAt: { $gte: new Date(Date.now() - 86_400_000) },
  }).sort({ startAt: 1 })
  return docs.map(toSlot)
}

export async function listOpenAvailabilityForProvider(identifier: string) {
  const docs = await AvailabilitySlot.find({
    ...(await providerSlotFilter(identifier)), status: { $in: ['open', 'held', 'booked'] }, startAt: { $gte: new Date() },
  }).sort({ startAt: 1 }).limit(100)
  return docs.map(toSlot).filter((slot) => slot.remainingCapacity > 0).slice(0, 40)
}

export async function listScheduleForProvider(identifier: string) {
  const docs = await AvailabilitySlot.find({
    ...(await providerSlotFilter(identifier)), status: { $in: ['open', 'held', 'booked'] }, startAt: { $gte: new Date() },
  }).sort({ startAt: 1 }).limit(60)
  const slots = docs.map(toSlot)
  return { slots, free: slots.filter((slot) => slot.remainingCapacity > 0), busy: slots.filter((slot) => slot.remainingCapacity === 0) }
}

export async function deleteAvailabilitySlot(input: { id: string; providerUid: string; asAdmin?: boolean }) {
  if (!Types.ObjectId.isValid(input.id)) throw new Error('Termini nuk u gjet')
  const profiles = input.asAdmin ? [] : await listMyProviderProfiles(input.providerUid)
  const ownership = input.asAdmin ? {} : { $or: [{ providerUid: input.providerUid }, { providerProfile: { $in: profiles.map((profile) => profile._id) } }] }
  const doc = await AvailabilitySlot.findOneAndUpdate({
    _id: input.id, ...ownership, status: 'open',
    $expr: { $eq: [{ $size: { $ifNull: ['$holds', []] } }, 0] },
  }, { $set: { status: 'cancelled' } }, { new: true })
  if (!doc) throw new Error('Termini është i zënë ose nuk ke leje për ta fshirë')
  return { deleted: true, id: String(doc._id) }
}

export async function holdSlotForRequest(input: { slotId: string; providerUid: string; requestId: string; providerId?: string }) {
  if (!Types.ObjectId.isValid(input.slotId)) throw new Error('Termini nuk u gjet')
  const scope = input.providerId ? { providerProfile: new Types.ObjectId(input.providerId) } : { providerUid: input.providerUid }
  const doc = await AvailabilitySlot.findOneAndUpdate({
    _id: input.slotId, ...scope,
    $or: [{ status: 'open' }, { status: { $in: ['held', 'booked'] }, 'holds.0': { $exists: true } }],
    requestId: { $exists: false }, startAt: { $gte: new Date() },
    'holds.requestId': { $ne: input.requestId },
    $expr: { $lt: [{ $size: { $ifNull: ['$holds', []] } }, { $ifNull: ['$capacity', 1] }] },
  }, {
    $push: { holds: { requestId: input.requestId, state: 'held', heldAt: new Date() } },
    $set: { status: 'held' },
  }, { new: true })
  if (!doc) throw new Error('Ky termin sapo u zë ose nuk i përket këtij ofruesi')
  return toSlot(doc)
}

export async function syncSlotWithRequestStatus(input: { requestId: string; status: 'accepted' | 'rejected' | 'completed' | 'pending' }) {
  if (input.status === 'accepted' || input.status === 'completed') {
    const doc = await AvailabilitySlot.findOneAndUpdate(
      { holds: { $elemMatch: { requestId: input.requestId, state: 'held' } } },
      { $set: { 'holds.$.state': 'booked', status: 'booked' } }, { new: true },
    )
    if (doc) return toSlot(doc)
  } else if (input.status === 'rejected') {
    const doc = await AvailabilitySlot.findOneAndUpdate(
      { 'holds.requestId': input.requestId },
      { $pull: { holds: { requestId: input.requestId } } }, { new: true },
    )
    if (doc) {
      if (!doc.holds.length) {
        const reopened = await AvailabilitySlot.findOneAndUpdate({ _id: doc._id, holds: { $size: 0 } }, { $set: { status: 'open' } }, { new: true })
        return toSlot(reopened || doc)
      }
      return toSlot(doc)
    }
  } else {
    const doc = await AvailabilitySlot.findOne({ 'holds.requestId': input.requestId })
    if (doc) return toSlot(doc)
  }
  const legacyStatus = input.status === 'accepted' || input.status === 'completed' ? 'booked' : input.status === 'rejected' ? 'open' : 'held'
  const legacy = await AvailabilitySlot.findOneAndUpdate(
    { requestId: input.requestId },
    { $set: { status: legacyStatus }, ...(input.status === 'rejected' ? { $unset: { requestId: '' } } : {}) },
    { new: true },
  )
  return legacy ? toSlot(legacy) : null
}

export async function getSlotById(slotId: string) {
  if (!Types.ObjectId.isValid(slotId)) return null
  const doc = await AvailabilitySlot.findById(slotId)
  return doc ? toSlot(doc) : null
}

export type PublicSlot = ReturnType<typeof toSlot>
export type { SlotStatus }
