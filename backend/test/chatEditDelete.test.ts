import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Types } from 'mongoose'
import type { Server } from 'socket.io'
import { Conversation } from '../src/models/Conversation'
import { Message } from '../src/models/Message'
import { ChatBlock } from '../src/models/ChatBlock'
import { editMessage, deleteMessage, deleteConversation } from '../src/services/chatService'
import { setRealtimeServer } from '../src/services/realtime'

test('only the sender can edit or delete a message; changes sync the latest preview and emit message:updated', async () => {
  const originals = [Conversation.findById, Conversation.updateOne, Message.findOne] as const
  const originalBlocks = ChatBlock.find
  ChatBlock.find = (() => ({ lean: async () => [] })) as any
  const conversationId = new Types.ObjectId(), messageId = new Types.ObjectId()
  const createdAt = new Date('2026-11-09T10:00:00Z')
  const conversation: any = { _id: conversationId, seekerUid: 'alice', providerUid: 'bob', lastMessageAt: createdAt, lastMessagePreview: 'Hello' }
  const message: any = { _id: messageId, conversation: conversationId, senderUid: 'alice', body: 'Hello', createdAt, editedAt: null, deletedAt: null, save: async () => message }
  const events: any[] = []
  Conversation.findById = (async () => conversation) as any
  Conversation.updateOne = (async (_q: any, update: any) => Object.assign(conversation, update.$set)) as any
  Message.findOne = (async () => message) as any
  setRealtimeServer({ to: (rooms: any) => ({ emit: (event: string, value: any) => events.push({ rooms, event, value }) }) } as unknown as Server)
  try {
    await assert.rejects(editMessage({ conversationId: String(conversationId), messageId: String(messageId), uid: 'bob', body: 'Hack' }), /vetëm mesazhet e tua/)
    await assert.rejects(deleteMessage({ conversationId: String(conversationId), messageId: String(messageId), uid: 'mallory' }))
    await assert.rejects(editMessage({ conversationId: String(conversationId), messageId: String(messageId), uid: 'alice', body: '   ' }))

    const edited = await editMessage({ conversationId: String(conversationId), messageId: String(messageId), uid: 'alice', body: 'Hello again' })
    assert.equal(edited.body, 'Hello again')
    assert.ok(edited.editedAt)
    assert.equal(conversation.lastMessagePreview, 'Hello again')
    assert.equal(events.at(-1).event, 'message:updated')
    assert.equal(events.at(-1).value.lastMessagePreview, 'Hello again')
    assert.deepEqual(events.at(-1).rooms, [`conversation:${conversationId}`, 'user:bob', 'user:alice'])

    const deleted = await deleteMessage({ conversationId: String(conversationId), messageId: String(messageId), uid: 'alice' })
    assert.equal(deleted.deleted, true)
    assert.equal(deleted.body, '')
    assert.equal(deleted.editedAt, undefined)
    assert.equal(conversation.lastMessagePreview, 'Mesazhi u fshi')
    await assert.rejects(editMessage({ conversationId: String(conversationId), messageId: String(messageId), uid: 'alice', body: 'Back' }), /fshirë/)
  } finally {
    [Conversation.findById, Conversation.updateOne, Message.findOne] = originals
    ChatBlock.find = originalBlocks
  }
})

test('a participant can delete the conversation; messages and conversation doc are removed and realtime event is emitted', async () => {
  const originals = [Conversation.findById, Conversation.findByIdAndDelete, Message.deleteMany, Conversation.aggregate] as const
  const conversationId = new Types.ObjectId()
  const conversation: any = { _id: conversationId, seekerUid: 'alice', providerUid: 'bob' }
  const events: any[] = []
  let deletedMessagesFilter: any = null
  let deletedConversationId: any = null

  Conversation.findById = (async () => conversation) as any
  Conversation.findByIdAndDelete = (async (id: any) => { deletedConversationId = id; return conversation }) as any
  Conversation.aggregate = (async () => [{ total: 0, unread: 0, unreadConversations: 0 }]) as any
  Message.deleteMany = (async (filter: any) => { deletedMessagesFilter = filter; return { deletedCount: 5 } }) as any
  setRealtimeServer({ to: (rooms: any) => ({ emit: (event: string, value: any) => events.push({ rooms, event, value }) }) } as unknown as Server)

  try {
    await assert.rejects(deleteConversation(String(conversationId), 'mallory'), /Nuk ke leje/)

    const res = await deleteConversation(String(conversationId), 'alice')
    assert.deepEqual(res, { ok: true, conversationId: String(conversationId) })
    assert.equal(String(deletedConversationId), String(conversationId))
    assert.equal(String(deletedMessagesFilter.conversation), String(conversationId))
    assert.equal(events.some(e => e.event === 'conversation:deleted'), true)
    const deleteEvent = events.find(e => e.event === 'conversation:deleted')
    assert.deepEqual(deleteEvent.value, { conversationId: String(conversationId) })
    assert.deepEqual(deleteEvent.rooms, [`conversation:${conversationId}`, 'user:alice', 'user:bob'])
  } finally {
    [Conversation.findById, Conversation.findByIdAndDelete, Message.deleteMany, Conversation.aggregate] = originals
  }
})
