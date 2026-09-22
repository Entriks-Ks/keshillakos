import assert from 'node:assert/strict'
import test from 'node:test'
import { CatalogOption } from '../src/models/CatalogOption'
import { SERVICE_OPTIONS_SEED, serviceOptionValue, serviceOptionValues } from '../src/data/serviceOptions'

test('service option seed covers languages, delivery modes, audiences and offer types', () => {
  assert.deepEqual(serviceOptionValues('language'), ['Shqip', 'Gjermanisht', 'Anglisht', 'Turqisht', 'Frëngjisht'])
  assert.deepEqual(serviceOptionValues('delivery-mode'), ['online', 'physical', 'group'])
  assert.deepEqual(serviceOptionValues('audience'), ['b2c', 'b2b', 'both'])
  assert.deepEqual(serviceOptionValues('offer-type'), ['package', 'project', 'service'])
  assert.equal(SERVICE_OPTIONS_SEED.length, 17)
  assert.equal(serviceOptionValue(SERVICE_OPTIONS_SEED[0]!), 'Shqip')
  assert.equal(serviceOptionValue(SERVICE_OPTIONS_SEED.find((item) => item.slug === 'online')!), 'online')
})

test('catalog option requires bilingual names and unique group/slug', async () => {
  const option = new CatalogOption({
    group: 'language',
    slug: 'albanian',
    name: { sq: 'Shqip', en: 'Albanian' },
    order: 1,
  })
  await option.validate()
  assert.equal(option.isActive, true)
  assert.ok(CatalogOption.schema.indexes().some(([keys, options]) => keys.group === 1 && keys.slug === 1 && options?.unique))
  await assert.rejects(new CatalogOption({ group: 'language', slug: 'albanian', name: { sq: 'Shqip' }, order: 1 }).validate(), /name.en/)
})
