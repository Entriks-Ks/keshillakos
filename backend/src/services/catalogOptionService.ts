import { CATALOG_OPTION_GROUPS, SERVICE_OPTIONS_SEED, type CatalogOptionGroup } from '../data/serviceOptions'
import { CatalogOption, type CatalogOptionDoc } from '../models/CatalogOption'

let seedPromise: Promise<void> | undefined

export async function ensureCatalogOptions() {
  if (!seedPromise) {
    seedPromise = (async () => {
      for (const option of SERVICE_OPTIONS_SEED) {
        await CatalogOption.updateOne(
          { group: option.group, slug: option.slug },
          {
            $set: {
              name: option.name,
              order: option.order,
              isActive: true,
            },
            $setOnInsert: {
              group: option.group,
              slug: option.slug,
            },
          },
          { upsert: true, runValidators: true },
        )
      }
    })().catch((err) => {
      seedPromise = undefined
      throw err
    })
  }
  return seedPromise
}

export type CatalogOptionView = {
  _id: string
  group: CatalogOptionGroup
  name: { sq: string; en: string }
  slug: string
  order: number
  isActive: boolean
}

function toView(doc: CatalogOptionDoc & { _id: { toString(): string } }): CatalogOptionView {
  return {
    _id: String(doc._id),
    group: doc.group,
    name: doc.name,
    slug: doc.slug,
    order: doc.order,
    isActive: doc.isActive,
  }
}

export async function listCatalogOptions(group?: CatalogOptionGroup) {
  await ensureCatalogOptions()
  const filter = {
    isActive: true,
    ...(group ? { group } : { group: { $in: [...CATALOG_OPTION_GROUPS] } }),
  }
  const options = await CatalogOption.find(filter).sort({ group: 1, order: 1, slug: 1 })
  return options.map(toView)
}

export async function listCatalogOptionValues(group: CatalogOptionGroup) {
  const options = await listCatalogOptions(group)
  return options.map((option) => (option.group === 'language' ? option.name.sq : option.slug))
}
