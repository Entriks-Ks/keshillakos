// Read-only MongoDB aggregation over inline fixtures; never writes production collections.
// Build first, then KESHILLAKOS_CHAT_MONGO_TEST=1 node --test test/chatUnreadCalculation.integration.cjs
const test = require('node:test'), assert = require('node:assert/strict')
const enabled = process.env.KESHILLAKOS_CHAT_MONGO_TEST === '1'
test('real unread aggregation and send/read services satisfy incoming-only badge scenarios', { skip: !enabled }, async t => {
  require('dotenv').config({ quiet: true })
  const mongoose = require('mongoose')
  const { Conversation } = require('../dist/models/Conversation')
  const { Message } = require('../dist/models/Message')
  const { User } = require('../dist/models/User')
  const { ChatBlock } = require('../dist/models/ChatBlock')
  const { Notification } = require('../dist/models/Notification')
  const { chatUnreadCount, chatUnreadTotals } = require('../dist/services/chatUnreadService')
  const { sendMessage, markConversationRead } = require('../dist/services/chatService')
  const { setRealtimeServer } = require('../dist/services/realtime')
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  const rows = [
    { _id: new mongoose.Types.ObjectId(), seekerUid: 'me', providerUid: 'other-a', seekerUnread: 0, providerUnread: 0 },
    { _id: new mongoose.Types.ObjectId(), seekerUid: 'other-b', providerUid: 'me', seekerUnread: 0, providerUnread: 0 },
    { _id: new mongoose.Types.ObjectId(), seekerUid: 'unrelated', providerUid: 'unrelated-provider', seekerUnread: 100, providerUnread: 100 },
    { _id: new mongoose.Types.ObjectId(), seekerUid: 'me', providerUid: 'other-c', seekerUnread: 0, providerUnread: 0 },
  ]
  rows.forEach(row => { row.createdAt = new Date(); row.set = function(key, value) { this[key] = value } })
  const originals = [], events = [], history = []
  const mock = (object, key, value) => { originals.push([object, key, object[key]]); object[key] = value }
  const find = id => rows.find(row => String(row._id) === String(id))
  mock(Conversation, 'findById', async id => find(id))
  mock(Conversation, 'findByIdAndUpdate', async (id, update) => {
    const row = find(id); Object.assign(row, update.$set)
    for (const [key, value] of Object.entries(update.$inc || {})) row[key] += value
    return row
  })
  mock(Conversation, 'updateOne', async (query, update) => { Object.assign(find(query._id), update.$set); return { acknowledged: true } })
  mock(Conversation, 'aggregate', pipeline => {
    const documents = rows.map(({ set, ...row }) => row)
    // Execute the exact production pipeline with MongoDB, not a fixture's predetermined sum.
    return mongoose.connection.db.aggregate([{ $documents: documents }, ...pipeline]).toArray()
  })
  mock(Message, 'create', async input => { const message = { ...input, _id: new mongoose.Types.ObjectId(), createdAt: new Date() }; history.push(message); return message })
  mock(User, 'find', () => ({ lean: async () => [] }))
  mock(ChatBlock, 'find', () => ({ lean: async () => [] }))
  mock(Notification, 'create', async () => { throw Error('Chat must never create bell notifications') })
  setRealtimeServer({ sockets: { adapter: { rooms: new Map() }, sockets: new Map() }, to: rooms => ({ emit: (event, payload) => events.push({ rooms, event, payload }) }) })
  const send = (row, senderUid) => sendMessage({ conversationId: String(row._id), senderUid, body: 'test-only inline fixture' })
  const read = row => markConversationRead(String(row._id), 'me')
  try {
    await t.test('10 outgoing messages contribute zero unread to their sender', async () => {
      for (let i = 0; i < 10; i++) await send(rows[0], 'me')
      assert.equal(history.length, 10)
      assert.equal(await chatUnreadCount('me'), 0)
      assert.equal((await chatUnreadTotals('me')).unreadConversationCount, 0)
      assert.equal((await chatUnreadTotals('other-a')).unreadConversationCount, 1)
      assert.equal(await chatUnreadCount('other-a'), 10)
    })
    await t.test('20 unread incoming messages in one conversation contribute exactly one unread conversation', async () => {
      for (let i = 0; i < 20; i++) await send(rows[0], 'other-a')
      assert.deepEqual(await chatUnreadTotals('me'), { unreadCount: 20, unreadConversationCount: 1 })
      await send(rows[0], 'other-a')
      assert.deepEqual(await chatUnreadTotals('me'), { unreadCount: 21, unreadConversationCount: 1 })
      await read(rows[0])
      assert.deepEqual(await chatUnreadTotals('me'), { unreadCount: 0, unreadConversationCount: 0 })
    })
    await t.test('10 incoming messages, all read, contribute zero', async () => {
      for (let i = 0; i < 10; i++) await send(rows[0], 'other-a')
      assert.equal(await chatUnreadCount('me'), 10)
      await read(rows[0])
      assert.equal(await chatUnreadCount('me'), 0)
    })
    await t.test('10 incoming messages with seven read contribute exactly three', async () => {
      for (let i = 0; i < 7; i++) await send(rows[0], 'other-a')
      await read(rows[0])
      for (let i = 0; i < 3; i++) await send(rows[0], 'other-a')
      assert.equal(await chatUnreadCount('me'), 3)
      await read(rows[0])
    })
    await t.test('three unread across two conversations aggregate by participant, not conversation count', async () => {
      await send(rows[0], 'other-a')
      await send(rows[1], 'other-b'); await send(rows[1], 'other-b')
      assert.deepEqual(await chatUnreadTotals('me'), { unreadCount: 3, unreadConversationCount: 2 })
      await send(rows[0], 'me')
      assert.deepEqual(await chatUnreadTotals('me'), { unreadCount: 3, unreadConversationCount: 2 })
      assert.equal(events.filter(e => e.event === 'chat:unread' && e.rooms === 'user:me').at(-1).payload.unreadCount, 3)
    })
    await t.test('reading one conversation retains the other two unread messages until confirmed read', async () => {
      await read(rows[0]); assert.deepEqual(await chatUnreadTotals('me'), { unreadCount: 2, unreadConversationCount: 1 })
      assert.equal(rows[1].providerUnread, 2)
      const receipt = events.filter(e => e.event === 'conversation:read').at(-1).payload
      assert.equal(receipt.uid, 'me'); assert.equal(receipt.conversationId, String(rows[0]._id))
      await read(rows[1]); assert.deepEqual(await chatUnreadTotals('me'), { unreadCount: 0, unreadConversationCount: 0 })
      assert.equal(events.filter(e => e.event === 'chat:unread' && e.rooms === 'user:me').at(-1).payload.unreadCount, 0)
      assert.equal(events.some(e => e.event.startsWith('notification:')), false)
    })
    await t.test('three unread conversations each count once and all-read conversations contribute zero', async () => {
      for (const [row, sender] of [[rows[0], 'other-a'], [rows[1], 'other-b'], [rows[3], 'other-c']]) {
        await send(row, sender); await send(row, sender)
      }
      assert.deepEqual(await chatUnreadTotals('me'), { unreadCount: 6, unreadConversationCount: 3 })
      await read(rows[0]); await read(rows[1]); await read(rows[3])
      assert.deepEqual(await chatUnreadTotals('me'), { unreadCount: 0, unreadConversationCount: 0 })
    })
  } finally {
    originals.forEach(([object, key, value]) => { object[key] = value })
    await mongoose.disconnect()
  }
})
