import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import { ChatBlock } from '../src/models/ChatBlock'
import { Conversation } from '../src/models/Conversation'
import { Message } from '../src/models/Message'
import { User } from '../src/models/User'
import { ProviderProfile } from '../src/models/ProviderProfile'
import { UserRequest } from '../src/models/UserRequest'
import { RequestDelivery } from '../src/models/RequestDelivery'
import { ServiceRequest } from '../src/models/ServiceRequest'
import { Service } from '../src/models/Service'
import { ServiceOffer } from '../src/models/ServiceOffer'
import { PlatformFeedback } from '../src/models/PlatformFeedback'
import { assertParticipant, openOrGetConversation, sendMessage } from '../src/services/chatService'
import { assertChatUnblocked, chatAvailability, reportChatUser, setChatBlock } from '../src/services/chatSafetyService'
import { chatRequestContext } from '../src/services/chatContextService'
import { chatAttachmentKey, CHAT_ATTACHMENT_MAX_BYTES, CHAT_ATTACHMENT_TYPES } from '../src/services/chatAttachmentPolicy'
import { mediaKeyFromPath } from '../src/services/mediaService'
import { registerChatHandlers } from '../src/services/chatSocket'
import { putObject } from '../src/services/s3Storage'

function query(value: unknown): any { const q = { select: () => q, sort: () => q, limit: () => q, lean: async () => value }; return q }

test('existing client-to-provider and requested provider-to-client start rules still work', async () => {
  const originals = [ChatBlock.find, User.findOne, User.find, ProviderProfile.find, UserRequest.find, ServiceRequest.exists, Conversation.findOne] as const
  const row = { _id: new Types.ObjectId(), seekerUid: 'alice', providerUid: 'bob', seekerUnread: 0, providerUnread: 0, createdAt: new Date() }
  ChatBlock.find = (() => query([])) as any
  User.findOne = ((filter: any) => query({ _id: new Types.ObjectId(), uid: filter.uid, name: filter.uid, email: 'test@example.com', roles: filter.uid === 'bob' ? ['user', 'provider'] : ['user'], accountStatus: 'active' })) as any
  User.find = (() => query([])) as any
  ProviderProfile.find = (() => query([])) as any
  UserRequest.find = (() => query([])) as any
  ServiceRequest.exists = (async () => ({ _id: new Types.ObjectId() })) as any
  Conversation.findOne = (async () => row) as any
  try {
    assert.equal((await openOrGetConversation({ seekerUid: 'alice', providerUid: 'bob', senderUid: 'alice' })).conversation.id, String(row._id))
    assert.equal((await openOrGetConversation({ seekerUid: 'alice', providerUid: 'bob', senderUid: 'bob' })).conversation.id, String(row._id))
  } finally { [ChatBlock.find, User.findOne, User.find, ProviderProfile.find, UserRequest.find, ServiceRequest.exists, Conversation.findOne] = originals }
})

test('socket handlers reject foreign room joins, spoofed sends and blocked sends/typing without persistence or broadcasts', async () => {
  const originals = [Conversation.findById, ChatBlock.find, Message.create] as const
  const row = { _id: new Types.ObjectId(), seekerUid: 'alice', providerUid: 'bob' }
  const handlers = new Map<string, (...args: any[]) => any>()
  let uid = 'mallory', writes = 0, broadcasts = 0, joins = 0
  const socket: any = { data: { user: { uid } }, connected: true, rooms: new Set([`conversation:${row._id}`]), on: (event: string, handler: any) => handlers.set(event, handler), join: () => { joins++ }, to: () => ({ emit: () => { broadcasts++ } }) }
  Conversation.findById = (async () => row) as any
  ChatBlock.find = (() => query([{ blockerUid: 'alice', blockedUid: 'bob' }])) as any
  Message.create = (async () => { writes++; throw new Error('Unexpected write') }) as any
  try {
    registerChatHandlers({ on: (_event: string, callback: any) => callback(socket) } as any)
    let ack: any
    await handlers.get('conversation:join')!({ conversationId: String(row._id) }, (value: any) => { ack = value })
    assert.equal(ack.ok, false)
    await handlers.get('message:send')!({ conversationId: String(row._id), senderUid: 'alice', body: 'Spoofed' }, (value: any) => { ack = value })
    assert.equal(ack.ok, false)
    socket.data.user.uid = 'bob'
    await handlers.get('message:send')!({ conversationId: String(row._id), body: 'Blocked' }, (value: any) => { ack = value })
    assert.equal(ack.ok, false)
    await handlers.get('typing')!({ conversationId: String(row._id), isTyping: true })
    assert.equal(writes, 0); assert.equal(broadcasts, 0); assert.equal(joins, 0)
  } finally { [Conversation.findById, ChatBlock.find, Message.create] = originals }
})

