import { useCallback, useSyncExternalStore } from 'react'

/** Width at and below which dialogs open as a bottom sheet instead of a centred modal or floating window. */
export const SHEET_QUERY = '(max-width: 640px)'

/** Live `window.matchMedia` result, re-rendering when the query starts or stops matching. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
