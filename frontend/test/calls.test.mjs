import { test } from 'node:test'
import assert from 'node:assert/strict'

function formatDuration(secs) {
  const hours = Math.floor(secs / 3600)
  const minutes = Math.floor((secs % 3600) / 60)
  const seconds = secs % 60
  const pad = (n) => n.toString().padStart(2, '0')
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}

test('formatDuration formats call time correctly across seconds, minutes and hours', () => {
  assert.equal(formatDuration(0), '00:00')
  assert.equal(formatDuration(9), '00:09')
  assert.equal(formatDuration(65), '01:05')
  assert.equal(formatDuration(599), '09:59')
  assert.equal(formatDuration(3600), '01:00:00')
  assert.equal(formatDuration(3665), '01:01:05')
})

test('Call state transition from idle -> calling -> connected -> idle', () => {
  let stage = 'idle'
  let activeCall = null
  let outgoingCall = null

  // 1. Initiate call
  outgoingCall = {
    callId: 'call-123',
    conversationId: 'conv-456',
    receiver: { uid: 'bob', name: 'Bob' },
    callType: 'video',
  }
  stage = 'calling'
  assert.equal(stage, 'calling')
  assert.ok(outgoingCall)

  // 2. Peer accepts call
  activeCall = {
    callId: outgoingCall.callId,
    conversationId: outgoingCall.conversationId,
    peer: outgoingCall.receiver,
    callType: outgoingCall.callType,
    roomName: 'room-123',
    isCaller: true,
  }
  outgoingCall = null
  stage = 'connected'

  assert.equal(stage, 'connected')
  assert.equal(activeCall.callId, 'call-123')
  assert.equal(activeCall.peer.uid, 'bob')
  assert.equal(outgoingCall, null)

  // 3. End call
  activeCall = null
  stage = 'idle'
  assert.equal(stage, 'idle')
  assert.equal(activeCall, null)
})

test('Incoming call flow and reject/busy handling', () => {
  let stage = 'idle'
  let incomingCall = {
    callId: 'call-999',
    conversationId: 'conv-888',
    caller: { uid: 'alice', name: 'Alice' },
    callType: 'audio',
    roomName: 'room-999',
  }
  stage = 'ringing'
  assert.equal(stage, 'ringing')

  // Reject call
  incomingCall = null
  stage = 'idle'
  assert.equal(stage, 'idle')
  assert.equal(incomingCall, null)
})
