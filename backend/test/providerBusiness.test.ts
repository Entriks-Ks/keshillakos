import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import { Business } from '../src/models/Business'
import { City } from '../src/models/City'
import { Country } from '../src/models/Country'
import { ProviderProfile, providerProfileSchema } from '../src/models/ProviderProfile'
import { canManageBusiness } from '../src/services/businessService'
import { toPublicProvider, validateProviderLocations } from '../src/services/providerProfileService'

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

test('provider base and service areas use referenced cities with searchable indexes', async () => {
  const countryId = new Types.ObjectId()
  const cityId = new Types.ObjectId()
  const provider = new ProviderProfile({
    providerType: 'individual', ownerUser: owner, categories: ['law'], modes: ['on_site'],
    location: { countryId, cityId }, serviceAreaCityIds: [cityId], publicProfile: { displayName: 'Ada' },
  })
  await provider.validate()
  assert.equal(String(toPublicProvider(provider).location?.cityId), String(cityId))
  assert.deepEqual(toPublicProvider(provider).serviceAreaCityIds.map(String), [String(cityId)])
  assert.ok(providerProfileSchema.indexes().some(([keys]) => keys['location.countryId'] === 1 && keys['location.cityId'] === 1))
  assert.ok(providerProfileSchema.indexes().some(([keys]) => keys.serviceAreaCityIds === 1))
  provider.serviceAreaCityIds.push(cityId)
  await assert.rejects(provider.validate(), /Duplicate service-area cities/)
  provider.serviceAreaCityIds.pop()
  provider.location = { countryId } as typeof provider.location
  await assert.rejects(provider.validate(), /cityId/)
})

test('provider location validation rejects mismatched and inactive catalog references', async () => {
  const countryId = new Types.ObjectId()
  const cityId = new Types.ObjectId()
  const originalCountryExists = Country.exists
  const originalCityExists = City.exists
  const originalCityFind = City.find
  const originalCountryFind = Country.find
  Country.exists = (() => Promise.resolve({ _id: countryId })) as unknown as typeof Country.exists
  City.exists = (() => Promise.resolve({ _id: cityId })) as unknown as typeof City.exists
  City.find = (() => ({ select: () => ({ lean: () => Promise.resolve([{ _id: cityId, countryId }]) }) })) as unknown as typeof City.find
  Country.find = (() => ({ select: () => ({ lean: () => Promise.resolve([{ _id: countryId }]) }) })) as unknown as typeof Country.find
  try {
    await validateProviderLocations({ countryId: String(countryId), cityId: String(cityId) }, [String(cityId)])
    await assert.rejects(validateProviderLocations(undefined, [String(cityId), String(cityId)]), /pavlefshme/)
    City.exists = (() => Promise.resolve(null)) as unknown as typeof City.exists
    await assert.rejects(validateProviderLocations({ countryId: String(countryId), cityId: String(cityId) }), /nuk përputhen/)
    City.find = (() => ({ select: () => ({ lean: () => Promise.resolve([]) }) })) as unknown as typeof City.find
    await assert.rejects(validateProviderLocations(undefined, [String(cityId)]), /joaktive/)
    City.find = (() => ({ select: () => ({ lean: () => Promise.resolve([{ _id: cityId, countryId }]) }) })) as unknown as typeof City.find
    Country.find = (() => ({ select: () => ({ lean: () => Promise.resolve([]) }) })) as unknown as typeof Country.find
    await assert.rejects(validateProviderLocations(undefined, [String(cityId)]), /joaktive/)
  } finally {
    Country.exists = originalCountryExists
    City.exists = originalCityExists
    City.find = originalCityFind
    Country.find = originalCountryFind
  }
})
