import test from 'node:test'
import assert from 'node:assert/strict'
import { createNotificationStore } from '../src/notifications/notificationStore.ts'
import en from '../src/i18n/locales/en.ts'
import de from '../src/i18n/locales/de.ts'
import sq from '../src/i18n/locales/sq.ts'
const item = { id: 'old', type: 'request:new', title: 'Request', body: '', href: '/dashboard', readAt: null, createdAt: '2026-10-19' }
const page = (notifications = [item]) => ({ notifications, unreadCount: notifications.filter(n => !n.readAt).length, page: 1, hasMore: false })
const tick = () => new Promise(resolve => setImmediate(resolve))

test('clear persists first, prevents duplicates, and immediately publishes empty history and badge zero', async () => {
  let finish, total = [item], calls = 0
  const store = createNotificationStore({ list: async () => page(total), read: async () => ({ unreadCount: 0 }), clear: () => { calls++; return new Promise(resolve => { finish = resolve }) } })
  const snapshots = []
  store.subscribe(() => snapshots.push(store.snapshot()))
  await store.load()
  const clearing = store.clear()
  assert.equal(store.snapshot().notifications.length, 1)
  assert.equal(await store.clear(), false)
  assert.equal(await store.read(), false)
  total = []; finish({ unreadCount: 0 }); assert.equal(await clearing, true)
  assert.ok(snapshots.some(s => !s.notifications.length && s.unreadCount === 0 && !s.hasMore))
  await tick()
  assert.equal(store.snapshot().notifications.length, 0)
  assert.equal(calls, 1)
})

test('failed or malformed deletion never clears history and reports a translated error key', async () => {
  for (const clear of [async () => { throw Error('403') }, async () => ({}), async () => ({ unreadCount: -1 })]) {
    const store = createNotificationStore({ list: async () => page(), clear, read: async () => ({ unreadCount: 0 }) })
    await store.load()
    assert.equal(await store.clear(), false)
    assert.equal(store.snapshot().notifications.length, 1)
    assert.equal(store.snapshot().unreadCount, 1)
    assert.equal(store.snapshot().error, 'notifications.clear.error')
    assert.equal(store.snapshot().reading, null)
  }
})

test('a live event during clear is reconciled and stale HTTP history cannot restore deleted rows', async () => {
  let finish, history = [item]
  const store = createNotificationStore({ list: async () => page(history), read: async () => ({ unreadCount: 0 }), clear: () => new Promise(resolve => { finish = resolve }) })
  await store.load()
  const clearing = store.clear()
  history = [{ ...item, id: 'new' }]
  await store.load()
  finish({ unreadCount: 1 }); await clearing; await tick()
  assert.equal(store.snapshot().notifications[0].id, 'new')
  assert.equal(store.snapshot().unreadCount, 1)
  const pending = []
  const other = createNotificationStore({ list: () => new Promise(resolve => pending.push(resolve)), clear: async () => ({ unreadCount: 0 }), read: async () => ({ unreadCount: 0 }) })
  const loading = other.load(); await other.load(); pending.shift()(page())
  await tick(); pending.shift()(page([])); await loading
  assert.equal(other.snapshot().notifications.length, 0)
})

test('mark all as read preserves notification history', async () => {
  const store = createNotificationStore({ list: async () => page(), read: async () => ({ unreadCount: 0 }), clear: async () => { throw Error('must not delete') } })
  await store.load(); assert.equal(await store.read(), true)
  assert.equal(store.snapshot().notifications.length, 1)
  assert.ok(store.snapshot().notifications[0].readAt)
  assert.equal(store.snapshot().unreadCount, 0)
})

test('all notification UI messages exist in every web locale', () => {
  function keys(obj, prefix = '') { return Object.entries(obj).flatMap(([k,v]) => typeof v === 'string' ? [[prefix+k,v]] : keys(v,prefix+k+'.')) }
  const expected = keys(en.notifications).map(([k]) => k)
  for (const locale of [sq,de,en]) {
    assert.deepEqual(keys(locale.notifications).map(([k]) => k), expected)
    assert.ok(keys(locale.notifications).every(([,v]) => v.trim()))
  }
})
