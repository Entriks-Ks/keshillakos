import { createContext, useContext, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export type PageMeta = { title?: string; description?: string }
export type PageMetaOverride = PageMeta & { pathname: string }

export const PageMetaContext = createContext<(meta: PageMetaOverride | null) => void>(() => undefined)

/** Data-driven title/description for the current page (e.g. the service title once it has loaded). */
export function usePageMeta(meta: PageMeta | null | undefined) {
  const setOverride = useContext(PageMetaContext)
  const { pathname } = useLocation()
  const title = meta?.title?.trim() || undefined
  const description = meta?.description?.trim() || undefined

  useEffect(() => {
    if (!title && !description) return
    setOverride({ pathname, title, description })
    return () => setOverride(null)
  }, [setOverride, pathname, title, description])
}
