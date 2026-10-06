import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { createRequire } from 'node:module'
import { Types } from 'mongoose'
import { createPresenceRegistry, PRESENCE_TTL_MS, type Presence } from '../src/services/presenceService'
import { User } from '../src/models/User'
import { Conversation } from '../src/models/Conversation'

test('presence stays online across tabs/devices and updates last seen only on the last disconnect', () => {
  let now = 1000
  const events: Presence[] = []
  const registry = createPresenceRegistry(value => events.push(value), () => now)
  registry.connect('tab', 'alice'); registry.connect('device', 'alice')
  assert.equal(events.length, 1)
  registry.disconnect('tab')
  assert.equal(registry.snapshot('alice').online, true)
  assert.equal(events.length, 1)
  now = 2000; registry.disconnect('device')
  assert.deepEqual(registry.snapshot('alice'), { uid: 'alice', online: false, lastSeen: new Date(2000).toISOString() })
  now = 3000; registry.disconnect('device'); registry.expire()
  assert.equal(events.length, 2)
  assert.equal(registry.snapshot('alice').lastSeen, new Date(2000).toISOString())
})

test('heartbeats retain live connections, stale presence expires safely and reconnect does not resurrect old sockets', () => {
  let now = 0
  const events: Presence[] = []
  const registry = createPresenceRegistry(value => events.push(value), () => now)
  registry.connect('old', 'alice'); registry.connect('live', 'alice')
  now = PRESENCE_TTL_MS - 1; registry.heartbeat('live')
  now = PRESENCE_TTL_MS + 1; registry.expire()
  assert.equal(registry.snapshot('alice').online, true)
  now += PRESENCE_TTL_MS; registry.expire()
  assert.equal(registry.snapshot('alice').online, false)
  const lastSeen = registry.snapshot('alice').lastSeen
  registry.heartbeat('old'); registry.disconnect('old')
  assert.equal(registry.snapshot('alice').lastSeen, lastSeen)
  assert.equal(events.filter(value => !value.online).length, 1)
  registry.connect('new', 'alice')
  assert.equal(registry.snapshot('alice').online, true)
  assert.equal(registry.snapshot('alice').lastSeen, lastSeen)
  registry.disconnect('new')
  assert.equal(registry.snapshot('alice').online, false)
  assert.deepEqual(registry.snapshot('unknown'), { uid: 'unknown', online: false })
})

test('authenticated Socket.IO presence scopes subscriptions and follows disconnect, multiple connections and reconnect in real time', async () => {
  process.env.FIREBASE_API_KEY = 'test-only-key'
  const originalFetch = global.fetch, originalUser = User.findOne, originalConversation = Conversation.findById
  global.fetch = (async (_url: unknown, init: any) => ({ ok: true, json: async () => ({ users: [{ localId: JSON.parse(init.body).idToken }] }) })) as any
  User.findOne = ((filter: any) => ({ lean: async () => ({ uid: filter.uid, name: filter.uid, roles: ['user'], accountStatus: 'active' }) })) as any
  const id = String(new Types.ObjectId())
  Conversation.findById = (async () => ({ _id: id, seekerUid: 'alice', providerUid: 'bob' })) as any
  const { attachRealtimeSocket } = await import('../src/services/socketServer')
  const { io: connect } = createRequire(`${process.cwd()}/../frontend/package.json`)('socket.io-client')
  const server = http.createServer(), io = attachRealtimeSocket(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const clients: any[] = []
  const once = (socket: any, event: string) => new Promise<any>((resolve, reject) => { const timer = setTimeout(() => reject(new Error(event)), 3000); socket.once(event, (value: any) => { clearTimeout(timer); resolve(value) }) })
  const open = async (uid: string) => { const socket = connect(`http://127.0.0.1:${(server.address() as any).port}`, { auth: { token: uid, uid: 'spoofed' }, transports: ['websocket'], reconnection: false }); clients.push(socket); await once(socket, 'connect'); return socket }
  const subscribe = (socket: any, payload = { conversationIds: [id] }) => new Promise<any>(resolve => socket.emit('presence:subscribe', payload, resolve))
  try {
    const alice = await open('alice'), mallory = await open('mallory')
    assert.equal((await subscribe(mallory)).ok, false)
    assert.equal((await subscribe(alice, { conversationIds: ['arbitrary-user'] })).ok, false)
    assert.deepEqual((await subscribe(alice)).presence, [{ uid: 'bob', online: false }])
    const online = once(alice, 'presence:update'), bob = await open('bob')
    assert.deepEqual(await online, { uid: 'bob', online: true })
    const bob2 = await open('bob')
    bob.disconnect()
    assert.equal((await subscribe(alice)).presence[0].online, true)
    const offline = once(alice, 'presence:update')
    bob2.disconnect()
    const seen = await offline
    assert.equal(seen.online, false); assert.ok(seen.lastSeen)
    const reconnected = once(alice, 'presence:update')
    bob.connect(); await once(bob, 'connect')
    assert.equal((await reconnected).online, true)
    const dropped = once(alice, 'presence:update')
    bob.io.engine.close()
    assert.equal((await dropped).online, false)
  } finally {
    clients.forEach(client => client.disconnect())
    await new Promise<void>(resolve => io.close(() => resolve()))
    global.fetch = originalFetch; User.findOne = originalUser; Conversation.findById = originalConversation
  }
})
