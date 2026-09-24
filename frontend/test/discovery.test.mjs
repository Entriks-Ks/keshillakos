import assert from 'node:assert/strict'
import test from 'node:test'
import { filterVisibleServices, serviceDiscoveryRequest } from '../src/utils/serviceDiscovery.ts'

test('selected city is included in service discovery requests', () => {
  assert.deepEqual(serviceDiscoveryRequest('prishtina-city-id'), { cityId: 'prishtina-city-id' })
  assert.deepEqual(serviceDiscoveryRequest(undefined), {})
})

test('category and service search still compose on city-filtered results', () => {
  const services = [
    { id: 'one', title: 'Plumbing', description: 'Pipe repair', categoryId: 'home', categoryLabel: 'Home', details: { deliveryModes: ['physical'] } },
    { id: 'two', title: 'Electrical Services', description: 'Wiring', categoryId: 'home', categoryLabel: 'Home', details: { deliveryModes: ['physical'] } },
    { id: 'three', title: 'Plumbing', description: 'Remote advice', categoryId: 'business', categoryLabel: 'Business', details: { deliveryModes: ['online'] } },
  ]
  assert.deepEqual(
    filterVisibleServices(services, {
      query: 'Plumbing',
      categoryId: 'Home',
      subcategoryId: 'all',
      delivery: 'physical',
      language: 'all',
      priceMin: '',
      priceMax: '',
      minRating: '',
      verification: 'all',
      availability: 'all',
    }).map((service) => service.id),
    ['one'],
  )
})
