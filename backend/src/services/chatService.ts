import mongoose from 'mongoose'
import { Conversation } from '../models/Conversation'
import { Message } from '../models/Message'
import { ProviderProfile } from '../models/ProviderProfile'
import { RequestDelivery } from '../models/RequestDelivery'
import { ServiceRequest } from '../models/ServiceRequest'
import { User } from '../models/User'
import { UserRequest } from '../models/UserRequest'
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

async function assertParticipant(conversationId: string, uid: string) {
  if (!mongoose.isValidObjectId(conversationId)) {
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
}) {
  if (!input.providerUid?.trim()) {
    throw Object.assign(new Error('Ofruesi është i detyrueshëm'), { status: 400 })
  }
  if (input.seekerUid === input.providerUid) {
    throw Object.assign(new Error('Nuk mund të chatosh me veten'), { status: 400 })
  }

  const provider = await findUserByUid(input.providerUid)
  if (!provider) {
    throw Object.assign(new Error('Ofruesi nuk u gjet'), { status: 404 })
  }
  if (!['provider', 'company', 'admin'].includes(provider.role)) {
    throw Object.assign(new Error('Ky përdorues nuk ofron shërbime'), { status: 400 })
  }

  let conversation = await Conversation.findOne({
    seekerUid: input.seekerUid,
    providerUid: input.providerUid,
  })

  if (!conversation) {
    conversation = await Conversation.create({
      seekerUid: input.seekerUid,
      providerUid: input.providerUid,
      serviceId: input.serviceId?.trim() || '',
      serviceTitle: input.serviceTitle?.trim() || '',
      seekerUnread: 0,
      providerUnread: 0,
    })
  } else if (input.serviceId || input.serviceTitle) {
    if (input.serviceId?.trim()) conversation.serviceId = input.serviceId.trim()
    if (input.serviceTitle?.trim()) conversation.serviceTitle = input.serviceTitle.trim()
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

export async function listConversationsForUser(uid: string) {
  const docs = await Conversation.find({
    $or: [{ seekerUid: uid }, { providerUid: uid }],
  })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(100)

  return Promise.all(docs.map((doc) => toPublicConversation(doc, uid)))
}

export async function getConversationForUser(conversationId: string, uid: string) {
  const conversation = await assertParticipant(conversationId, uid)
  return toPublicConversation(conversation, uid)
}

export async function listMessages(input: {
  conversationId: string
  uid: string
  limit?: number
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

  const docs = await Message.find(query).sort({ createdAt: -1 }).limit(limit)
  return docs.reverse().map(toMessage)
}

export async function sendMessage(input: {
  conversationId: string
  senderUid: string
  body: string
}) {
  const body = input.body.trim()
  if (!body) {
    throw Object.assign(new Error('Mesazhi nuk mund të jetë bosh'), { status: 400 })
  }
  if (body.length > MAX_BODY) {
    throw Object.assign(new Error('Mesazhi është shumë i gjatë'), { status: 400 })
  }

  const conversation = await assertParticipant(input.conversationId, input.senderUid)
  const message = await Message.create({
    conversation: conversation._id,
    senderUid: input.senderUid,
    body,
  })

  conversation.lastMessageAt = message.createdAt
  conversation.lastMessagePreview = body.slice(0, 140)
  if (input.senderUid === conversation.seekerUid) {
    conversation.providerUnread += 1
  } else {
    conversation.seekerUnread += 1
  }
  await conversation.save()

  return toMessage(message)
}

export async function markConversationRead(conversationId: string, uid: string) {
  const conversation = await assertParticipant(conversationId, uid)
  if (uid === conversation.seekerUid) {
    conversation.seekerUnread = 0
  } else {
    conversation.providerUnread = 0
  }
  await conversation.save()
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
