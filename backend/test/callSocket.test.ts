import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createRequire } from 'node:module'
import mongoose from 'mongoose'
import { User } from '../src/models/User'
import { Call } from '../src/models/Call'
import { Conversation } from '../src/models/Conversation'
import { ChatBlock } from '../src/models/ChatBlock'
import { emitToUser } from '../src/services/realtime'

const { io: connect } = createRequire(`${process.cwd()}/../frontend/package.json`)('socket.io-client')

test('Socket.IO call lifecycle: initiate -> incoming -> accept -> accepted -> end -> ended', async () => {
  process.env.FIREBASE_API_KEY = 'test-only-key'
  const originalFetch = global.fetch
  const originalUserFind = User.findOne
  const originalUserFindMany = User.find
  const originalConvFind = Conversation.findById
  const originalCallFind = Call.findById
  const originalCallFindOne = Call.findOne
  const originalCallFindMany = Call.find
  const originalCallCreate = Call.create
  const originalCallFindOneAndUpdate = Call.findOneAndUpdate
  const originalBlockFindOne = ChatBlock.findOne
  const originalBlockFind = ChatBlock.find

  Call.find = (async () => []) as any
  ChatBlock.findOne = (() => ({ lean: async () => null })) as any
  ChatBlock.find = (() => ({ lean: async () => [] })) as any

  // Mock fetch for firebase token verification
  global.fetch = (async (_url: unknown, init: any) => {
    const token = JSON.parse(init.body).idToken
    return {
      ok: true,
      json: async () => ({
        users: [{ localId: token, displayName: token === 'alice' ? 'Alice' : 'Bob' }],
      }),
    }
  }) as typeof fetch

  // Mock User
  User.findOne = ((query: any) => ({
    lean: async () => ({
      uid: query.uid,
      name: query.uid === 'alice' ? 'Alice' : 'Bob',
      accountStatus: 'active',
      profilePhoto: '',
    }),
  })) as any

  User.find = (() => ({
    lean: async () => [
      { uid: 'alice', name: 'Alice' },
      { uid: 'bob', name: 'Bob' },
    ],
  })) as any

  const fakeConversationId = new mongoose.Types.ObjectId().toString()
  Conversation.findById = (async () => ({
    _id: fakeConversationId,
    seekerUid: 'alice',
    providerUid: 'bob',
  })) as any

  const fakeCallId = new mongoose.Types.ObjectId().toString()
  const mockCall = {
    _id: fakeCallId,
    callerId: 'alice',
    receiverId: 'bob',
    conversationId: fakeConversationId,
    roomName: 'test-room-call',
    callType: 'video',
    status: 'ringing',
    startedAt: new Date(),
    answeredAt: null as Date | null,
    endedAt: null as Date | null,
    duration: 0,
    save: async function () {
      return this
    },
  }

  Call.findOne = (async () => null) as any
  Call.create = (async () => mockCall) as any
  Call.findById = (async (id: any) => {
    if (id.toString() === fakeCallId) return mockCall
    return null
  }) as any
  Call.findOneAndUpdate = (async (filter: any, update: any) => {
    if (String(filter._id) === String(fakeCallId) && mockCall.status === filter.status) {
      Object.assign(mockCall, update.$set)
      return mockCall
    }
    return null
  }) as any

  const { attachRealtimeSocket } = await import('../src/services/socketServer')
  const { registerCallHandlers } = await import('../src/services/callSocket')

  const server = http.createServer()
  const io = attachRealtimeSocket(server)
  registerCallHandlers(io)

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as any).port}`

  const clients: any[] = []
  const client = (token: string) => {
    const socket = connect(url, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    })
    clients.push(socket)
    return socket
  }

  const waitForEvent = (socket: any, name: string) =>
    new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for: ${name}`)), 3500)
      socket.once(name, (value: any) => {
        clearTimeout(timer)
        resolve(value)
      })
    })

  try {
    const aliceSocket = client('alice')
    const bobSocket = client('bob')

    await Promise.all([
      waitForEvent(aliceSocket, 'connect'),
      waitForEvent(bobSocket, 'connect'),
    ])

    // Set up listener on Bob for call:incoming
    const incomingPromise = waitForEvent(bobSocket, 'call:incoming')

    // Alice initiates call
    const initiateAck: any = await new Promise((resolve) => {
      aliceSocket.emit(
        'call:initiate',
        {
          conversationId: fakeConversationId,
          receiverUid: 'bob',
          callType: 'video',
        },
        resolve,
      )
    })

    assert.equal(initiateAck.ok, true)
    assert.equal(initiateAck.callId, fakeCallId)

    const incoming = await incomingPromise
    assert.equal(incoming.callId, fakeCallId)
    assert.equal(incoming.callType, 'video')
    assert.equal(incoming.caller.uid, 'alice')

    // Bob accepts call
    const acceptedForAlice = waitForEvent(aliceSocket, 'call:accepted')
    const acceptedForBob = waitForEvent(bobSocket, 'call:accepted')

    const acceptAck: any = await new Promise((resolve) => {
      bobSocket.emit('call:accept', { callId: fakeCallId }, resolve)
    })
    assert.equal(acceptAck.ok, true)

    const [aliceGotAccept, bobGotAccept] = await Promise.all([acceptedForAlice, acceptedForBob])
    assert.equal(aliceGotAccept.callId, fakeCallId)
    assert.equal(bobGotAccept.callId, fakeCallId)

    // Alice ends call
    const endedForBob = waitForEvent(bobSocket, 'call:ended')
    const endAck: any = await new Promise((resolve) => {
      aliceSocket.emit('call:end', { callId: fakeCallId }, resolve)
    })
    assert.equal(endAck.ok, true)

    const bobGotEnd = await endedForBob
    assert.equal(bobGotEnd.callId, fakeCallId)
    assert.equal(bobGotEnd.endedBy, 'alice')
  } finally {
    clients.forEach((s) => s.disconnect())
    await new Promise<void>((resolve) => io.close(() => resolve()))
    global.fetch = originalFetch
    User.findOne = originalUserFind
    User.find = originalUserFindMany
    Conversation.findById = originalConvFind
    ChatBlock.findOne = originalBlockFindOne
    ChatBlock.find = originalBlockFind
    Call.findById = originalCallFind
    Call.find = originalCallFindMany
    Call.findOne = originalCallFindOne
    Call.create = originalCallCreate
    Call.findOneAndUpdate = originalCallFindOneAndUpdate
  }
})
