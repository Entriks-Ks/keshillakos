import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import { Business } from '../src/models/Business'
import { ProviderProfile } from '../src/models/ProviderProfile'
import { canManageBusiness } from '../src/services/businessService'
import { toPublicProvider } from '../src/services/providerProfileService'

const owner = new Types.ObjectId()
const other = new Types.ObjectId()

test('Business requires distinct owners and a legal name before verification', async () => {
  const empty = new Business({ publicName: 'Kos Studio', owners: [] })
  await assert.rejects(empty.validate(), /owners/)

  const business = new Business({ publicName: ' Kos Studio ', owners: [owner] })
  await business.validate()
  assert.equal(business.publicName, 'Kos Studio')
  assert.equal(business.status, 'draft')
  business.verification.status = 'verified'
  await assert.rejects(business.validate(), /legalName/)
  business.legalName = 'Kos Studio LLC'
  await business.validate()
})

test('only business owners and managers can manage it', () => {
  const business = { owners: [owner], members: [{ user: other, role: 'member' as const }] }
  assert.equal(canManageBusiness(business, owner), true)
  assert.equal(canManageBusiness(business, other), false)
  business.members = [{ user: other, role: 'manager' as const }]
  assert.equal(canManageBusiness(business, other), true)
})

test('business provider requires Business ID and on-site location', async () => {
  const provider = new ProviderProfile({
    providerType: 'business', ownerUser: owner, categories: ['law'], modes: ['on_site'],
    publicProfile: { displayName: 'Kos Studio' },
  })
  await assert.rejects(provider.validate(), /business|locations/)
  provider.business = new Types.ObjectId()
  provider.locations = [{ countryCode: 'XK', cityName: 'Prishtina', online: false }]
  await provider.validate()
  assert.equal(provider.status, 'pending')
  assert.equal(provider.moderation.status, 'pending')
  assert.equal(provider.verification.qualification, 'unverified')
  assert.equal(provider.get('companyName'), undefined)
})

test('individual provider can have a business affiliation without using a UID as identity', async () => {
  const provider = new ProviderProfile({
    providerType: 'individual', ownerUser: owner, business: new Types.ObjectId(),
    categories: ['law', 'business-founding'], languages: ['sq', 'en'], modes: ['online'],
    publicProfile: { displayName: 'Ada' },
  })
  await provider.validate()
  assert.ok(provider._id instanceof Types.ObjectId)
  assert.ok(provider.business instanceof Types.ObjectId)
  assert.equal(provider.get('companyUid'), undefined)
})

test('public projection excludes owner, private qualification claims and moderation details', async () => {
  const provider = new ProviderProfile({
    providerType: 'individual', ownerUser: owner, categories: ['law'], modes: ['online'],
    publicProfile: { displayName: 'Ada', publicEmail: 'contact@example.com' },
    qualificationClaims: [{ categoryId: 'law', referenceNumber: 'private-reference' }],
    moderation: { status: 'approved', reason: 'internal note' },
  })
  await provider.validate()
  const publicValue = toPublicProvider(provider)
  assert.equal(publicValue.id, String(provider._id))
  assert.equal(publicValue.publicProfile.publicEmail, 'contact@example.com')
  assert.equal('qualificationClaims' in publicValue, false)
  assert.equal('moderation' in publicValue, false)
  assert.equal('ownerUser' in publicValue, false)
})
