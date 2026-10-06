import { emitChatMessage, isConversationActive } from './realtime'
import { publishChatUnread } from './chatUnreadService'
import { queryPage, type PaginationInput } from './pagination'
import mongoose from 'mongoose'
import { Conversation } from '../models/Conversation'
import { Message } from '../models/Message'
import { ProviderProfile } from '../models/ProviderProfile'
import { RequestDelivery } from '../models/RequestDelivery'
import { ServiceRequest } from '../models/ServiceRequest'
import { User } from '../models/User'
import { UserRequest } from '../models/UserRequest'
import { publicProfileRole } from './providerPublicService'
import { assertChatUnblocked } from './chatSafetyService'
import { ServiceOffer } from '../models/ServiceOffer'
import { Service } from '../models/Service'
import { findUserByUid, findUsersByUids } from './userService'

const MAX_BODY = 4000

export type PublicMessage = {
  id: string
  conversationId: string
  senderUid: string
  body: string
  createdAt: string
}

export type PublicConversation = {
  id: string
  seekerUid: string
  providerUid: string
  serviceId?: string
  serviceTitle?: string
  lastMessageAt?: string
  lastMessagePreview?: string
  unread: number
  peer: {
    uid: string
    name: string
    profilePhoto?: string
    roleLabel?: string
  }
  createdAt: string
}

function toMessage(doc: {
  _id: { toString(): string }
  conversation: { toString(): string }
  senderUid: string
  body: string
  createdAt: Date
}): PublicMessage {
  return {
    id: doc._id.toString(),
    conversationId: doc.conversation.toString(),
    senderUid: doc.senderUid,
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
  }
}

export async function assertParticipant(conversationId: string, uid: string) {
  if (typeof conversationId !== 'string' || !mongoose.isValidObjectId(conversationId)) {
    throw Object.assign(new Error('Biseda nuk u gjet'), { status: 404 })
  }
  const conversation = await Conversation.findById(conversationId)
  if (!conversation) {
    throw Object.assign(new Error('Biseda nuk u gjet'), { status: 404 })
  }
  if (conversation.seekerUid !== uid && conversation.providerUid !== uid) {
    throw Object.assign(new Error('Nuk ke leje për këtë bisedë'), { status: 403 })
  }
  return conversation
}

export async function assertProviderCanMessageSeeker(providerUid: string, seekerUid: string) {
  const [provider, seeker] = await Promise.all([
    User.findOne({ uid: providerUid }).select('_id').lean(),
    User.findOne({ uid: seekerUid }).select('_id').lean(),
  ])
  if (!provider || !seeker) {
    throw Object.assign(new Error('Përdoruesi nuk u gjet'), { status: 404 })
  }
  const [profiles, requests] = await Promise.all([
    ProviderProfile.find({ ownerUser: provider._id }).select('_id').lean(),
    UserRequest.find({ user: seeker._id }).select('_id').lean(),
  ])
  if (profiles.length && requests.length) {
    const hit = await RequestDelivery.exists({
      providerProfile: { $in: profiles.map((profile) => profile._id) },
      request: { $in: requests.map((request) => request._id) },
    })
    if (hit) return
  }
  const legacy = await ServiceRequest.exists({ providerUid, seekerUid })
  if (!legacy) {
    throw Object.assign(new Error('Mund t’i dërgosh mesazh vetëm klientit që ka bërë kërkesë'), { status: 403 })
  }
}

