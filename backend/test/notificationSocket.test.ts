import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createRequire } from 'node:module'
import { User } from '../src/models/User'
import { emitToUser } from '../src/services/realtime'

const { io: connect } = createRequire(`${process.cwd()}/../frontend/package.json`)('socket.io-client')

test('Socket.IO authenticates, isolates user rooms, and rejoins on reconnect', async () => {
  process.env.FIREBASE_API_KEY = 'test-only-key'
  const originalFetch = global.fetch, originalFind = User.findOne
  global.fetch = (async (_url: unknown, init: any) => {
    const token = JSON.parse(init.body).idToken
    if (token === 'bad') return { ok: false, json: async () => ({ error: { message: 'INVALID_ID_TOKEN' } }) }
    return { ok: true, json: async () => ({ users: [{ localId: token, displayName: token }] }) }
  }) as typeof fetch
  User.findOne = ((query: any) => ({ lean: async () => ({ uid: query.uid, name: query.uid, accountStatus: query.uid === 'suspended' ? 'suspended' : 'active' }) })) as any
  const { attachRealtimeSocket } = await import('../src/services/socketServer')
  const server = http.createServer()
  const io = attachRealtimeSocket(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as any).port}`
  const clients: any[] = []
  const client = (token?: string) => { const socket = connect(url, { auth: { token, uid: 'victim' }, transports: ['websocket'], reconnection: false }); clients.push(socket); return socket }
  const event = (socket: any, name: string) => new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out: ${name}`)), 3000)
    socket.once(name, (value: any) => { clearTimeout(timer); resolve(value) })
  })
  try {
    for (const token of [undefined, 'bad', 'suspended']) {
      const socket = client(token)
      assert.ok(await event(socket, 'connect_error'))
      assert.equal(socket.connected, false)
    }
    const alice = client('alice'), bob = client('bob')
    await Promise.all([event(alice, 'connect'), event(bob, 'connect')])
    const rooms = [...io.sockets.sockets.values()]
    assert.ok(rooms.some(s => s.rooms.has('user:alice')))
    assert.ok(rooms.every(s => !s.rooms.has('user:victim')), 'client-supplied UID cannot select a room')
    let bobReceived = false
    bob.on('notification:new', () => { bobReceived = true })
    const delivered = event(alice, 'notification:new')
    emitToUser('alice', 'notification:new', { id: 'saved-id' })
    assert.deepEqual(await delivered, { id: 'saved-id' })
    assert.equal(bobReceived, false)
    alice.disconnect()
    alice.connect()
    await event(alice, 'connect')
    const afterReconnect = event(alice, 'notification:count')
    emitToUser('alice', 'notification:count', { unreadCount: 3 })
    assert.deepEqual(await afterReconnect, { unreadCount: 3 })
  } finally {
    clients.forEach(socket => socket.disconnect())
    await new Promise<void>(resolve => io.close(() => resolve()))
    global.fetch = originalFetch; User.findOne = originalFind
  }
})

