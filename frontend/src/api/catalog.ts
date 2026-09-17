import api from './auth'

export type CatalogName = { sq: string; en: string }

export type CatalogCategory = {
  _id: string
  name: CatalogName
  slug: string
  order: number
  isActive: boolean
}

export type CatalogSubcategory = CatalogCategory & { categoryId: string }

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
