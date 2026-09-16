import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import { Business } from '../src/models/Business'
import { effectiveRoles } from '../src/services/userService'

test('capabilities retain user and do not infer company from provider or legacy labels', () => {
  assert.deepEqual(effectiveRoles({ role: 'user', roles: ['provider'] }), ['user', 'provider'])
  assert.deepEqual(effectiveRoles({ role: 'user', roles: ['company'] }), ['user', 'company'])
  assert.deepEqual(effectiveRoles({ role: 'provider', roles: ['user'] }), ['user'])
  assert.deepEqual(effectiveRoles({ role: 'company', roles: ['provider'] }), ['user', 'provider'])
})

test('company invitations remain separate from accepted members', async () => {
  const owner = new Types.ObjectId()
  const expert = new Types.ObjectId()
  const business = new Business({
    publicName: 'Agjencia', owners: [owner], members: [],
    invitations: [{ user: expert, invitedBy: owner, invitedAt: new Date() }],
  })
  await business.validate()
  assert.equal(business.members.length, 0)
  assert.equal(business.invitations.length, 1)
  assert.equal(String(business.invitations[0].user), String(expert))
})