test('shared chat service rejects manipulated participants, arbitrary provider outreach and foreign services before creating a thread', async () => {
  const originals = [ChatBlock.find, User.findOne, ProviderProfile.find, UserRequest.find, ServiceRequest.exists, ServiceOffer.findOne, Service.findOne, Conversation.create] as const
  let writes = 0
  const accountId = new Types.ObjectId()
  ChatBlock.find = (() => query([])) as any
  User.findOne = ((filter: any) => query({ _id: accountId, uid: filter.uid, name: filter.uid, email: 'test@example.com', roles: filter.uid === 'provider' ? ['user', 'provider'] : ['user'], accountStatus: 'active' })) as any
  ProviderProfile.find = (() => query([])) as any
  UserRequest.find = (() => query([])) as any
  ServiceRequest.exists = (async () => null) as any
  ServiceOffer.findOne = (() => query(null)) as any
  Service.findOne = (() => query(null)) as any
  Conversation.create = (async () => { writes++; throw new Error('Unexpected write') }) as any
  try {
    await assert.rejects(openOrGetConversation({ seekerUid: 'alice', providerUid: 'provider', senderUid: 'mallory' }), { status: 403 })
    await assert.rejects(openOrGetConversation({ seekerUid: 'alice', providerUid: 'provider', senderUid: 'provider' }), { status: 403 })
    await assert.rejects(openOrGetConversation({ seekerUid: 'alice', providerUid: 'ordinary-user' }), /nuk ofron shërbime/)
    await assert.rejects(openOrGetConversation({ seekerUid: 'alice', providerUid: 'provider', serviceId: String(new Types.ObjectId()) }), { status: 403 })
    await assert.rejects(openOrGetConversation({ seekerUid: 'alice', providerUid: 'provider', initialMessage: 'a'.repeat(4001) }), { status: 400 })
    assert.equal(writes, 0)
  } finally { [ChatBlock.find, User.findOne, ProviderProfile.find, UserRequest.find, ServiceRequest.exists, ServiceOffer.findOne, Service.findOne, Conversation.create] = originals }
})

test('participants retain history access while either-direction blocks prevent sending and can only be removed by their owner', async () => {
  const originals = [ChatBlock.find, ChatBlock.updateOne, ChatBlock.deleteOne, Conversation.findById, Conversation.find, Message.create] as const
  const row = { _id: new Types.ObjectId(), seekerUid: 'alice', providerUid: 'bob' }
  let blocks: any[] = [], writes = 0
  ChatBlock.find = (() => query(blocks)) as any
  ChatBlock.updateOne = (async (filter: any) => { blocks = [filter] }) as any
  ChatBlock.deleteOne = (async (filter: any) => { blocks = blocks.filter(b => b.blockerUid !== filter.blockerUid || b.blockedUid !== filter.blockedUid) }) as any
  Conversation.findById = (async () => row) as any
  Conversation.find = (() => query([{ _id: row._id }])) as any
  Message.create = (async () => { writes++; throw new Error('Unexpected write') }) as any
  try {
    assert.equal(await assertParticipant(String(row._id), 'alice'), row)
    await assert.rejects(assertParticipant(String(row._id), 'mallory'), { status: 403 })
    await assert.rejects(setChatBlock(row, 'mallory', true), { status: 403 })
    assert.deepEqual(await setChatBlock(row, 'alice', true), { blockedByMe: true, messagingBlocked: true })
    assert.deepEqual(await chatAvailability('bob', 'alice'), { blockedByMe: false, messagingBlocked: true })
    await assert.rejects(sendMessage({ conversationId: String(row._id), senderUid: 'bob', body: 'Blocked' }), { status: 403 })
    await assert.rejects(sendMessage({ conversationId: String(row._id), senderUid: 'alice', body: 'Blocked' }), { status: 403 })
    await setChatBlock(row, 'bob', false)
    await assert.rejects(assertChatUnblocked('bob', 'alice'), { status: 403 })
    await setChatBlock(row, 'alice', false)
    await assertChatUnblocked('bob', 'alice')
    assert.equal(writes, 0)
    assert.equal(await assertParticipant(String(row._id), 'bob'), row)
  } finally { [ChatBlock.find, ChatBlock.updateOne, ChatBlock.deleteOne, Conversation.findById, Conversation.find, Message.create] = originals }
})

