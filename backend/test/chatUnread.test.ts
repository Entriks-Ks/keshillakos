import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Types } from 'mongoose'
import type { Server } from 'socket.io'
import { Conversation } from '../src/models/Conversation'
import { Message } from '../src/models/Message'
import { User } from '../src/models/User'
import { Notification } from '../src/models/Notification'
import { ChatBlock } from '../src/models/ChatBlock'
import { sendMessage, markConversationRead } from '../src/services/chatService'
import { chatUnreadCount, publishChatUnread } from '../src/services/chatUnreadService'
import { setRealtimeServer } from '../src/services/realtime'

test('chat unread is atomic, stays read for an active viewer, syncs reads, and never creates bell notifications', async () => {
  const originals = [Conversation.findById, Conversation.findByIdAndUpdate, Conversation.updateOne, Conversation.aggregate, Message.create, User.find, Notification.create] as const
  const originalBlocks = ChatBlock.find
  ChatBlock.find = (() => ({ lean: async () => [] })) as any
  const id = new Types.ObjectId()
  const row: any = { _id: id, seekerUid: 'alice', providerUid: 'bob', seekerUnread: 0, providerUnread: 0, createdAt: new Date(), set: (key: string, value: any) => { row[key] = value } }
  const events: any[] = [], updates: any[] = []
  let bellWrites = 0, active: string | null = null
  Conversation.findById = (async () => row) as any
  Conversation.findByIdAndUpdate = (async (_id: any, update: any) => {
    updates.push(update); Object.assign(row, update.$set)
    for (const [key, value] of Object.entries(update.$inc || {})) row[key] += Number(value)
    return row
  }) as any
  Conversation.updateOne = (async (_query: any, update: any) => Object.assign(row, update.$set)) as any
  Conversation.aggregate = (async (pipeline: any) => {
    const uid = pipeline[0].$match.$or[0].seekerUid
    return [{ unread: uid === 'alice' ? row.seekerUnread : row.providerUnread }]
  }) as any
  Message.create = (async (input: any) => ({ ...input, _id: new Types.ObjectId(), createdAt: new Date() })) as any
  User.find = (() => ({ lean: async () => [] })) as any
  Notification.create = (async () => { bellWrites++; throw new Error('Chat must not create notifications') }) as any
  setRealtimeServer({
    sockets: { adapter: { rooms: new Map([['user:bob', new Set(['bob-socket'])]]) }, sockets: { get: () => ({ data: { activeConversation: active } }) } },
    to: (rooms: any) => ({ emit: (event: string, value: any) => events.push({ rooms, event, value }) }),
  } as unknown as Server)
  try {
    await Promise.all([sendMessage({ conversationId: String(id), senderUid: 'alice', body: 'One' }), sendMessage({ conversationId: String(id), senderUid: 'alice', body: 'Two' })])
    assert.equal(row.providerUnread, 2)
    assert.equal(row.seekerUnread, 0)
    assert.ok(updates.every(update => update.$inc.providerUnread === 1))
    assert.equal(bellWrites, 0)
    assert.equal(events.filter(e => e.event === 'message:new').length, 2)
    assert.equal(events.filter(e => e.event === 'conversation:updated').length, 2)
    assert.equal(events.some(e => e.event.startsWith('notification:')), false)
    assert.equal(events.filter(e => e.event === 'chat:unread').at(-1).value.unreadCount, 2)
    active = String(id)
    await sendMessage({ conversationId: String(id), senderUid: 'alice', body: 'Viewed message' })
    assert.equal(row.providerUnread, 0)
    active = null
    await sendMessage({ conversationId: String(id), senderUid: 'alice', body: 'Hidden conversation' })
    assert.equal(row.providerUnread, 1)
    await markConversationRead(String(id), 'bob')
    assert.equal(row.providerUnread, 0)
    assert.equal(events.filter(e => e.event === 'chat:unread').at(-1).value.unreadCount, 0)
    await assert.rejects(sendMessage({ conversationId: String(id), senderUid: 'mallory', body: 'Forbidden' }))
  } finally {
    [Conversation.findById, Conversation.findByIdAndUpdate, Conversation.updateOne, Conversation.aggregate, Message.create, User.find, Notification.create] = originals
    ChatBlock.find = originalBlocks
  }
})

test('aggregate unread spans all conversations and ignores stale asynchronous count results', async () => {
  const original = Conversation.aggregate
  const pipelines: any[] = [], events: any[] = []
  let resolveOlder!: (value: any) => void
  let call = 0
  Conversation.aggregate = ((pipeline: any) => { pipelines.push(pipeline); call++; return call === 1 ? new Promise(resolve => { resolveOlder = resolve }) : Promise.resolve([{ unread: 7 }]) }) as any
  setRealtimeServer({ to: () => ({ emit: (event: string, value: any) => events.push({ event, value }) }) } as unknown as Server)
  try {
    const old = publishChatUnread('alice')
    await publishChatUnread('alice')
    resolveOlder([{ unread: 4 }]); await old
    assert.deepEqual(events, [{ event: 'chat:unread', value: { unreadCount: 7 } }])
    assert.deepEqual(pipelines[0][0].$match.$or, [{ seekerUid: 'alice' }, { providerUid: 'alice' }])
    assert.equal(await chatUnreadCount('alice'), 7)
  } finally { Conversation.aggregate = original }
})
