import { test } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { generateLivekitToken } from '../src/services/livekitService'
import { Call } from '../src/models/Call'
import { Conversation } from '../src/models/Conversation'
import {
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,
  getActiveCallForUser,
} from '../src/services/callService'

test('LiveKit token generation creates a valid token with room grants', async () => {
  process.env.LIVEKIT_API_KEY = 'test_api_key'
  process.env.LIVEKIT_API_SECRET = 'test_api_secret_must_be_long_enough_12345678'
  process.env.LIVEKIT_URL = 'wss://test.livekit.cloud'

  const token = await generateLivekitToken({
    roomName: 'test-room-1',
    identity: 'user-alice-123',
    name: 'Alice Smith',
  })

  assert.ok(typeof token === 'string' && token.length > 20)

  // Decode JWT payload without external library
  const parts = token.split('.')
  assert.equal(parts.length, 3)
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'))

  assert.equal(payload.sub, 'user-alice-123')
  assert.equal(payload.name, 'Alice Smith')
  assert.equal(payload.iss, 'test_api_key')
  assert.equal(payload.video.room, 'test-room-1')
  assert.equal(payload.video.roomJoin, true)
})

test('Call initiation validates participants and prevents self-calling', async () => {
  await assert.rejects(
    async () => {
      await initiateCall({
        callerUid: 'alice',
        receiverUid: 'alice',
        conversationId: new mongoose.Types.ObjectId().toString(),
        callType: 'video',
      })
    },
    { message: 'Nuk mund të thërrasësh veten' },
  )
})

test('Call model validates status transitions and computes duration', async () => {
  const origFindById = Call.findById
  const origFindOne = Call.findOne
  const origCreate = Call.create
  const origFindOneAndUpdate = Call.findOneAndUpdate

  try {
    const fakeCallId = new mongoose.Types.ObjectId().toString()
    const fakeConversationId = new mongoose.Types.ObjectId()

    const mockCallData: any = {
      _id: fakeCallId,
      callerId: 'alice',
      receiverId: 'bob',
      conversationId: fakeConversationId,
      roomName: `call_${fakeConversationId}_test`,
      callType: 'video',
      status: 'ringing',
      startedAt: new Date(Date.now() - 65_000),
      answeredAt: null,
      endedAt: null,
      duration: 0,
      save: async function () {
        return this
      },
    }

    Call.findById = (async (id: any) => {
      if (id.toString() === fakeCallId) return mockCallData
      return null
    }) as any

    Call.findOne = (async () => null) as any
    Call.findOneAndUpdate = (async (filter: any, update: any) => {
      if (String(filter._id) === fakeCallId && mockCallData.status === filter.status) {
        Object.assign(mockCallData, update.$set)
        return mockCallData
      }
      return null
    }) as any

    // 1. Accept call
    const accepted = await acceptCall(fakeCallId, 'bob')
    assert.equal(accepted.status, 'accepted')
    assert.ok(accepted.answeredAt)

    // Simulate answered 60 seconds ago
    mockCallData.answeredAt = new Date(Date.now() - 60_000)

    // 2. End call
    const ended = await endCall(fakeCallId, 'alice')
    assert.equal(ended.call.status, 'completed')
    assert.ok(ended.duration >= 59 && ended.duration <= 62)
    assert.ok(ended.call.endedAt)
  } finally {
    Call.findById = origFindById
    Call.findOne = origFindOne
    Call.create = origCreate
    Call.findOneAndUpdate = origFindOneAndUpdate
  }
})

test('Call rejects unauthorized acceptance', async () => {
  const origFindById = Call.findById
  try {
    const fakeCallId = new mongoose.Types.ObjectId().toString()
    const mockCallData: any = {
      _id: fakeCallId,
      callerId: 'alice',
      receiverId: 'bob',
      status: 'ringing',
      save: async () => mockCallData,
    }

    Call.findById = (async () => mockCallData) as any

    // Eve tries to accept Alice's call to Bob
    await assert.rejects(
      async () => {
        await acceptCall(fakeCallId, 'eve')
      },
      { message: 'Vetëm marrësi mund të pranojë thirrjen' },
    )
  } finally {
    Call.findById = origFindById
  }
})

test('logCallToChat handles completed and missed call messages properly without throwing', async () => {
  const { logCallToChat } = await import('../src/services/callService')
  const fakeConversationId = new mongoose.Types.ObjectId()

  const completedCall: any = {
    _id: new mongoose.Types.ObjectId(),
    callerId: 'alice',
    receiverId: 'bob',
    conversationId: fakeConversationId,
    callType: 'video',
    status: 'completed',
    duration: 125,
    save: async () => completedCall,
  }

  await logCallToChat(completedCall)
  assert.equal(completedCall.hasLoggedChat, true)

  const missedCall: any = {
    _id: new mongoose.Types.ObjectId(),
    callerId: 'alice',
    receiverId: 'bob',
    conversationId: fakeConversationId,
    callType: 'audio',
    status: 'missed',
    duration: 0,
    save: async () => missedCall,
  }

  await logCallToChat(missedCall)
  assert.equal(missedCall.hasLoggedChat, true)
})
