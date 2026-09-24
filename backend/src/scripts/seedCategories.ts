import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db'
import type { DomainRequirement } from '../data/domains'
import { Category } from '../models/Category'
import { Subcategory } from '../models/Subcategory'
import { legacyExtensionFields } from '../services/categoryConfiguration'
import { DEFAULT_PORTAL } from '../services/domainService'

/** Category-specific requirements for the bilingual catalog (universal fields live on the form). */
export const CATALOG_REQUIREMENTS: Record<string, DomainRequirement[]> = {
  'legal-services': ['license_verification'],
  'accounting-and-business': ['documents_deadlines', 'audience_b2c_b2b'],
}

// Each entry is [English, Albanian]. Slugs derive from English names.
export const catalog: [string, string, [string, string][]][] = [
  ['Legal Services', 'Shërbime Juridike', [
    ['Legal Consultation', 'Këshillim Juridik'], ['Criminal Law', 'E Drejta Penale'], ['Civil & Family Law', 'E Drejta Civile dhe Familjare'], ['Business & Property Law', 'E Drejta e Biznesit dhe Pronës'], ['Notary & Document Services', 'Shërbime Noteriale dhe të Dokumenteve'],
  ]],
  ['Accounting & Business', 'Kontabilitet dhe Biznes', [
    ['Accounting', 'Kontabilitet'], ['Tax Consulting', 'Këshillim Tatimor'], ['Business Registration', 'Regjistrim Biznesi'], ['Business Consulting', 'Këshillim për Biznes'], ['Payroll', 'Pagat'],
  ]],
]

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Reuse the identity of a related former legal specialty when renaming it.
const formerLegalSlugs: Record<string, string> = {
  'civil-and-family-law': 'family-and-inheritance-law',
  'business-and-property-law': 'business-and-employment-law',
  'notary-and-document-services': 'notary-services',
}

export async function seedCategories() {
  for (const [index, [en, sq, children]] of catalog.entries()) {
    const slug = slugify(en)
    const existing = await Category.findOne({ portal: DEFAULT_PORTAL, $or: [{ stableId: slug }, { slug }] })
    const category = existing ?? new Category({ portal: DEFAULT_PORTAL, stableId: slug, slug })
    const requirements = CATALOG_REQUIREMENTS[slug] ?? []
    category.set({
      name: { sq, en },
      labels: { sq, en },
      slug,
      order: index + 1,
      isActive: true,
      status: 'active',
      source: 'seed',
      requirements,
      extensionFields: legacyExtensionFields(requirements),
    })
    await category.save()
    for (const [position, [childEn, childSq]] of children.entries()) {
      const childSlug = slugify(childEn)
      const child = await Subcategory.findOne({ categoryId: category._id, slug: childSlug })
        ?? (slug === 'legal-services' && formerLegalSlugs[childSlug]
          ? await Subcategory.findOne({ categoryId: category._id, slug: formerLegalSlugs[childSlug] })
          : null)
        ?? new Subcategory({ categoryId: category._id, slug: childSlug })
      child.set({ slug: childSlug, name: { sq: childSq, en: childEn }, order: position + 1, isActive: true })
      await child.save()
    }
    await Subcategory.updateMany(
      { categoryId: category._id, slug: { $nin: children.map(([childEn]) => slugify(childEn)) } },
      { $set: { isActive: false } },
    )
  }

  const activeSlugs = catalog.map(([en]) => slugify(en))
  await Category.updateMany(
    { portal: DEFAULT_PORTAL, slug: { $nin: activeSlugs } },
    { $set: { isActive: false, status: 'archived' } },
  )
  const archived = await Category.find({ portal: DEFAULT_PORTAL, slug: { $nin: activeSlugs } }).select('_id')
  if (archived.length > 0) {
    await Subcategory.updateMany(
      { categoryId: { $in: archived.map((item) => item._id) } },
      { $set: { isActive: false } },
    )
  }
}

if (require.main === module) {
  connectDB().then(seedCategories).then(() => {
    console.log('Seeded legal and accounting categories')
  }).catch((err) => {
    console.error(err)
    process.exitCode = 1
  }).finally(() => mongoose.disconnect())
}
