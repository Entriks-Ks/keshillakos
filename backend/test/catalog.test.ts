import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import { Category, categorySchema } from '../src/models/Category'
import { Subcategory } from '../src/models/Subcategory'
import { catalog } from '../src/scripts/seedCategories'

test('seed catalog keeps only legal and accounting specialties', () => {
  assert.deepEqual(catalog.map(([en]) => en), ['Legal Services', 'Accounting & Business'])
  assert.ok(catalog.every(([, , children]) => children.length === 5))
  assert.deepEqual(catalog.find(([en]) => en === 'Legal Services')?.[2], [
    ['Legal Consultation', 'Këshillim Juridik'],
    ['Criminal Law', 'E Drejta Penale'],
    ['Civil & Family Law', 'E Drejta Civile dhe Familjare'],
    ['Business & Property Law', 'E Drejta e Biznesit dhe Pronës'],
    ['Notary & Document Services', 'Shërbime Noteriale dhe të Dokumenteve'],
  ])
})

test('bilingual catalog category retains the existing domain metadata', async () => {
  const category = new Category({
    portal: 'keshillakos', stableId: 'home-and-property', slug: 'home-and-property',
    labels: { sq: 'Shtëpi dhe Pronë', en: 'Home & Property' },
    name: { sq: 'Shtëpi dhe Pronë', en: 'Home & Property' }, order: 1, isActive: true,
  })
  await category.validate()
  assert.equal(category.name?.en, 'Home & Property')
  assert.ok(categorySchema.indexes().some(([keys, options]) => keys.slug === 1 && options.unique))
})

test('subcategory requires a category and bilingual names; slug uniqueness is category-scoped', async () => {
  const subcategory = new Subcategory({
    categoryId: new Types.ObjectId(), name: { sq: 'Hidraulikë', en: 'Plumbing' }, slug: 'plumbing', order: 2,
  })
  await subcategory.validate()
  assert.equal(subcategory.isActive, true)
  assert.ok(Subcategory.schema.indexes().some(([keys, options]) => keys.categoryId === 1 && keys.slug === 1 && options.unique))
  await assert.rejects(new Subcategory({ name: { sq: 'Test', en: 'Test' }, slug: 'test' }).validate(), /categoryId/)
  await assert.rejects(new Subcategory({ categoryId: new Types.ObjectId(), name: { sq: 'Test' }, slug: 'test' }).validate(), /name.en/)
})
