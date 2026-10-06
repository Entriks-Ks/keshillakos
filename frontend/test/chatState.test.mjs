import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeMessages, updateConversationList, mergeConversationSnapshots, nearHistoryBottom, prependedScrollTop } from '../src/chat/chatState.ts'

const message = (id, seconds = 1) => ({ id, conversationId: 'open', senderUid: 'alice', body: id, createdAt: `2026-10-06T12:00:${String(seconds).padStart(2, '0')}.000Z` })
const conversation = (id) => ({ id, seekerUid: 'bob', providerUid: 'alice', unread: 0, peer: { uid: 'alice', name: 'Alice' }, createdAt: '2026-10-06T00:00:00Z' })
const event = (id = 'open') => ({ conversationId: id, senderUid: 'alice', lastMessagePreview: 'Hello', lastMessageAt: '2026-10-06T12:00:01Z' })

test('an incoming message appends immediately and preserves existing message object identities', () => {
  const existing = message('first', 0), incoming = message('second')
  const result = mergeMessages([existing], [incoming])
  assert.deepEqual(result.map(m => m.id), ['first', 'second'])
  assert.equal(result[0], existing)
  assert.equal(result[1], incoming)
})

test('real-time conversation updates preserve row ordering and unrelated object references', () => {
  const rows = [conversation('another'), conversation('open')]
  const result = updateConversationList(rows, event(), 'bob', 'open', true)
  assert.deepEqual(result.map(c => c.id), ['another', 'open'])
  assert.equal(result[0], rows[0])
  assert.equal(result[1].lastMessagePreview, 'Hello')
  assert.equal(result[1].unread, 0, 'the visible conversation remains read')
})

test('another/hidden conversation increments only its own unread count, while sender echoes do not', () => {
  const rows = [conversation('another'), conversation('open')]
  const result = updateConversationList(rows, event('another'), 'bob', 'open', true)
  assert.equal(result[0].unread, 1)
  assert.equal(result[1], rows[1])
  assert.equal(updateConversationList(rows, event(), 'bob', 'open', false)[1].unread, 1)
  assert.equal(updateConversationList(rows, event(), 'alice', 'open', false)[1].unread, 0)
})

test('socket echoes/reconnect snapshots do not duplicate messages or unread increments', () => {
  const current = [message('one')]
  assert.equal(mergeMessages(current, [message('one')]), current)
  assert.deepEqual(mergeMessages(current, [message('one'), message('two', 2), message('two', 2)]).map(m => m.id), ['one', 'two'])
  const rows = updateConversationList([conversation('open')], event(), 'bob', 'another', true)
  assert.equal(updateConversationList(rows, event(), 'bob', 'another', true), rows)
  assert.equal(rows[0].unread, 1)
})

test('reconnecting retains previously loaded history and silently reconciles stable rows', () => {
  const history = [message('old', 0), message('existing')]
  const result = mergeMessages(history, [message('existing'), message('missed', 2)])
  assert.equal(result[0], history[0])
  assert.deepEqual(result.map(m => m.id), ['old', 'existing', 'missed'])
  const rows = [conversation('open'), conversation('another')]
  const updated = mergeConversationSnapshots(rows, [{ ...rows[1], unread: 2 }, { ...rows[0] }])
  assert.deepEqual(updated.map(c => c.id), ['open', 'another'])
  assert.equal(updated[0], rows[0])
  assert.equal(mergeConversationSnapshots(rows, rows.map(row => ({ ...row }))), rows)
})

test('scroll only follows messages near the bottom and older history preserves the reading anchor', () => {
  assert.equal(nearHistoryBottom(520, 1000, 400), true)
  assert.equal(nearHistoryBottom(100, 1000, 400), false)
  assert.equal(prependedScrollTop(120, 1000, 1400), 520)
})

test('late older conversation events cannot roll back the current preview or unread state', () => {
  const rows = updateConversationList([conversation('open')], { ...event(), lastMessageAt: '2026-10-06T12:00:02Z' }, 'bob', 'another', true)
  assert.equal(updateConversationList(rows, event(), 'bob', 'another', true), rows)
})
