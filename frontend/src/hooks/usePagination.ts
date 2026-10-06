import { useCallback, useState } from 'react'
import { emptyPagination, type PaginationMeta } from '../api/pagination'
export function usePagination(resetKey = '') {
  const [state, setState] = useState({ key: resetKey, page: 1 })
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination)
  const page = state.key === resetKey ? state.page : 1
  const setPage = useCallback((next: number) => setState({ key: resetKey, page: next }), [resetKey])
  const receivePagination = useCallback((meta: PaginationMeta) => { setPagination(meta); setPage(meta.page) }, [setPage])
  return { page, setPage, pagination, receivePagination }
}
