import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import { Business } from '../src/models/Business'
import { providerDirectoryPipeline } from '../src/services/marketplaceQuery'
import { publicProfileRole } from '../src/services/providerPublicService'
import { effectiveRoles, toPublicUser } from '../src/services/userService'

test('capabilities retain user and do not infer company from provider or legacy labels', () => {
  assert.deepEqual(effectiveRoles({ role: 'user', roles: ['provider'] }), ['user', 'provider'])
  assert.deepEqual(effectiveRoles({ role: 'user', roles: ['company'] }), ['user', 'company'])
  assert.deepEqual(effectiveRoles({ role: 'provider', roles: ['user'] }), ['user'])
  assert.deepEqual(effectiveRoles({ role: 'company', roles: ['provider'] }), ['user', 'provider'])
})

test('public provider profile follows granted capabilities, not the active dashboard context', () => {
  const account = { uid: 'u1', email: 'e@x.com', name: 'Expert' }
  const inClientMode = toPublicUser({ ...account, role: 'user', roles: ['user', 'provider'], activeContext: 'user' })
  assert.equal(inClientMode.role, 'user')
  assert.equal(publicProfileRole(inClientMode), 'provider')

  const companyInClientMode = toPublicUser({ ...account, role: 'user', roles: ['user', 'company'], activeContext: 'user' })
  assert.equal(publicProfileRole(companyInClientMode), 'company')

  const inProviderMode = toPublicUser({ ...account, role: 'provider', roles: ['user', 'provider'], activeContext: 'provider' })
  assert.equal(publicProfileRole(inProviderMode), 'provider')

  assert.equal(publicProfileRole(toPublicUser({ ...account, role: 'user', roles: ['user'] })), null)
  assert.equal(publicProfileRole({ role: 'provider', roles: ['user'] }), null)
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

test('rejecting an invitation removes it without creating membership', async () => {
  const owner = new Types.ObjectId()
  const expert = new Types.ObjectId()
  const business = new Business({
    publicName: 'Agjencia',
    owners: [owner],
    members: [],
    invitations: [{ user: expert, invitedBy: owner, invitedAt: new Date() }],
  })
  business.invitations = business.invitations.filter((item) => !item.user.equals(expert))
  await business.validate()
  assert.equal(business.invitations.length, 0)
  assert.equal(business.members.length, 0)
})


test('admin accounts never qualify for a public expert or company profile', () => {
  assert.equal(publicProfileRole({ role: 'admin', roles: ['user', 'admin'] }), null)
  assert.equal(publicProfileRole({ role: 'admin', roles: ['user', 'provider'] }), null)
  assert.equal(publicProfileRole({ role: 'provider', roles: ['user', 'provider', 'admin'] }), null)
  assert.equal(publicProfileRole({ role: 'company', roles: ['user', 'company', 'admin'] }), null)
  assert.equal(publicProfileRole({ role: 'admin' }), null)
})

test('public directory excludes admin owners before counting and paging', () => {
  const stages = providerDirectoryPipeline({}) as any[]
  const ownerMatch = stages.find(stage => stage.$match?.['_owner.uid'])?.$match
  assert.deepEqual(ownerMatch['_owner.role'], { $ne: 'admin' })
  assert.deepEqual(ownerMatch['_owner.roles'], { $ne: 'admin' })
})
