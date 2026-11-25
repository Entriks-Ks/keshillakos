import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  API_ERROR_KEYS,
  API_ERROR_PATTERNS,
  API_GENERIC_ERROR_KEY,
  API_NETWORK_ERROR_KEY,
  apiErrorTranslation,
} from '../src/utils/apiErrorMessages.ts'

test('exact backend messages map to apiErrors keys', () => {
  assert.deepEqual(apiErrorTranslation('Nuk ke leje për këtë veprim'), { key: 'apiErrors.forbiddenAction' })
  assert.deepEqual(apiErrorTranslation('Email ose fjalëkalim i gabuar'), { key: 'apiErrors.wrongCredentials' })
  assert.deepEqual(apiErrorTranslation('Server error'), { key: 'apiErrors.serverError' })
  assert.deepEqual(apiErrorTranslation('profileDetails.proRequired'), { key: 'apiErrors.profileDetailsProRequired' })
  // surrounding whitespace is ignored
  assert.deepEqual(apiErrorTranslation('  Shërbimi nuk u gjet \n'), { key: 'apiErrors.serviceNotFound' })
})

test('unknown, empty and near-miss messages are not mapped', () => {
  assert.equal(apiErrorTranslation('Some brand new backend message'), null)
  assert.equal(apiErrorTranslation(''), null)
  assert.equal(apiErrorTranslation('   '), null)
  assert.equal(apiErrorTranslation('nuk ke leje për këtë veprim'), null)
  assert.equal(apiErrorTranslation('toString'), null)
  assert.equal(apiErrorTranslation('__proto__'), null)
})

test('dynamic backend messages map with interpolation params', () => {
  assert.deepEqual(apiErrorTranslation('Business ID i pavlefshëm'), { key: 'apiErrors.invalidEntityId', params: { entity: 'Business' } })
  assert.deepEqual(apiErrorTranslation('Përvoja #3: data e fillimit nuk është e vlefshme'), { key: 'apiErrors.experienceStartInvalid', params: { index: '3' } })
  assert.deepEqual(apiErrorTranslation('X / Twitter: URL i pavlefshëm'), { key: 'apiErrors.socialUrlInvalid', params: { platform: 'X / Twitter' } })
  assert.deepEqual(apiErrorTranslation('Thirrja nuk mund të pranohet (statusi: ringing)'), { key: 'apiErrors.callCannotAccept', params: { status: 'ringing' } })
  assert.deepEqual(apiErrorTranslation('Gjetëm 4 ekspertë për ty'), { key: 'apiErrors.matchFoundExperts', params: { count: 4 } })
  // a static message wins over the generic "<Entity> ID" pattern
  assert.deepEqual(apiErrorTranslation('ID i pavlefshëm'), { key: 'apiErrors.invalidId' })
  assert.equal(apiErrorTranslation('Përvoja #x: data e fillimit nuk është e vlefshme'), null)
})

test('mongoose validation wrappers resolve to the first inner message', () => {
  assert.deepEqual(
    apiErrorTranslation('UserRequest validation failed: contactPhone: Numri i telefonit është i detyrueshëm, contactEmail: Email-i është i detyrueshëm'),
    { key: 'apiErrors.phoneRequired' },
  )
  assert.deepEqual(apiErrorTranslation('Business validation failed: contactEmail: Invalid email'), { key: 'apiErrors.invalidEmailEn' })
  assert.equal(apiErrorTranslation('Category validation failed: name.sq: Path `name.sq` is required.'), null)
})

test('every mapped key lives in the apiErrors namespace and is camelCase', () => {
  const keys = [
    ...Object.values(API_ERROR_KEYS),
    ...API_ERROR_PATTERNS.map((p) => p.key),
    API_NETWORK_ERROR_KEY,
    API_GENERIC_ERROR_KEY,
  ]
  for (const key of keys) assert.match(key, /^apiErrors\.[a-z][A-Za-z0-9]*$/, key)
  // distinct messages never collapse onto one key, so each keeps its own wording
  const staticKeys = Object.values(API_ERROR_KEYS)
  assert.equal(new Set(staticKeys).size, staticKeys.length)
})

test('static messages are never shadowed by a pattern', () => {
  for (const message of Object.keys(API_ERROR_KEYS)) {
    for (const { pattern } of API_ERROR_PATTERNS) assert.equal(pattern.test(message), false, `${message} matches ${pattern}`)
  }
})
