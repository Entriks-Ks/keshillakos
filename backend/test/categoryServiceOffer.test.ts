import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import { Category, categorySchema } from '../src/models/Category'
import { ServiceOffer, serviceOfferSchema } from '../src/models/ServiceOffer'
import { legacyExtensionFields, validateExtensions } from '../src/services/categoryConfiguration'
import { toPublicServiceOffer } from '../src/services/serviceOfferService'

const providerId = new Types.ObjectId()
const categoryId = new Types.ObjectId()

test('Category has stable portal identity, localization, hierarchy and version constraints', async () => {
  const category = new Category({
    portal: 'KeshillaKos', stableId: 'legal-advice', slug: 'legal-advice',
    labels: { sq: 'Ligj', en: 'Law' }, parent: new Types.ObjectId(),
    order: 3, status: 'active', version: 2,
    extensionFields: [{ key: 'licenseNumber', type: 'string', required: true }],
    configRefs: { policy: 'legal-advice-v2' },
  })
  await category.validate()
  assert.equal(category.portal, 'keshillakos')
  assert.equal(category.labels.get('en'), 'Law')
  assert.equal(category.version, 2)
  assert.ok(categorySchema.indexes().some(([keys, options]) => keys.portal === 1 && keys.stableId === 1 && options.unique))
  category.extensionFields.push({ key: 'licenseNumber', type: 'string' })
  await assert.rejects(category.validate(), /unique/)
})

test('configurable fields validate translation and consulting extensions without schema-specific columns', () => {
  const translation = legacyExtensionFields(['language_pair'])
  assert.deepEqual(validateExtensions(translation, { languageFrom: ' Shqip ', languageTo: ' Gjermanisht ' }), {
    languageFrom: 'Shqip', languageTo: 'Gjermanisht',
  })
  assert.throws(() => validateExtensions(translation, { languageFrom: 'Shqip' }), /languageTo/)
  assert.throws(() => validateExtensions([], { licenseNumber: 'unconfigured' }), /Unsupported/)
  const portfolio = legacyExtensionFields(['portfolio_references'])
  assert.throws(() => validateExtensions(portfolio, {}), /portfolio/)
  assert.equal(validateExtensions(portfolio, { portfolioUrl: ' https:\/\/example.com ' }).portfolioUrl, 'https://example.com')
})

test('ServiceOffer uses canonical IDs and validates price semantics', async () => {
  const offer = new ServiceOffer({
    portal: 'keshillakos', providerProfile: providerId, category: categoryId,
    categoryVersion: 1, name: 'Consultation', description: 'A useful consultation',
    price: { model: 'starting_at', amountFrom: 25, currency: 'eur' },
    durationMinutes: 30, formats: ['individual'], modes: ['online'],
  })
  await offer.validate()
  assert.equal(offer.price.currency, 'EUR')
  assert.equal(offer.status, 'pending')
  assert.equal(offer.moderation.status, 'pending')
  assert.ok(serviceOfferSchema.indexes().some(([keys]) => keys.providerProfile === 1 && keys.status === 1))
  offer.price.amountTo = 10
  await assert.rejects(offer.validate(), /Maximum price/)
})

test('public offer projection omits private qualification reference and moderation', async () => {
  const offer = new ServiceOffer({
    portal: 'keshillakos', providerProfile: providerId, category: categoryId,
    categoryVersion: 1, name: 'Advice', description: 'Description', price: { model: 'quote' },
    extensions: { licenseNumber: 'private-reference', audience: 'b2b' },
  })
  await offer.validate()
  const output = toPublicServiceOffer(offer)
  assert.equal(output.extensions.licenseNumber, undefined)
  assert.equal(output.extensions.audience, 'b2b')
  assert.equal('moderation' in output, false)
})
