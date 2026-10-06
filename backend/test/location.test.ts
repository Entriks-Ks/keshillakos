import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import { City, citySchema } from '../src/models/City'
import { Country, countrySchema } from '../src/models/Country'
import { citySlug, locations, seedLocations } from '../src/scripts/seedLocations'

test('location seed has seven requested countries, no Serbia, and 80 distinct country/city pairs', () => {
  assert.deepEqual(locations.map((item) => item.slug), [
    'kosovo', 'albania', 'north-macedonia', 'montenegro',
    'bosnia-and-herzegovina', 'croatia', 'slovenia',
  ])
  assert.equal(locations.reduce((count, item) => count + item.cities.length, 0), 80)
  const keys = locations.flatMap((item) => item.cities.map(([sq, en]) => {
    assert.ok(sq.trim() && en.trim())
    return `${item.slug}/${citySlug(en)}`
  }))
  assert.equal(new Set(keys).size, keys.length)
})

test('Kosovo includes all 38 municipalities while preserving the original seven city identities and order', () => {
  const cities = locations.find(item => item.slug === 'kosovo')!.cities
  assert.deepEqual(cities.slice(0, 7), [
    ['Prishtinë', 'Pristina'], ['Prizren', 'Prizren'], ['Pejë', 'Peja'],
    ['Gjakovë', 'Gjakova'], ['Ferizaj', 'Ferizaj'], ['Gjilan', 'Gjilan'], ['Mitrovicë', 'Mitrovica'],
  ])
  // Official municipality inventory, including the distinct northern municipality.
  const expected = ['Deçan', 'Gjakovë', 'Gllogoc', 'Gjilan', 'Dragash', 'Istog', 'Kaçanik',
    'Klinë', 'Fushë Kosovë', 'Kamenicë', 'Mitrovicë', 'Leposaviq', 'Lipjan', 'Novobërdë',
    'Obiliq', 'Rahovec', 'Pejë', 'Podujevë', 'Prishtinë', 'Prizren', 'Skënderaj', 'Shtime',
    'Shtërpcë', 'Suharekë', 'Ferizaj', 'Viti', 'Vushtrri', 'Zubin Potok', 'Zveçan',
    'Malishevë', 'Junik', 'Mamushë', 'Hani i Elezit', 'Graçanicë', 'Ranillug', 'Partesh',
    'Kllokot', 'Mitrovicë e Veriut']
  assert.deepEqual(cities.map(([sq]) => sq).sort(), expected.sort())
  assert.equal(new Set(cities.map(([sq]) => sq)).size, 38)
})

test('country and city schemas validate bilingual names, slugs and order', async () => {
  const country = new Country({ name: { sq: 'Kosovë', en: 'Kosovo' }, slug: 'Kosovo', order: 1 })
  await country.validate()
  assert.equal(country.slug, 'kosovo')
  assert.equal(country.isActive, true)
  assert.ok(countrySchema.indexes().some(([keys, options]) => keys.slug === 1 && options.unique))
  assert.ok(countrySchema.indexes().some(([keys]) => keys.isActive === 1 && keys.order === 1))

  const city = new City({ countryId: country._id, name: { sq: 'Prishtinë', en: 'Pristina' }, slug: 'pristina', order: 1 })
  await city.validate()
  assert.equal(city.isActive, true)
  assert.ok(citySchema.indexes().some(([keys, options]) => keys.countryId === 1 && keys.slug === 1 && options.unique))
  assert.ok(citySchema.indexes().some(([keys]) => keys.countryId === 1 && keys.isActive === 1 && keys.order === 1))
  await assert.rejects(new City({ name: { sq: 'Test', en: 'Test' }, slug: 'test', order: 1 }).validate(), /countryId/)
  await assert.rejects(new Country({ name: { sq: 'Test' }, slug: 'test', order: 1 }).validate(), /name.en/)
  await assert.rejects(new City({ countryId: new Types.ObjectId(), name: { sq: 'Test', en: 'Test' }, slug: 'bad_slug', order: 1 }).validate(), /slug/)
  await assert.rejects(new Country({ name: { sq: 'Test', en: 'Test' }, slug: 'test', order: 1.5 }).validate(), /order/)
})

test('seed reuses country identities and repeats city upserts without duplicate keys', async () => {
  const originalCountryUpdate = Country.findOneAndUpdate
  const originalCityUpdate = City.updateOne
  const identities = new Map<string, Types.ObjectId>()
  const calls: Array<{ filter: unknown; options: unknown }> = []
  Country.findOneAndUpdate = ((filter: { slug: string }) => {
    let id = identities.get(filter.slug)
    if (!id) { id = new Types.ObjectId(); identities.set(filter.slug, id) }
    return Promise.resolve({ _id: id })
  }) as unknown as typeof Country.findOneAndUpdate
  City.updateOne = ((filter: unknown, _update: unknown, options: unknown) => {
    calls.push({ filter, options })
    return Promise.resolve({})
  }) as unknown as typeof City.updateOne
  try {
    await seedLocations()
    await seedLocations()
  } finally {
    Country.findOneAndUpdate = originalCountryUpdate
    City.updateOne = originalCityUpdate
  }
  assert.equal(identities.size, 7)
  assert.equal(calls.length, 160)
  assert.deepEqual(calls.slice(0, 80), calls.slice(80))
  assert.ok(calls.every((call) => (call.options as { upsert?: boolean }).upsert === true))
})
