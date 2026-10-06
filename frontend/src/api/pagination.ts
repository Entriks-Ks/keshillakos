export type PaginationMeta = { page: number; limit: number; total: number; totalPages: number }
export type PageParams = { page?: number; limit?: number; statuses?: string; q?: string }
export type CollectionSummary = { total?: number; free?: number; busy?: number; active?: number; offers?: number; upcoming?: number; unread?: number; statusCounts?: Record<string, number> }
export type PagedItems<T> = T[] & { pagination: PaginationMeta; summary?: CollectionSummary }
export function pagedItems<T>(items: T[], pagination: PaginationMeta, summary?: CollectionSummary): PagedItems<T> {
  return Object.assign(items, { pagination, summary })
}
export const emptyPagination: PaginationMeta = { page: 1, limit: 20, total: 0, totalPages: 0 }

export function collectionSummary(items: unknown): CollectionSummary {
  if (items && typeof items === 'object' && 'summary' in items && items.summary && typeof items.summary === 'object') return items.summary as CollectionSummary
  return {}
}
export function collectionTotal(items: unknown): number {
  if (items && typeof items === 'object' && 'pagination' in items && items.pagination && typeof items.pagination === 'object' && 'total' in items.pagination && typeof items.pagination.total === 'number') return items.pagination.total
  return Array.isArray(items) ? items.length : 0
}
