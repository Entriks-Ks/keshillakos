import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Types } from 'mongoose'
import { UserRequest } from '../src/models/UserRequest'
import { RequestDelivery, requestDeliverySchema } from '../src/models/RequestDelivery'
import { canSeeDelivery } from '../src/services/userRequestService'

test('UserRequest supports a provider-free draft and validates budget and identity references', async () => {
  const request = new UserRequest({
    user: new Types.ObjectId(), category: new Types.ObjectId(), portal: 'keshillakos',
    problem: 'Need translation', description: 'I need a document translated.',
    contactPreference: 'email', contactEmail: 'ada@example.com', contactPhone: '044111222', status: 'draft',
    budget: { min: 50, max: 100, currency: 'EUR' },
  })
  await request.validate()
  assert.equal(request.status, 'draft')
  assert.equal(request.contactEmail, 'ada@example.com')
  assert.equal(request.toObject().providerProfile, undefined)
  request.budget = { min: 100, max: 50, currency: 'EUR' }
  await assert.rejects(request.validate(), /Maximum budget/)
})

test('phone number is always required and email contact also requires an email', async () => {
  const chat = new UserRequest({
    user: new Types.ObjectId(), category: new Types.ObjectId(), portal: 'keshillakos',
    problem: 'Need a call', description: 'Please call me about the service.',
    contactPreference: 'chat', status: 'draft',
  })
  await assert.rejects(chat.validate(), /Numri i telefonit/)
  chat.contactPhone = '044 111 222'
  await chat.validate()
  assert.equal(chat.contactPhone, '044111222')

  const email = new UserRequest({
    user: new Types.ObjectId(), category: new Types.ObjectId(), portal: 'keshillakos',
    problem: 'Need email', description: 'Please write me about the service.',
    contactPreference: 'email', contactPhone: '044111222', status: 'draft',
  })
  await assert.rejects(email.validate(), /Email-i/)
  email.contactEmail = 'not-an-email'
  await assert.rejects(email.validate(), /Email-i nuk është i vlefshëm/)
})

test('RequestDelivery has unique request/provider pair and independent response state', async () => {
  const unique = requestDeliverySchema.indexes().find(([, options]) => options.unique)
  assert.deepEqual(unique?.[0], { request: 1, providerProfile: 1 })
  const delivery = new RequestDelivery({ request: new Types.ObjectId(), providerProfile: new Types.ObjectId() })
  await delivery.validate()
  assert.equal(delivery.status, 'pending')
  assert.ok(delivery.sentAt)
  delivery.offer = { description: 'Fixed translation fee', amount: 100 }
  await assert.rejects(delivery.validate(), /Offer currency/)
})

test('a provider can see only deliveries addressed to managed ProviderProfile IDs', () => {
  const owned = String(new Types.ObjectId())
  const other = String(new Types.ObjectId())
  assert.equal(canSeeDelivery([owned], owned), true)
  assert.equal(canSeeDelivery([owned], other), false)
  assert.equal(canSeeDelivery([], other, true), true)
})
