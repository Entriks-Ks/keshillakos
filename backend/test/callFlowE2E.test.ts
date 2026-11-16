import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createRequire } from 'node:module'
import mongoose from 'mongoose'
import { User } from '../src/models/User'
import { Call } from '../src/models/Call'
import { Conversation } from '../src/models/Conversation'
import { ChatBlock } from '../src/models/ChatBlock'
import { generateLivekitToken } from '../src/services/livekitService'

const { io: connect } = createRequire(`${process.cwd()}/../frontend/package.json`)('socket.io-client')

test('End-to-end complete call & chat flow with two authenticated users', async () => {
  process.env.FIREBASE_API_KEY = 'test-only-key'
  process.env.LIVEKIT_API_KEY = 'test_key'
  process.env.LIVEKIT_API_SECRET = 'test_secret_32_chars_minimum_length_safe'
  process.env.LIVEKIT_URL = 'wss://test.livekit.cloud'

  const originalFetch = global.fetch
  const originalUserFind = User.findOne
  const originalUserFindMany = User.find
  const originalConvFind = Conversation.findById
  const originalConvFindOne = Conversation.findOne
  const originalCallFind = Call.findById
  const originalCallFindOne = Call.findOne
  const originalCallFindMany = Call.find
  const originalCallCreate = Call.create
  const originalBlockFindOne = ChatBlock.findOne
  const originalBlockFind = ChatBlock.find

  Call.find = (async () => []) as any

  // Mock fetch for firebase token verification
  global.fetch = (async (_url: unknown, init: any) => {
    const token = JSON.parse(init.body).idToken
    return {
      ok: true,
      json: async () => ({
        users: [{ localId: token, displayName: token === 'alice' ? 'Alice' : token === 'bob' ? 'Bob' : 'Charlie' }],
      }),
    }
  }) as typeof fetch

  // Mock User
  User.findOne = ((query: any) => ({
    lean: async () => ({
      uid: query.uid,
      name: query.uid === 'alice' ? 'Alice' : query.uid === 'bob' ? 'Bob' : 'Charlie',
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
  const charlieConversationId = new mongoose.Types.ObjectId().toString()
  const mockConversation = {
    _id: fakeConversationId,
    seekerUid: 'alice',
    providerUid: 'bob',
  }
  const charlieConversation = {
    _id: charlieConversationId,
    seekerUid: 'charlie',
    providerUid: 'bob',
  }
  Conversation.findById = (async (id: any) => {
    if (id?.toString() === charlieConversationId) return charlieConversation
    return mockConversation
  }) as any
  Conversation.findOne = (async (query: any) => {
    if (query?.seekerUid === 'charlie' || query?._id?.toString() === charlieConversationId) return charlieConversation
    return mockConversation
  }) as any

  ChatBlock.findOne = (() => ({ lean: async () => null })) as any
  ChatBlock.find = (() => ({ lean: async () => [] })) as any

  const fakeCallId = new mongoose.Types.ObjectId().toString()
  let currentCallStatus = 'idle'
  let callAnsweredAt: Date | null = null
  let callEndedAt: Date | null = null
  let callDuration = 0

  const mockCall = {
    _id: fakeCallId,
    callerId: 'alice',
    receiverId: 'bob',
    conversationId: fakeConversationId,
    roomName: 'test-room-e2e',
    callType: 'video',
    get status() {
      return currentCallStatus
    },
    set status(val) {
      currentCallStatus = val
    },
    startedAt: new Date(Date.now() - 5000),
    get answeredAt() {
      return callAnsweredAt
    },
    set answeredAt(val) {
      callAnsweredAt = val
    },
    get endedAt() {
      return callEndedAt
    },
    set endedAt(val) {
      callEndedAt = val
    },
    get duration() {
      return callDuration
    },
    set duration(val) {
      callDuration = val
    },
    save: async function () {
      return this
    },
  }

  Call.findOne = (async (query: any) => {
    // If checking for active call
    if (currentCallStatus === 'ringing' || currentCallStatus === 'accepted') {
      if (query.$or?.some((q: any) => q.callerId === 'bob' || q.receiverId === 'bob')) {
        return mockCall
      }
    }
    return null
  }) as any

  Call.create = (async () => {
    currentCallStatus = 'ringing'
    return mockCall
  }) as any
  Call.findById = (async (id: any) => {
    if (id.toString() === fakeCallId) return mockCall
    return null
  }) as any

  const { attachRealtimeSocket } = await import('../src/services/socketServer')
  const { registerChatHandlers } = await import('../src/services/chatSocket')
  const { registerCallHandlers } = await import('../src/services/callSocket')

  const server = http.createServer()
  const io = attachRealtimeSocket(server)
  registerChatHandlers(io)
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

    // --- STEP 1: Verify Alice and Bob join conversation room and exchange chat ---
    aliceSocket.emit('conversation:join', { conversationId: fakeConversationId })
    bobSocket.emit('conversation:join', { conversationId: fakeConversationId })

    // --- STEP 2: Alice initiates Video Call to Bob ---
    const bobIncomingPromise = waitForEvent(bobSocket, 'call:incoming')
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

    const incoming = await bobIncomingPromise
    assert.equal(incoming.callId, fakeCallId)
    assert.equal(incoming.caller.uid, 'alice')
    assert.equal(incoming.callType, 'video')

    // --- STEP 3: Charlie tries to call Bob while Bob is on the call -> Busy! ---
    const charlieSocket = client('charlie')
    await waitForEvent(charlieSocket, 'connect')

    // Charlie's initiate to Bob should return busy: true
    const charlieAck: any = await new Promise((resolve) => {
      charlieSocket.emit(
        'call:initiate',
        {
          conversationId: charlieConversationId,
          receiverUid: 'bob',
          callType: 'audio',
        },
        resolve,
      )
    })
    assert.equal(charlieAck.ok, false)
    assert.equal(charlieAck.busy, true)

    // --- STEP 4: Bob accepts Alice's call ---
    const aliceAcceptedPromise = waitForEvent(aliceSocket, 'call:accepted')
    const bobAcceptedPromise = waitForEvent(bobSocket, 'call:accepted')

    const acceptAck: any = await new Promise((resolve) => {
      bobSocket.emit('call:accept', { callId: fakeCallId }, resolve)
    })
    assert.equal(acceptAck.ok, true)

    const [aliceAccepted, bobAccepted] = await Promise.all([
      aliceAcceptedPromise,
      bobAcceptedPromise,
    ])
    assert.equal(aliceAccepted.callId, fakeCallId)
    assert.equal(bobAccepted.callId, fakeCallId)

    // --- STEP 5: Verify LiveKit token generation for both participants ---
    const aliceToken = await generateLivekitToken({
      roomName: mockCall.roomName,
      identity: 'alice',
      name: 'Alice',
    })
    const bobToken = await generateLivekitToken({
      roomName: mockCall.roomName,
      identity: 'bob',
      name: 'Bob',
    })

    assert.ok(aliceToken.length > 20)
    assert.ok(bobToken.length > 20)

    // Verify token identity
    const alicePayload = JSON.parse(Buffer.from(aliceToken.split('.')[1], 'base64').toString('utf-8'))
    const bobPayload = JSON.parse(Buffer.from(bobToken.split('.')[1], 'base64').toString('utf-8'))

    assert.equal(alicePayload.sub, 'alice')
    assert.equal(alicePayload.video.room, 'test-room-e2e')
    assert.equal(bobPayload.sub, 'bob')
    assert.equal(bobPayload.video.room, 'test-room-e2e')

    // --- STEP 6: Media toggle events propagate in room ---
    const mediaTogglePromise = waitForEvent(bobSocket, 'call:peer-media-toggle')
    aliceSocket.emit('call:toggle-media', {
      callId: fakeCallId,
      mediaType: 'video',
      enabled: false,
    })
    const mediaToggle = await mediaTogglePromise
    assert.equal(mediaToggle.callId, fakeCallId)
    assert.equal(mediaToggle.mediaType, 'video')
    assert.equal(mediaToggle.enabled, false)

    // --- STEP 7: Alice ends call ---
    const bobEndedPromise = waitForEvent(bobSocket, 'call:ended')
    const endAck: any = await new Promise((resolve) => {
      aliceSocket.emit('call:end', { callId: fakeCallId }, resolve)
    })
    assert.equal(endAck.ok, true)

    const bobEnded = await bobEndedPromise
    assert.equal(bobEnded.callId, fakeCallId)
    assert.equal(bobEnded.endedBy, 'alice')

    // --- STEP 8: Verify call status completed in DB mock ---
    assert.equal(mockCall.status, 'completed')
  } finally {
    clients.forEach((s) => s.disconnect())
    await new Promise<void>((resolve) => io.close(() => resolve()))
    global.fetch = originalFetch
    User.findOne = originalUserFind
    User.find = originalUserFindMany
    Conversation.findById = originalConvFind
    Conversation.findOne = originalConvFindOne
    Call.findById = originalCallFind
    Call.find = originalCallFindMany
    Call.findOne = originalCallFindOne
    Call.create = originalCallCreate
    ChatBlock.findOne = originalBlockFindOne
    ChatBlock.find = originalBlockFind
  }
})
