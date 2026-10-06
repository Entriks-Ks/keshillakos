import test from 'node:test'
import assert from 'node:assert/strict'
import { mergePresence, presenceLabel } from '../src/chat/useChatPresence.ts'

test('presence patches preserve unrelated contacts and duplicate events retain state identity', () => {
  const alice = { uid: 'alice', online: true }, bob = { uid: 'bob', online: false }
  const current = new Map([['alice', alice], ['bob', bob]])
  assert.equal(mergePresence(current, alice), current)
  const next = mergePresence(current, { uid: 'bob', online: true })
  assert.equal(next.get('alice'), alice)
  assert.equal(next.get('bob').online, true)
  assert.equal(current.get('bob'), bob)
})
test('presence labels never infer online from missing data and show last seen only when offline', () => {
  assert.equal(presenceLabel(), '')
  assert.equal(presenceLabel({ uid: 'internal', online: false }), 'Offline')
  assert.equal(presenceLabel({ uid: 'internal', online: true, lastSeen: new Date().toISOString() }), 'Online')
  assert.match(presenceLabel({ uid: 'internal', online: false, lastSeen: '2026-10-06T10:00:00Z' }), /^Aktiviteti i fundit:/)
})
