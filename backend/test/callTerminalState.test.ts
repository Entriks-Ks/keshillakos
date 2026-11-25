import { test } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { Call } from '../src/models/Call'
import { acceptCall, rejectCall, endCall } from '../src/services/callService'

/** In-memory Call model double whose findOneAndUpdate is a real compare-and-set on `status`. */
function withMockCall(initial: Record<string, unknown>, run: (call: any, id: string) => Promise<void>) {
  const id = new mongoose.Types.ObjectId().toString()
  const call: any = {
    _id: id,
    callerId: 'alice',
    receiverId: 'bob',
    conversationId: new mongoose.Types.ObjectId(),
    roomName: `call_${id}`,
    callType: 'audio',
    startedAt: new Date(Date.now() - 30_000),
    answeredAt: null,
    endedAt: null,
    duration: 0,
    hasLoggedChat: true, // skip chat logging side effects in unit tests
    save: async function () { return this },
    ...initial,
  }
  const orig = { findById: Call.findById, findOneAndUpdate: Call.findOneAndUpdate }
  let writes = 0
  Call.findById = (async (value: any) => (String(value) === id ? call : null)) as any
  Call.findOneAndUpdate = (async (filter: any, update: any) => {
    if (String(filter._id) !== id || call.status !== filter.status) return null
    writes++
    Object.assign(call, update.$set)
    return call
  }) as any
  return run(call, id)
    .then(() => writes)
    .finally(() => {
      Call.findById = orig.findById
      Call.findOneAndUpdate = orig.findOneAndUpdate
    })
}

test('repeated hang-up preserves the first terminal outcome and duration', async () => {
  await withMockCall({ status: 'accepted', answeredAt: new Date(Date.now() - 42_000) }, async (call, id) => {
    const first = await endCall(id, 'alice')
    assert.equal(first.changed, true)
    assert.equal(call.status, 'completed')
    const endedAt = call.endedAt
    const duration = call.duration

    const second = await endCall(id, 'bob')
    assert.equal(second.changed, false)
    assert.equal(call.status, 'completed')
    assert.equal(call.endedAt, endedAt)
    assert.equal(call.duration, duration)
  })
})

test('late rejection never overwrites a completed call', async () => {
  await withMockCall({ status: 'completed', duration: 77, endedAt: new Date() }, async (call, id) => {
    const result = await rejectCall(id, 'bob')
    assert.equal(result.changed, false)
    assert.equal(call.status, 'completed')
    assert.equal(call.duration, 77)
  })
})

test('duplicate rejection is harmless and keeps busy vs rejected outcome', async () => {
  await withMockCall({ status: 'ringing' }, async (call, id) => {
    assert.equal((await rejectCall(id, 'bob', 'busy')).changed, true)
    assert.equal(call.status, 'busy')
    assert.equal((await rejectCall(id, 'bob')).changed, false)
    assert.equal(call.status, 'busy')
  })
})

test('caller cancel while ringing records missed; accept afterwards is refused', async () => {
  await withMockCall({ status: 'ringing' }, async (call, id) => {
    const ended = await endCall(id, 'alice')
    assert.equal(ended.changed, true)
    assert.equal(call.status, 'missed')
    await assert.rejects(() => acceptCall(id, 'bob'), /përfunduar|mbaruar|mbyll/)
    assert.equal(call.status, 'missed')
  })
})

test('accept loses atomically to a concurrent cancel', async () => {
  await withMockCall({ status: 'ringing' }, async (call, id) => {
    const origFindById = Call.findById
    // Simulate: accept reads "ringing", then the caller cancels before accept writes.
    let reads = 0
    Call.findById = (async (value: any) => {
      reads++
      const result = await (origFindById as any)(value)
      if (reads === 1) {
        const snapshot = { ...result }
        await endCall(id, 'alice')
        return snapshot
      }
      return result
    }) as any
    try {
      await assert.rejects(() => acceptCall(id, 'bob'))
    } finally {
      Call.findById = origFindById
    }
    assert.equal(call.status, 'missed')
    assert.equal(call.answeredAt, null)
  })
})

test('end racing with accept completes the accepted call instead of failing', async () => {
  await withMockCall({ status: 'ringing' }, async (call, id) => {
    const origUpdate = Call.findOneAndUpdate
    let first = true
    Call.findOneAndUpdate = (async (filter: any, update: any) => {
      if (first) {
        first = false
        // The receiver accepts between endCall's read and its write.
        call.status = 'accepted'
        call.answeredAt = new Date(Date.now() - 5_000)
      }
      return (origUpdate as any)(filter, update)
    }) as any
    try {
      const result = await endCall(id, 'alice')
      assert.equal(result.changed, true)
    } finally {
      Call.findOneAndUpdate = origUpdate
    }
    assert.equal(call.status, 'completed')
    assert.ok(call.duration >= 4)
  })
})