test('reports require participation, a bounded reason and deduplicate pending reports without exposing message text', async () => {
  const originals = [PlatformFeedback.exists, PlatformFeedback.create, User.findOne] as const
  const row = { _id: new Types.ObjectId(), seekerUid: 'alice', providerUid: 'bob' }
  let pending = false, writes = 0, saved: any
  PlatformFeedback.exists = (async () => pending ? { _id: row._id } : null) as any
  PlatformFeedback.create = (async (input: any) => { writes++; saved = input; pending = true; return { _id: row._id } }) as any
  User.findOne = (() => query({ uid: 'alice', name: 'Alice', email: 'alice@example.com', roles: ['user'] })) as any
  // No admin lookup is needed for the duplicate path; use the existing safe notification failure handling for the first write.
  const originalFind = User.find
  User.find = (() => query([])) as any
  try {
    await assert.rejects(reportChatUser(row, 'mallory', 'Valid reason'), { status: 403 })
    await assert.rejects(reportChatUser(row, 'alice', 'x'), { status: 400 })
    await assert.rejects(reportChatUser(row, 'alice', 'x'.repeat(501)), { status: 400 })
    await reportChatUser(row, 'alice', 'Sjellje e papërshtatshme')
    await reportChatUser(row, 'alice', 'Raportim i përsëritur')
    assert.equal(writes, 1)
    assert.equal(saved.chatReport.reportedUid, 'bob')
    assert.equal(saved.chatReport.conversationId, String(row._id))
    assert.equal(saved.userUid, 'alice')
    assert.equal(saved.email, 'alice@example.com')
  } finally { [PlatformFeedback.exists, PlatformFeedback.create, User.findOne] = originals; User.find = originalFind }
})

test('request context validates both parties, follows an explicit delivery, and hides ambiguous older threads', async () => {
  const originals = [User.findOne, ProviderProfile.find, UserRequest.find, RequestDelivery.find, ServiceRequest.find] as const
  const seekerId = new Types.ObjectId(), providerId = new Types.ObjectId(), profileId = new Types.ObjectId(), requestId = new Types.ObjectId(), deliveryId = new Types.ObjectId()
  let deliveries: any[] = [{ _id: deliveryId, request: requestId, status: 'pending' }], captured: any
  User.findOne = ((filter: any) => query({ _id: filter.uid === 'alice' ? seekerId : providerId })) as any
  ProviderProfile.find = (() => query([{ _id: profileId }])) as any
  UserRequest.find = (() => query([{ _id: requestId, problem: 'Këshillim juridik', status: 'open' }])) as any
  RequestDelivery.find = ((filter: any) => { captured = filter; return query(deliveries) }) as any
  ServiceRequest.find = (() => query([])) as any
  try {
    const context = await chatRequestContext({ seekerUid: 'alice', providerUid: 'bob', requestDeliveryId: deliveryId })
    assert.deepEqual(context, { id: String(deliveryId), title: 'Këshillim juridik', status: 'pending' })
    assert.deepEqual(captured.providerProfile.$in, [profileId])
    assert.deepEqual(captured.request.$in, [requestId])
    assert.equal(captured._id, deliveryId)
    deliveries = [...deliveries, { ...deliveries[0], _id: new Types.ObjectId() }]
    assert.equal(await chatRequestContext({ seekerUid: 'alice', providerUid: 'bob' }), null)
    deliveries = []
    assert.equal(await chatRequestContext({ seekerUid: 'alice', providerUid: 'bob' }), null)
  } finally { [User.findOne, ProviderProfile.find, UserRequest.find, RequestDelivery.find, ServiceRequest.find] = originals }
})

test('future chat files are limited to five types, 5 MB and keys inaccessible through public media', async () => {
  assert.equal(CHAT_ATTACHMENT_MAX_BYTES, 5 * 1024 * 1024)
  assert.deepEqual(Object.values(CHAT_ATTACHMENT_TYPES), ['.pdf', '.jpg', '.png', '.doc', '.docx'])
  const key = chatAttachmentKey(String(new Types.ObjectId()), 'a'.repeat(32), 'application/pdf')
  assert.equal(mediaKeyFromPath(`/media/${key}`), null)
  await assert.rejects(putObject(key, Buffer.from('test'), 'application/pdf'), /require private storage/)
  assert.throws(() => chatAttachmentKey('../escape', 'a'.repeat(32), 'application/pdf'))
  assert.throws(() => chatAttachmentKey(String(new Types.ObjectId()), 'a'.repeat(32), 'text/html' as any))
})
