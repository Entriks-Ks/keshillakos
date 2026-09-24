import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeFeedbackInput } from '../src/services/platformFeedbackService'

test('platform feedback requires a message and an email', () => {
  assert.throws(() => normalizeFeedbackInput({ message: 'ok', email: 'ana@example.com' }), /5 karaktere/)
  assert.throws(() => normalizeFeedbackInput({ message: 'Kjo është një feedback' }), /Email-i është i nevojshëm/)
  assert.throws(
    () => normalizeFeedbackInput({ message: 'Kjo është një feedback', email: 'jo-email' }),
    /nuk është i vlefshëm/,
  )
})

test('platform feedback keeps the signed-in user when the form omits contact fields', () => {
  const item = normalizeFeedbackInput({
    message: '  Platforma është e qartë.  ',
    userUid: 'uid-1',
    userName: 'Ana',
    userEmail: 'Ana@Example.com',
  })
  assert.equal(item.message, 'Platforma është e qartë.')
  assert.equal(item.name, 'Ana')
  assert.equal(item.email, 'ana@example.com')
  assert.equal(item.userUid, 'uid-1')
})
