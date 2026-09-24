import { Types } from 'mongoose'
import { COACHING_DISCLAIMER, FINANCE_REGULATORY_NOTICE, SYSTEM_DOMAINS, type DomainDefinition, type DomainRequirement } from '../data/domains'
import { Category, type CategoryDoc, type ExtensionField } from '../models/Category'
import { CustomCategory } from '../models/CustomCategory'
import { legacyExtensionFields } from './categoryConfiguration'

export const DEFAULT_PORTAL = 'keshillakos'

function slugify(input: string) {
  return input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

let importPromise: Promise<void> | undefined

// Retain both legacy sources, but import them into Category once. All runtime reads use Category.
export function ensureCategoryCatalog() {
  if (!importPromise) {
    importPromise = (async () => {
      for (const [order, domain] of SYSTEM_DOMAINS.entries()) {
        await Category.updateOne({ portal: DEFAULT_PORTAL, stableId: domain.id }, {
          $setOnInsert: {
            portal: DEFAULT_PORTAL, stableId: domain.id, slug: domain.id,
            labels: { sq: domain.labelSq, de: domain.labelDe },
            guidelines: domain.requirements.includes('coaching_boundary') ? { sq: COACHING_DISCLAIMER }
              : domain.requirements.includes('regulatory_notice') ? { sq: FINANCE_REGULATORY_NOTICE } : undefined,
            examples: domain.examples, keywords: domain.keywords,
            requirements: domain.requirements,
            extensionFields: legacyExtensionFields(domain.requirements),
            order: domain.id === 'other' ? 10000 : order,
            status: 'active', source: 'seed', version: 1,
          },
        }, { upsert: true, runValidators: true })
      }
      const legacy = await CustomCategory.find().lean()
      for (const category of legacy) {
        await Category.updateOne({ portal: DEFAULT_PORTAL, stableId: category.slug }, {
          $setOnInsert: {
            portal: DEFAULT_PORTAL, stableId: category.slug, slug: category.slug,
            labels: { sq: category.labelSq, de: category.labelDe },
            examples: category.examples, keywords: category.keywords,
            requirements: [], extensionFields: [], order: 5000,
            status: category.active ? 'active' : 'archived', source: 'legacy', version: 1,
          },
        }, { upsert: true, runValidators: true })
      }
    })().catch((err) => { importPromise = undefined; throw err })
  }
  return importPromise
}

export type CategoryView = DomainDefinition & {
  categoryRef: string
  portal: string
  stableId: string
  slug: string
  parent?: string
  labels: Record<string, string>
  guidelines?: Record<string, string>
  order: number
  status: CategoryDoc['status']
  version: number
  extensionFields: ExtensionField[]
  configRefs: CategoryDoc['configRefs']
}

function toCategoryView(category: CategoryDoc & { _id: Types.ObjectId }): CategoryView {
  const labels = Object.fromEntries(category.labels)
  return {
    id: category.stableId,
    categoryRef: String(category._id),
    portal: category.portal,
    stableId: category.stableId,
    slug: category.slug,
    parent: category.parent ? String(category.parent) : undefined,
    labels,
    guidelines: category.guidelines ? Object.fromEntries(category.guidelines) : undefined,
    labelSq: labels.sq || category.slug,
    labelDe: labels.de || labels.en || labels.sq || category.slug,
    examples: category.examples,
    keywords: category.keywords,
    requirements: category.requirements as DomainRequirement[],
    system: category.source === 'seed',
    order: category.order,
    status: category.status,
    version: category.version,
    extensionFields: category.extensionFields,
    configRefs: category.configRefs,
  }
}

export async function listAllDomains(portal = DEFAULT_PORTAL): Promise<CategoryView[]> {
  await ensureCategoryCatalog()
  const categories = await Category.find({ portal, status: 'active' }).sort({ order: 1, stableId: 1 })
  return categories.map(toCategoryView)
}

export async function findDomainById(id: string, portal = DEFAULT_PORTAL): Promise<CategoryView | null> {
  await ensureCategoryCatalog()
  const category = await Category.findOne({
    portal,
    status: 'active',
    $or: [
      ...(Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
      { stableId: id },
      { slug: id },
    ],
  })
  return category ? toCategoryView(category) : null
}

export async function findCategoryById(id: string, portal = DEFAULT_PORTAL) {
  await ensureCategoryCatalog()
  return Category.findOne({
    portal,
    status: 'active',
    $or: [
      ...(Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
      { stableId: id },
      { slug: id },
    ],
  })
}

export async function createCategory(input: {
  portal: string; stableId: string; slug?: string; labels: Record<string, string>
  guidelines?: Record<string, string>
  parent?: string; order?: number; status?: CategoryDoc['status']; examples?: string[]
  keywords?: string[]; extensionFields?: ExtensionField[]; requirements?: string[]
  configRefs?: CategoryDoc['configRefs']
}) {
  await ensureCategoryCatalog()
  let parent: Types.ObjectId | undefined
  if (input.parent) {
    if (!Types.ObjectId.isValid(input.parent)) throw new Error('Parent ID i pavlefshëm')
    const existing = await Category.findById(input.parent)
    if (!existing || existing.portal !== input.portal) throw new Error('Parent must belong to the same portal')
    parent = existing._id
  }
  const category = await Category.create({
    portal: input.portal,
    stableId: input.stableId,
    slug: input.slug || input.stableId,
    labels: input.labels,
    guidelines: input.guidelines,
    parent,
    order: input.order ?? 0,
    status: input.status ?? 'active',
    examples: input.examples ?? [],
    keywords: input.keywords ?? [],
    requirements: input.requirements ?? [],
    extensionFields: input.extensionFields ?? [],
    configRefs: input.configRefs,
    version: 1,
  })
  return toCategoryView(category)
}

export async function updateCategory(id: string, input: Partial<Omit<CategoryDoc,
  'portal' | 'stableId' | 'createdAt' | 'updatedAt' | 'version'>>) {
  await ensureCategoryCatalog()
  if (!Types.ObjectId.isValid(id)) throw new Error('Category ID i pavlefshëm')
  const category = await Category.findById(id)
  if (!category) throw new Error('Kategoria nuk u gjet')
  if (input.parent) {
    const parent = await Category.findById(input.parent)
    if (!parent || parent.portal !== category.portal || parent.id === category.id) throw new Error('Parent i pavlefshëm')
    let cursor = parent
    while (cursor.parent) {
      if (cursor.parent.equals(category._id)) throw new Error('Category hierarchy cycle')
      const next = await Category.findById(cursor.parent)
      if (!next) break
      cursor = next
    }
    category.parent = parent._id
  }
  for (const key of ['slug', 'labels', 'guidelines', 'order', 'status', 'examples', 'keywords', 'requirements', 'extensionFields', 'configRefs'] as const) {
    if (input[key] !== undefined) category.set(key, input[key])
  }
  category.version += 1
  await category.save()
  return toCategoryView(category)
}

export async function createCustomDomain(input: { labelSq: string; labelDe: string; examples?: string[]; keywords?: string[]; createdByUid: string }) {
  await ensureCategoryCatalog()
  const base = slugify(input.labelSq) || slugify(input.labelDe) || `custom-${Date.now()}`
  let slug = base
  let suffix = 1
  while (await Category.exists({ portal: DEFAULT_PORTAL, $or: [{ slug }, { stableId: slug }] })) slug = `${base}-${suffix++}`
  return createCategory({
    portal: DEFAULT_PORTAL, stableId: slug, labels: { sq: input.labelSq.trim(), de: input.labelDe.trim() || input.labelSq.trim() },
    examples: input.examples?.map((value) => value.trim()).filter(Boolean),
    keywords: input.keywords?.map((value) => value.trim().toLowerCase()).filter(Boolean),
    order: 5000,
  })
}
