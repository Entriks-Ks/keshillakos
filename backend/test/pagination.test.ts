import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paginationInput, paginationMeta, queryPage, paginateItems } from '../src/services/pagination'
import { filterMarketplaceProviders, filterVisibleServices, marketplaceFilters, sortServices, type MarketplaceProvider, type ServiceItem } from '../src/services/marketplaceFilters'

test('pagination validates inputs and caps request sizes', () => {
  assert.deepEqual(paginationInput({}, 20), { page: 1, limit: 20 })
  assert.deepEqual(paginationInput({ page: '2', limit: '1000' }), { page: 2, limit: 100 })
  for (const value of ['0', '-1', '1.5', 'NaN', 'Infinity', '9007199254740992', ['1', '2']]) {
    assert.throws(() => paginationInput({ page: value }))
    assert.throws(() => paginationInput({ limit: value }))
  }
})

test('database pagination clamps a deleted last page before issuing a bounded query', async () => {
  let offset = -1
  let requestedLimit = -1
  const result = await queryPage({ page: 3, limit: 20 }, () => Promise.resolve(40), (skip, limit) => {
    offset = skip; requestedLimit = limit
    return Promise.resolve(['last available page'])
  })
  assert.equal(offset, 20)
  assert.equal(requestedLimit, 20)
  assert.deepEqual(result.pagination, { page: 2, limit: 20, total: 40, totalPages: 2 })
  assert.deepEqual(paginationMeta({ page: 999, limit: 12 }, 0), { page: 1, limit: 12, total: 0, totalPages: 0 })
})

test('filters and sorting are applied to the whole matching set before server pagination', () => {
  const services: ServiceItem[] = Array.from({ length: 30 }, (_, index) => ({
    id: String(index), title: `Advice ${index}`, description: 'Tax advice', categoryId: 'tax', categoryLabel: 'Tax', subcategory: '', location: 'Online', providerUid: 'owner', providerName: 'Expert', active: true, createdAt: new Date(2026, 0, index + 1).toISOString(),
    details: { deliveryModes: ['online'], supportLanguages: ['sq'] },
  }))
  services[29].title = 'Unique service beyond the first page'
  const matching = filterVisibleServices(services, marketplaceFilters({ q: 'Unique', language: 'sq', delivery: 'online' }))
  const result = paginateItems(sortServices(matching, 'newest', ''), { page: 4, limit: 12 })
  assert.equal(result.items[0]?.id, '29')
  assert.equal(result.pagination.total, 1)
  assert.equal(result.pagination.page, 1)
  const provider: MarketplaceProvider = { id: 'p', uid: 'u', providerType: 'individual', name: 'Expert', languages: ['sq'], modes: ['online'], categories: ['tax'], categoryLabels: ['Tax'], subcategoryIds: ['child'], specializations: [], ratingAverage: 4.8, ratingCount: 20, serviceCount: 2, verification: { identity: 'verified' } }
  assert.equal(filterMarketplaceProviders([provider], marketplaceFilters({ categoryId: 'tax', subcategoryId: 'child', minRating: '4.5', verification: 'verified' }), 'experts').length, 1)
  assert.equal(filterMarketplaceProviders([provider], marketplaceFilters({}), 'companies').length, 0)
})


test('pagination recovers when the last item is deleted between count and read', async () => {
  let counts = 0
  let reads = 0
  const result = await queryPage({ page: 2, limit: 20 }, async () => ++counts === 1 ? 21 : 20, async (skip) => {
    reads++
    return skip === 20 ? [] : ['remaining item']
  })
  assert.equal(reads, 2)
  assert.equal(result.pagination.page, 1)
  assert.equal(result.pagination.total, 20)
  assert.deepEqual(result.items, ['remaining item'])
})