test('notification HTTP APIs authenticate and scope all history/read operations to the token owner', async () => {
  const express = (await import('express')).default
  const { Notification } = await import('../src/models/Notification')
  const router = (await import('../src/routes/notification.routes')).default
  const originalFetch = global.fetch, originalFindUser = User.findOne
  const originals = [Notification.find, Notification.countDocuments, Notification.updateMany] as const
  const queries: any[] = []
  global.fetch = (async (url: any, init: any) => {
    if (!String(url).startsWith('https://identitytoolkit.googleapis.com/')) return originalFetch(url, init)
    return { ok: true, json: async () => ({ users: [{ localId: 'alice', email: 'alice@example.com' }] }) }
  }) as typeof fetch
  User.findOne = (() => ({ lean: async () => ({ uid: 'alice', role: 'user', roles: ['user'], accountStatus: 'active' }) })) as any
  Notification.find = ((query: any) => { queries.push(query); const chain = { sort: () => chain, skip: () => chain, limit: () => chain, lean: async () => [] }; return chain }) as any
  Notification.countDocuments = (async (query: any) => { queries.push(query); return 0 }) as any
  Notification.updateMany = (async (query: any) => { queries.push(query); return { modifiedCount: 0 } }) as any
  const app = express(); app.use('/api/notifications', router)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/notifications`
  try {
    assert.equal((await fetch(base)).status, 401)
    const headers = { Authorization: 'Bearer alice' }
    const response = await fetch(`${base}?recipientUid=bob`, { headers })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.deepEqual(await response.json(), { notifications: [], unreadCount: 0, page: 1, hasMore: false })
    assert.equal((await fetch(`${base}?page=-1`, { headers })).status, 400)
    assert.equal((await fetch(`${base}/invalid/read`, { method: 'PATCH', headers })).status, 400)
    assert.equal((await fetch(`${base}/read-all?recipientUid=bob`, { method: 'PATCH', headers })).status, 200)
    assert.ok(queries.length >= 4)
    assert.ok(queries.every(query => query.recipientUid === 'alice'))
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
    global.fetch = originalFetch; User.findOne = originalFindUser
    ;[Notification.find, Notification.countDocuments, Notification.updateMany] = originals
  }
})

test('chat visibility is limited to authorized joined rooms and clears on leaving', async () => {
  const { Conversation } = await import('../src/models/Conversation')
  const { Message } = await import('../src/models/Message')
  const { Types } = await import('mongoose')
  const { attachRealtimeSocket } = await import('../src/services/socketServer')
  const { registerChatHandlers } = await import('../src/services/chatSocket')
  const originalFetch = global.fetch
  const originals = [User.findOne, User.find, Conversation.findById, Conversation.updateOne, Conversation.aggregate, Message.find, Message.countDocuments] as const
  const id = String(new Types.ObjectId())
  const row: any = { _id: id, seekerUid: 'alice', providerUid: 'bob', seekerUnread: 0, providerUnread: 3, createdAt: new Date(), set: (key: string, value: number) => { row[key] = value } }
  global.fetch = (async () => ({ ok: true, json: async () => ({ users: [{ localId: 'bob' }] }) })) as typeof fetch
  User.findOne = (() => ({ lean: async () => ({ uid: 'bob', name: 'Bob', role: 'provider', accountStatus: 'active' }) })) as any
  User.find = (() => ({ lean: async () => [] })) as any
  Conversation.findById = (async () => row) as any
  Conversation.updateOne = (async (_query: any, update: any) => Object.assign(row, update.$set)) as any
  Conversation.aggregate = (async () => [{ unread: row.providerUnread }]) as any
  Message.countDocuments = (async () => 0) as any
  Message.find = (() => { const chain = { sort: () => chain, skip: () => chain, limit: async () => [] }; return chain }) as any
  const server = http.createServer(), io = attachRealtimeSocket(server)
  registerChatHandlers(io)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const socket = connect(`http://127.0.0.1:${(server.address() as any).port}`, { auth: { token: 'bob' }, transports: ['websocket'], reconnection: false })
  const once = (event: string) => new Promise<any>((resolve, reject) => { const timer = setTimeout(() => reject(new Error(event)), 2000); socket.once(event, (value: any) => { clearTimeout(timer); resolve(value) }) })
  const ack = (payload: any) => new Promise<any>(resolve => socket.emit('conversation:join', payload, resolve))
  const drain = () => new Promise<void>(resolve => socket.emit('test:drain', resolve))
  io.on('connection', connected => connected.on('test:drain', callback => callback()))
  try {
    await once('connect')
    const remote = [...io.sockets.sockets.values()][0]!
    socket.emit('conversation:visibility', { conversationId: id, active: true }); await drain()
    assert.equal(remote.data.activeConversation, undefined)
    assert.equal((await ack({ conversationId: id, active: false })).ok, true)
    assert.equal(row.providerUnread, 3, 'a hidden conversation does not mark messages read')
    const count = once('chat:unread')
    socket.emit('conversation:visibility', { conversationId: id, active: true })
    assert.equal((await count).unreadCount, 0)
    assert.equal(remote.data.activeConversation, id)
    socket.emit('conversation:visibility', { conversationId: id, active: false }); await drain()
    assert.equal(remote.data.activeConversation, null)
    socket.emit('conversation:visibility', { conversationId: id, active: true }); await drain()
    socket.emit('conversation:leave', { conversationId: id }); await drain()
    assert.equal(remote.data.activeConversation, null)
    assert.equal(remote.rooms.has(`conversation:${id}`), false)
    let release!: (value: any) => void
    Conversation.findById = (() => new Promise(resolve => { release = resolve })) as any
    const lateJoin = ack({ conversationId: id, active: true })
    socket.emit('conversation:leave', { conversationId: id }); await drain()
    release(row)
    assert.equal((await lateJoin).ok, false, 'a delayed join cannot reactivate a conversation after navigation away')
    assert.equal(remote.data.activeConversation, null)
  } finally {
    socket.disconnect(); await new Promise<void>(resolve => io.close(() => resolve()))
    global.fetch = originalFetch
    ;[User.findOne, User.find, Conversation.findById, Conversation.updateOne, Conversation.aggregate, Message.find, Message.countDocuments] = originals
  }
})
