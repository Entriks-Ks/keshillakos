import type { RequestHandler } from 'express'

export type PaginationInput = { page: number; limit: number }
export type PaginationMeta = PaginationInput & { total: number; totalPages: number }

export function paginationInput(query: Record<string, unknown>, defaultLimit = 12): PaginationInput {
  const parse = (value: unknown, fallback: number) => {
    if (value === undefined) return fallback
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Faqja dhe kufiri duhet të jenë numra të plotë pozitivë')
    return Number(value)
  }
  return { page: parse(query.page, 1), limit: Math.min(parse(query.limit, defaultLimit), 100) }
}
export const validatePagination: RequestHandler = (req, res, next) => {
  try { paginationInput(req.query); for (const key of ['expertsPage', 'invitationsPage', 'publishedPage']) if (req.query[key] !== undefined) paginationInput({ page: req.query[key] }); next() }
  catch (error) { res.status(400).json({ message: error instanceof Error ? error.message : 'Faqe e pavlefshme' }) }
}
export function paginationMeta(input: PaginationInput, total: number): PaginationMeta {
  const totalPages = Math.ceil(total / input.limit)
  return { ...input, page: Math.min(input.page, Math.max(1, totalPages)), total, totalPages }
}
/** Derived collections combine canonical and legacy records before paging on the server. */
export function paginateItems<T>(items: T[], input: PaginationInput) {
  const pagination = paginationMeta(input, items.length)
  const start = (pagination.page - 1) * pagination.limit
  return { items: items.slice(start, start + pagination.limit), pagination }
}
/** Count before applying an offset; clamp after deletions so the last page stays valid. */
export async function queryPage<T>(input: PaginationInput, count: () => PromiseLike<number>, read: (skip: number, limit: number) => PromiseLike<T[]>) {
  let pagination = paginationMeta(input, await count())
  let items = await read((pagination.page - 1) * pagination.limit, pagination.limit)
  // A deletion can also happen between the count and the read.
  if (!items.length && pagination.page > 1) {
    pagination = paginationMeta(input, await count())
    items = await read((pagination.page - 1) * pagination.limit, pagination.limit)
  }
  return { items, pagination }
}
