import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import { City } from '../src/models/City'
import { Country } from '../src/models/Country'
import { ProviderProfile } from '../src/models/ProviderProfile'
import { filterMatchCandidates } from '../src/services/matchService'
import { filterDiscoveredServices, listActiveServices } from '../src/services/serviceService'
import { listPublishedProviderProfiles } from '../src/services/providerProfileService'
import type { MatchCandidate } from '../src/types/match'

test('category, subcategory, service and text filters compose', () => {
  const services = [
    { id: 'one', categoryId: 'home-and-property', categoryLabel: 'Shtëpi', subcategory: 'Plumbing', title: 'Pipe repair', description: 'Fix leaks', providerName: 'A' },
    { id: 'two', categoryId: 'home-and-property', categoryLabel: 'Shtëpi', subcategory: 'Electrical Services', title: 'Wiring', description: 'Electrician', providerName: 'B' },
    { id: 'three', categoryId: 'auto-and-transportation', categoryLabel: 'Auto', subcategory: 'Car Repair', title: 'Car service', description: 'Repairs', providerName: 'C' },
  ]
  assert.deepEqual(filterDiscoveredServices(services, { categoryId: 'home-and-property', subcategoryNames: ['Plumbing'], q: 'pipe' }).map((item) => item.id), ['one'])
  assert.deepEqual(filterDiscoveredServices(services, { serviceId: 'two', categoryId: 'home-and-property' }).map((item) => item.id), ['two'])
  assert.deepEqual(filterDiscoveredServices(services, { categoryId: 'auto-and-transportation', q: 'pipe' }), [])
})

test('matching taxonomy filters retain service identity and exclude unrelated experts', () => {
  const base: MatchCandidate = { id: 'one', source: 'service', providerUid: 'u', providerId: 'p', name: 'A', title: 'Pipe repair', categoryId: 'home-and-property', categoryLabel: 'Shtëpi', specialty: 'Plumbing', location: 'Pejë', languages: [], verified: false }
  const candidates = [base, { ...base, id: 'two', specialty: 'Electrical Services' }, { ...base, id: 'three', source: 'expert' as const }]
  assert.deepEqual(filterMatchCandidates(candidates, { categoryId: 'home-and-property', subcategoryNames: ['Plumbing'], serviceId: 'one' }).map((item) => item.id), ['one'])
})

test('city discovery queries provider service areas, not the provider base city', async () => {
  const countryId = new Types.ObjectId()
  const cityId = new Types.ObjectId()
  const originalCityFind = City.findOne
  const originalCountryExists = Country.exists
  const originalProviderFind = ProviderProfile.find
  let providerQuery: Record<string, unknown> | undefined
  City.findOne = (() => ({ select: () => ({ lean: () => Promise.resolve({ countryId }) }) })) as unknown as typeof City.findOne
  Country.exists = (() => Promise.resolve({ _id: countryId })) as unknown as typeof Country.exists
  ProviderProfile.find = ((query: Record<string, unknown>) => {
    providerQuery = query
    return { select: () => ({ lean: () => Promise.resolve([]) }) }
  }) as unknown as typeof ProviderProfile.find
  try {
    assert.deepEqual(await listActiveServices({ cityId: String(cityId) }), [])
    assert.equal(String(providerQuery?.serviceAreaCityIds), String(cityId))
    assert.equal('location.cityId' in (providerQuery ?? {}), false)
  } finally {
    City.findOne = originalCityFind
    Country.exists = originalCountryExists
    ProviderProfile.find = originalProviderFind
  }
})

test('expert discovery also filters by service area before limiting results', async () => {
  const cityId = new Types.ObjectId()
  const originalFind = ProviderProfile.find
  let providerQuery: Record<string, unknown> | undefined
  ProviderProfile.find = ((query: Record<string, unknown>) => {
    providerQuery = query
    return { select: () => ({ sort: () => ({ limit: () => Promise.resolve([]) }) }) }
  }) as unknown as typeof ProviderProfile.find
  try {
    assert.deepEqual(await listPublishedProviderProfiles(String(cityId)), [])
    assert.equal(String(providerQuery?.serviceAreaCityIds), String(cityId))
    assert.equal('location.cityId' in (providerQuery ?? {}), false)
  } finally {
    ProviderProfile.find = originalFind
  }
})
