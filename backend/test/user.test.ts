import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import { City } from '../src/models/City'
import { Country } from '../src/models/Country'
import { User, userSchema } from '../src/models/User'
import { effectiveRoles, toPublicUser, updateOwnProfile } from '../src/services/userService'

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

test('saved customer location requires both referenced IDs and is returned by the user mapper', async () => {
  const countryId = new Types.ObjectId()
  const cityId = new Types.ObjectId()
  const user = new User({ uid: 'located', email: 'located@example.com', name: 'Located User', location: { countryId, cityId } })
  await user.validate()
  assert.deepEqual(toPublicUser(user).savedLocation, { countryId: String(countryId), cityId: String(cityId) })
  assert.equal(toPublicUser(user).location, '')
  assert.equal(toPublicUser({ uid: 'legacy-location', email: 'legacy@example.com', name: 'Legacy', location: 'Prishtinë' }).location, 'Prishtinë')
  const legacy = User.hydrate({ uid: 'old', email: 'old@example.com', name: 'Old', location: 'Prishtinë' })
  await legacy.validate()
  assert.equal(toPublicUser(legacy).location, 'Prishtinë')
  await assert.rejects(new User({ uid: 'incomplete', email: 'incomplete@example.com', name: 'Incomplete', location: { countryId } }).validate(), /cityId/)
})

test('profile location update checks active country/city relation and allows clearing', async () => {
  const countryId = new Types.ObjectId()
  const cityId = new Types.ObjectId()
  const user = new User({ uid: 'located', email: 'located@example.com', name: 'Located User' })
  const originalFind = User.findOne
  const originalCountryExists = Country.exists
  const originalCityExists = City.exists
  const originalSave = user.save
  let saves = 0
  User.findOne = (() => Promise.resolve(user)) as unknown as typeof User.findOne
  Country.exists = (() => Promise.resolve({ _id: countryId })) as unknown as typeof Country.exists
  City.exists = ((query: { countryId: Types.ObjectId }) => Promise.resolve(String(query.countryId) === String(countryId) ? { _id: cityId } : null)) as unknown as typeof City.exists
  user.save = (async () => { saves += 1; return user }) as typeof user.save
  try {
    const saved = await updateOwnProfile('located', { savedLocation: { countryId: String(countryId), cityId: String(cityId) } })
    assert.deepEqual(saved.savedLocation, { countryId: String(countryId), cityId: String(cityId) })
    assert.equal(saves, 1)
    await assert.rejects(updateOwnProfile('located', { savedLocation: { countryId: 'invalid', cityId: String(cityId) } }), /Lokacioni/)
    City.exists = (() => Promise.resolve(null)) as unknown as typeof City.exists
    await assert.rejects(updateOwnProfile('located', { savedLocation: { countryId: String(countryId), cityId: String(cityId) } }), /nuk përputhen/)
    assert.equal(saves, 1)
    const cleared = await updateOwnProfile('located', { savedLocation: null })
    assert.equal(cleared.savedLocation, undefined)
    assert.equal(saves, 2)
  } finally {
    User.findOne = originalFind
    Country.exists = originalCountryExists
    City.exists = originalCityExists
    user.save = originalSave
  }
})
