import api from './auth'

export type CatalogName = { sq: string; en: string }

export type ExtensionField = {
  key: string
  type: 'string' | 'number' | 'boolean' | 'stringArray'
  required?: boolean
  mustBeTrue?: boolean
  allowedValues?: string[]
  oneOfGroup?: string
  defaultValue?: unknown
}

export type CatalogCategory = {
  _id: string
  name: CatalogName
  slug: string
  order: number
  isActive: boolean
  requirements?: string[]
  extensionFields?: ExtensionField[]
  guidelines?: Record<string, string> | { sq?: string; en?: string }
}

export type CatalogSubcategory = CatalogCategory & { categoryId: string }

export type CatalogOptionGroup = 'language' | 'delivery-mode' | 'audience' | 'offer-type' | 'availability'

export type CatalogOption = {
  _id: string
  group: CatalogOptionGroup
  name: CatalogName
  slug: string
  order: number
  isActive: boolean
}

export function catalogOptionLabel(option: CatalogOption, language: 'sq' | 'en' = 'sq') {
  return option.name[language] || option.name.sq
}

/** Value stored on services/profiles: languages keep Albanian labels; other groups use slug. */
export function catalogOptionValue(option: CatalogOption) {
  if (option.group === 'language') return option.name.sq
  // ServiceOffer availability enums use underscores; catalog slugs stay hyphenated.
  if (option.group === 'availability') return option.slug.replace(/-/g, '_')
  return option.slug
}

export async function fetchCategories(signal?: AbortSignal) {
  const { data } = await api.get<{ categories: CatalogCategory[] }>('/api/v1/categories', { signal })
  return data.categories
}

export async function fetchSubcategories(categoryId: string, signal?: AbortSignal) {
  const { data } = await api.get<{ subcategories: CatalogSubcategory[] }>(
    `/api/v1/categories/${encodeURIComponent(categoryId)}/subcategories`,
    { signal },
  )
  return data.subcategories
}

export async function fetchCatalogOptions(group?: CatalogOptionGroup, signal?: AbortSignal) {
  const { data } = await api.get<{ options: CatalogOption[] }>('/api/v1/catalog-options', {
    params: group ? { group } : undefined,
    signal,
  })
  return data.options
}