export async function openOrGetConversation(input: {
  seekerUid: string
  providerUid: string
  serviceId?: string
  serviceTitle?: string
  initialMessage?: string
  senderUid?: string
  /** Set only by the request workflow, never accepted from the chat HTTP body. */
  requestDeliveryId?: string
}) {
  if (typeof input.providerUid !== 'string' || !input.providerUid.trim() || typeof input.seekerUid !== 'string' || !input.seekerUid.trim()) {
    throw Object.assign(new Error('Ofruesi është i detyrueshëm'), { status: 400 })
  }

  const senderUid = input.senderUid || input.seekerUid
  if (senderUid !== input.seekerUid && senderUid !== input.providerUid) {
    throw Object.assign(new Error('Nuk ke leje për të hapur këtë bisedë'), { status: 403 })
  }
  if (senderUid === input.providerUid) await assertProviderCanMessageSeeker(input.providerUid, input.seekerUid)
  await assertChatUnblocked(input.seekerUid, input.providerUid)
  if (input.seekerUid === input.providerUid) {
    throw Object.assign(new Error('Nuk mund të chatosh me veten'), { status: 400 })
  }
  if (input.initialMessage !== undefined && (typeof input.initialMessage !== 'string' || input.initialMessage.trim().length > MAX_BODY)) throw Object.assign(new Error('Mesazhi është i pavlefshëm'), { status: 400 })

  const provider = await findUserByUid(input.providerUid)
  if (!provider) {
    throw Object.assign(new Error('Ofruesi nuk u gjet'), { status: 404 })
  }
  if (!publicProfileRole(provider)) {
    throw Object.assign(new Error('Ky përdorues nuk ofron shërbime'), { status: 400 })
  }
  const seeker = await findUserByUid(input.seekerUid)
  if (!seeker || (provider.accountStatus && provider.accountStatus !== 'active') || (seeker.accountStatus && seeker.accountStatus !== 'active')) {
    throw Object.assign(new Error('Llogaria nuk është aktive'), { status: 403 })
  }
  if (input.serviceId !== undefined && typeof input.serviceId !== 'string') throw Object.assign(new Error('Shërbimi është i pavlefshëm'), { status: 400 })
  if (input.serviceTitle !== undefined && typeof input.serviceTitle !== 'string') throw Object.assign(new Error('Shërbimi është i pavlefshëm'), { status: 400 })
  let serviceTitle = input.serviceTitle?.trim().slice(0, 160)
  if (input.serviceId?.trim()) {
    if (!mongoose.isValidObjectId(input.serviceId.trim())) throw Object.assign(new Error('Shërbimi është i pavlefshëm'), { status: 400 })
    const providerAccount = await User.findOne({ uid: input.providerUid }).select('_id').lean()
    const profiles = await ProviderProfile.find({ ownerUser: providerAccount?._id }).select('_id').lean()
    const [offer, legacy] = await Promise.all([
      ServiceOffer.findOne({ _id: input.serviceId.trim(), providerProfile: { $in: profiles.map(p => p._id) } }).select('name').lean(),
      Service.findOne({ _id: input.serviceId.trim(), providerUid: input.providerUid }).select('title').lean(),
    ])
    if (!offer && !legacy) throw Object.assign(new Error('Shërbimi nuk i përket këtij ofruesi'), { status: 403 })
    serviceTitle = offer?.name || legacy?.title
  }

  let conversation = await Conversation.findOne({
    seekerUid: input.seekerUid,
    providerUid: input.providerUid,
  })

  if (!conversation) {
    try { conversation = await Conversation.create({
      seekerUid: input.seekerUid,
      providerUid: input.providerUid,
      serviceId: input.serviceId?.trim() || '',
      serviceTitle: serviceTitle || '',
      requestDeliveryId: input.requestDeliveryId,
      seekerUnread: 0,
      providerUnread: 0,
    }) } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error
      conversation = await Conversation.findOne({ seekerUid: input.seekerUid, providerUid: input.providerUid })
      if (!conversation) throw error
    }
  } else if (input.serviceId || serviceTitle || input.requestDeliveryId) {
    if (input.serviceId?.trim()) conversation.serviceId = input.serviceId.trim()
    if (serviceTitle) conversation.serviceTitle = serviceTitle
    if (input.requestDeliveryId) conversation.requestDeliveryId = new mongoose.Types.ObjectId(input.requestDeliveryId)
    await conversation.save()
  }

  let message: PublicMessage | null = null
  if (input.initialMessage?.trim()) {
    message = await sendMessage({
      conversationId: conversation._id.toString(),
      senderUid: input.senderUid || input.seekerUid,
      body: input.initialMessage.trim(),
    })
    conversation = (await Conversation.findById(conversation._id))!
  }

  const publicConv = await toPublicConversation(conversation, input.senderUid || input.seekerUid)
  return { conversation: publicConv, message }
}

export async function listConversationsForUser(uid: string, input: PaginationInput = { page: 1, limit: 20 }, search = '') {
  const query: Record<string, unknown> = { $or: [{ seekerUid: uid }, { providerUid: uid }] }
  if (search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const peers = await User.find({ name: { $regex: escaped, $options: 'i' } }).select('uid').lean()
    query.$and = [{ $or: [{ seekerUid: { $in: peers.map((peer) => peer.uid) } }, { providerUid: { $in: peers.map((peer) => peer.uid) } }, { serviceTitle: { $regex: escaped, $options: 'i' } }, { lastMessagePreview: { $regex: escaped, $options: 'i' } }] }]
  }
  const result = await queryPage(input, () => Conversation.countDocuments(query), (skip, limit) => Conversation.find(query).sort({ lastMessageAt: -1, updatedAt: -1, _id: -1 }).skip(skip).limit(limit))
  const totals = await Conversation.aggregate<{ total: number; unread: number }>([
    { $match: { $or: [{ seekerUid: uid }, { providerUid: uid }] } },
    { $group: { _id: null, total: { $sum: 1 }, unread: { $sum: { $cond: [{ $eq: ['$seekerUid', uid] }, '$seekerUnread', '$providerUnread'] } } } },
  ])
  return Object.assign(await Promise.all(result.items.map((doc) => toPublicConversation(doc, uid))), { pagination: result.pagination, summary: { total: totals[0]?.total ?? 0, unread: totals[0]?.unread ?? 0 } })
}

