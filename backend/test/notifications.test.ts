import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Types } from 'mongoose'
import { Notification } from '../src/models/Notification'
import { notify, markRead, notificationHistory } from '../src/services/notificationService'
import { setRealtimeServer } from '../src/services/realtime'
import type { Server } from 'socket.io'

test('notifications persist before emitting, deduplicate non-chat events, and isolate history/read state', async () => {
  const originals = [Notification.create, Notification.exists, Notification.countDocuments, Notification.updateMany, Notification.find] as const
  const rows: any[] = [], events: any[] = []
  const matches = (row: any, query: any) => Object.entries(query).every(([key, value]: [string, any]) => value && typeof value === 'object' && '$ne' in value ? row[key] !== value.$ne : String(row[key]) === String(value))
  Notification.exists = (async (query: any) => rows.find(r => matches(r, query)) || null) as any
  Notification.countDocuments = (async (query: any) => rows.filter(r => matches(r, query)).length) as any
  Notification.create = (async (input: any) => {
    if (rows.some(r => r.recipientUid === input.recipientUid && (r.eventKey === input.eventKey || input.coalesceKey && r.coalesceKey === input.coalesceKey && r.readAt === null))) throw { code: 11000 }
    const row = { ...input, _id: new Types.ObjectId(), createdAt: new Date(), readAt: null }; rows.push(row); return row
  }) as any
  Notification.updateMany = (async (query: any, update: any) => { rows.filter(r => matches(r, query)).forEach(r => Object.assign(r, update.$set)) }) as any
  Notification.find = ((query: any) => {
    let skip = 0, limit = 20
    const chain = { sort: () => chain, skip: (n: number) => { skip = n; return chain }, limit: (n: number) => { limit = n; return chain }, lean: async () => rows.filter(r => matches(r, query)).slice(skip, skip + limit) }
    return chain
  }) as any
  setRealtimeServer({ to: (room: string) => ({ emit: (event: string, value: any) => { assert.ok(rows.length); events.push({ room, event, value }) } }) } as unknown as Server)
  try {
    const input = { type: 'request:new', title: 'New request', href: '/dashboard', eventKey: 'request:1', actorUid: 'actor' }
    await notify(['actor', 'alice', 'alice', 'bob'], input)
    await notify(['alice'], input)
    assert.equal(rows.length, 2)
    assert.deepEqual(events.filter(e => e.event === 'notification:new').map(e => e.room), ['user:alice', 'user:bob'])
    assert.equal((await notificationHistory('alice')).unreadCount, 1)
    assert.equal((await notificationHistory('alice')).notifications.length, 1)
    await markRead('alice', String(rows[1]._id))
    assert.equal((await notificationHistory('bob')).unreadCount, 1, 'cannot read another account notification')
    await markRead('alice')
    assert.equal((await notificationHistory('alice')).unreadCount, 0)
    assert.equal((await notificationHistory('bob')).unreadCount, 1)
    await assert.rejects(markRead('alice', 'invalid'))
    await notify(['alice'], { type: 'message:new', title: 'Message', href: '/dashboard', eventKey: 'message:1' })
    assert.equal(rows.filter(r => r.type === 'message:new').length, 0, 'chat never creates a bell notification')
    rows.push({ recipientUid: 'alice', type: 'message:new', _id: new Types.ObjectId(), readAt: null, createdAt: new Date() })
    assert.equal((await notificationHistory('alice')).notifications.some(n => n.type === 'message:new'), false, 'existing chat history is hidden')
    assert.equal((await notificationHistory('alice')).unreadCount, 0, 'legacy chat notifications do not inflate the bell')
    assert.equal((await notificationHistory('alice', 2)).notifications.length, 0)
    assert.ok(events.some(e => e.event === 'notification:read' && e.room === 'user:alice'))
  } finally {
    [Notification.create, Notification.exists, Notification.countDocuments, Notification.updateMany, Notification.find] = originals
  }
})

test('notification persistence failures never fail the business action or emit phantom notifications', async () => {
  const original = Notification.exists, log = console.error
  Notification.exists = (async () => { throw new Error('database unavailable') }) as any
  const events: any[] = []
  setRealtimeServer({ to: () => ({ emit: (...args: any[]) => events.push(args) }) } as unknown as Server)
  console.error = () => undefined
  try {
    await notify(['alice'], { type: 'request:new', title: 'Request', href: '/dashboard', eventKey: 'failure' })
    assert.equal(events.length, 0)
  } finally { Notification.exists = original; console.error = log }
})

test('Mongo schema enforces recipient/event uniqueness, unread coalescing, and indexed history', async () => {
  const notification = new Notification({ recipientUid: 'alice', type: 'request:new', title: 'Request', href: '/dashboard', eventKey: 'request:1' })
  assert.equal(notification.validateSync(), undefined)
  assert.equal(notification.readAt, null)
  const indexes = Notification.schema.indexes()
  assert.ok(indexes.some(([keys, options]) => keys.recipientUid === 1 && keys.eventKey === 1 && options.unique))
  assert.ok(indexes.some(([keys, options]) => keys.coalesceKey === 1 && options.unique && options.partialFilterExpression?.readAt === null))
  assert.ok(indexes.some(([keys]) => keys.recipientUid === 1 && keys.createdAt === -1 && keys._id === -1))
})
