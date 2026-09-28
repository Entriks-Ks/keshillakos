import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeMarketplaceProvider,
  normalizeMarketplaceProviders,
  withCategoryLabels,
} from '../src/utils/marketplaceProvider.ts'
import { filterMarketplaceProviders, sortProviders } from '../src/utils/serviceDiscovery.ts'
import { humanLabels } from '../src/utils/displayLabels.ts'

const ALL_FILTERS = {
  query: '',
  categoryId: 'all',
  subcategoryId: 'all',
  delivery: 'all',
  language: 'all',
  priceMin: '',
  priceMax: '',
  minRating: '',
  verification: 'all',
  availability: 'all',
}

const catalog = [
  { _id: '6aabd7361558226a7e14b949', stableId: 'legal-services', slug: 'legal-services', name: { sq: 'Shërbime ligjore', en: 'Legal services' } },
  { _id: '6aabd7371558226a7e14b94f', stableId: 'accounting-and-business', slug: 'accounting-and-business', name: { sq: 'Kontabilitet dhe biznes', en: 'Accounting' } },
]

function marketplace(overrides = {}) {
  return {
    id: 'p1',
    uid: 'u1',
    providerType: 'individual',
    name: 'Arta Krasniqi',
    languages: ['Albanian'],
    modes: ['online'],
    categories: ['legal-services'],
    categoryLabels: ['Shërbime ligjore'],
    specializations: ['Divorce'],
    ratingAverage: 4.5,
    ratingCount: 3,
    serviceCount: 1,
    ...overrides,
  }
}

function cardSpecialties(provider) {
  return humanLabels([...provider.specializations, ...provider.categoryLabels], provider.categories)
}

test('provider with categories keeps labels and survives filtering', () => {
  const [provider] = normalizeMarketplaceProviders([marketplace()])
  const labeled = withCategoryLabels(provider, catalog)
  assert.deepEqual(labeled.categoryLabels, ['Shërbime ligjore'])
  assert.deepEqual(cardSpecialties(labeled), ['Divorce', 'Shërbime ligjore'])
  const found = filterMarketplaceProviders([labeled], { ...ALL_FILTERS, query: 'ligjore' }, 'experts')
  assert.equal(found.length, 1)
})

test('provider with no categories gets empty label list', () => {
  const [provider] = normalizeMarketplaceProviders([marketplace({ categories: [], categoryLabels: [] })])
  const labeled = withCategoryLabels(provider, catalog)
  assert.deepEqual(labeled.categories, [])
  assert.deepEqual(labeled.categoryLabels, [])
  assert.equal(filterMarketplaceProviders([labeled], ALL_FILTERS, 'experts').length, 1)
})

test('missing or null category data is coerced to string arrays', () => {
  for (const bad of [undefined, null, 'legal-services', 42, { 0: 'x' }, [null, 7, '  ', 'Tax']]) {
    const provider = normalizeMarketplaceProvider(marketplace({
      categories: bad,
      categoryLabels: bad,
      specializations: bad,
      languages: bad,
      modes: bad,
    }))
    assert.ok(provider)
    for (const key of ['categories', 'categoryLabels', 'specializations', 'languages', 'modes']) {
      assert.ok(Array.isArray(provider[key]), `${key} should be an array for ${JSON.stringify(bad)}`)
      assert.ok(provider[key].every((item) => typeof item === 'string' && item.length > 0))
    }
    const labeled = withCategoryLabels(provider, catalog)
    assert.doesNotThrow(() => filterMarketplaceProviders([labeled], { ...ALL_FILTERS, query: 'arta' }, 'experts'))
    assert.doesNotThrow(() => cardSpecialties(labeled))
  }
})

test('category ids are resolved to catalog labels and raw ids never leak', () => {
  const [provider] = normalizeMarketplaceProviders([marketplace({
    categories: ['6aabd7371558226a7e14b94f', 'accounting-and-business', 'unknown-slug'],
    categoryLabels: ['6aabd7371558226a7e14b94f', 'accounting-and-business', 'unknown-slug'],
  })])
  const labeled = withCategoryLabels(provider, catalog)
  assert.deepEqual(labeled.categoryLabels, ['Kontabilitet dhe biznes'])
})

test('legacy owner-profile payload from older API builds does not crash discovery', () => {
  const legacy = [{
    id: 'a', _id: 'a', providerType: 'individual',
    categories: ['6aabd7361558226a7e14b949', 'legal-services'],
    languages: ['Albanian'], modes: ['online'], specializations: [],
    publicProfile: { displayName: 'Legacy Expert' },
    verification: { identity: 'unverified', business: 'unverified', qualification: 'unverified' },
  }]
  const providers = normalizeMarketplaceProviders(legacy)
  assert.deepEqual(providers, [], 'entries without a public uid cannot link to a profile and are dropped')
  assert.doesNotThrow(() => sortProviders(filterMarketplaceProviders(providers, ALL_FILTERS, 'experts'), 'relevance', 'x'))
  assert.deepEqual(normalizeMarketplaceProviders(undefined), [])
  assert.deepEqual(normalizeMarketplaceProviders({ providers: [] }), [])

  const withUid = normalizeMarketplaceProvider({ ...legacy[0], uid: 'u-legacy' })
  assert.equal(withUid.name, 'Legacy Expert')
  assert.deepEqual(withCategoryLabels(withUid, catalog).categoryLabels, ['Shërbime ligjore'])
})