export async function getConversationForUser(conversationId: string, uid: string) {
  const conversation = await assertParticipant(conversationId, uid)
  return toPublicConversation(conversation, uid)
}

export async function listMessages(input: {
  conversationId: string
  uid: string
  limit?: number
  page?: number
  before?: string
}) {
  await assertParticipant(input.conversationId, input.uid)

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100)
  const query: Record<string, unknown> = {
    conversation: input.conversationId,
  }
  if (input.before) {
    const beforeDate = new Date(input.before)
    if (!Number.isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate }
    }
  }

  const result = await queryPage({ page: input.page ?? 1, limit }, () => Message.countDocuments(query), (skip, pageLimit) => Message.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(pageLimit))
  return Object.assign(result.items.reverse().map(toMessage), { pagination: result.pagination })
}

export async function sendMessage(input: {
  conversationId: string
  senderUid: string
  body: string
}) {
  const body = typeof input.body === 'string' ? input.body.trim() : ''
  if (!body) {
    throw Object.assign(new Error('Mesazhi nuk mund të jetë bosh'), { status: 400 })
  }
  if (body.length > MAX_BODY) {
    throw Object.assign(new Error('Mesazhi është shumë i gjatë'), { status: 400 })
  }

  const conversation = await assertParticipant(input.conversationId, input.senderUid)
  const peerUid = input.senderUid === conversation.seekerUid ? conversation.providerUid : conversation.seekerUid
  await assertChatUnblocked(input.senderUid, peerUid)
  const message = await Message.create({
    conversation: conversation._id,
    senderUid: input.senderUid,
    body,
  })

  const unreadField = peerUid === conversation.seekerUid ? 'seekerUnread' : 'providerUnread'
  const active = isConversationActive(peerUid, input.conversationId)
  await Conversation.findByIdAndUpdate(conversation._id, {
    $set: { lastMessageAt: message.createdAt, lastMessagePreview: body.slice(0, 140), ...(active ? { [unreadField]: 0 } : {}) },
    ...(!active ? { $inc: { [unreadField]: 1 } } : {}),
  })
  emitChatMessage(toMessage(message), peerUid)
  await publishChatUnread(peerUid)

  return toMessage(message)
}

export async function markConversationRead(conversationId: string, uid: string) {
  const conversation = await assertParticipant(conversationId, uid)
  const unreadField = uid === conversation.seekerUid ? 'seekerUnread' : 'providerUnread'
  await Conversation.updateOne({ _id: conversation._id }, { $set: { [unreadField]: 0 } })
  conversation.set(unreadField, 0)
  await publishChatUnread(uid)

  return toPublicConversation(conversation, uid)
}

async function toPublicConversation(
  doc: {
    _id: { toString(): string }
    seekerUid: string
    providerUid: string
    serviceId?: string
    serviceTitle?: string
    lastMessageAt?: Date
    lastMessagePreview?: string
    seekerUnread: number
    providerUnread: number
    createdAt: Date
  },
  viewerUid: string,
): Promise<PublicConversation> {
  const peerUid = viewerUid === doc.seekerUid ? doc.providerUid : doc.seekerUid
  const users = await findUsersByUids([peerUid])
  const peer = users.get(peerUid)

  return {
    id: doc._id.toString(),
    seekerUid: doc.seekerUid,
    providerUid: doc.providerUid,
    serviceId: doc.serviceId || undefined,
    serviceTitle: doc.serviceTitle || undefined,
    lastMessageAt: doc.lastMessageAt?.toISOString(),
    lastMessagePreview: doc.lastMessagePreview || undefined,
    unread: viewerUid === doc.seekerUid ? doc.seekerUnread : doc.providerUnread,
    peer: {
      uid: peerUid,
      name: peer?.name || 'Përdorues',
      profilePhoto: peer?.profilePhoto || '',
      roleLabel:
        peer?.role === 'provider'
          ? 'Ofrues'
          : peer?.role === 'company'
            ? 'Kompani'
            : peer?.role === 'admin'
              ? 'Admin'
              : 'Përdorues',
    },
    createdAt: doc.createdAt.toISOString(),
  }
}
