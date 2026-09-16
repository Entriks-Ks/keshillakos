import assert from 'node:assert/strict'
import test from 'node:test'
import { User, userSchema } from '../src/models/User'
import { effectiveRoles, toPublicUser } from '../src/services/userService'

test('new account normalizes identity and leaves professional fields unset', async () => {
  const user = new User({ uid: 'firebase-1', email: ' Person@Example.COM ', name: ' Ada Lovelace ', phone: '  ', country: ' xk ' })
  await user.validate()
  assert.equal(user.email, 'person@example.com')
  assert.equal(user.phone, undefined)
  assert.equal(user.country, 'XK')
  assert.equal(user.headline, undefined)
  assert.equal(user.skills, undefined)
  assert.equal(user.languages, undefined)
  assert.equal(user.accountStatus, 'active')
  assert.equal(user.privacy?.profileVisibility, 'private')
})

test('invalid contact values and empty identity fail validation', async () => {
  const user = new User({ uid: 'firebase-2', email: 'invalid', name: ' ', phone: '1234' })
  await assert.rejects(user.validate(), /email|name|phone/)
})

test('legacy self-selected provider/company roles do not authorize; explicit grants combine', () => {
  assert.deepEqual(effectiveRoles({ role: 'provider' }), ['user'])
  assert.deepEqual(effectiveRoles({ role: 'company' }), ['user'])
  assert.deepEqual(effectiveRoles({ role: 'admin' }), ['user', 'admin'])
  assert.deepEqual(effectiveRoles({ role: 'admin', roles: [] }), ['user'])
  assert.deepEqual(effectiveRoles({ role: 'provider', roles: ['provider', 'company'] }), ['user', 'provider', 'company'])
  const legacy = toPublicUser({ uid: 'legacy', email: 'a@example.com', name: 'A', role: 'provider' })
  assert.deepEqual(legacy.roles, ['user'])
  assert.equal(legacy.role, 'user')
  const requested = toPublicUser({ uid: 'requested', email: 'r@example.com', name: 'R', role: 'user', roles: ['user'], requestedRole: 'company' })
  assert.deepEqual(requested.roles, ['user'])
  assert.equal(requested.role, 'user')
})

test('user indexes distinguish canonical email from nonunique unverified phone', () => {
  const indexes = userSchema.indexes()
  assert.ok(indexes.some(([keys, options]) => keys.uid === 1 && options.unique))
  assert.ok(indexes.some(([keys, options]) => keys.email === 1 && options.unique))
  assert.ok(indexes.some(([keys, options]) => keys.phone === 1 && !options.unique))
})
