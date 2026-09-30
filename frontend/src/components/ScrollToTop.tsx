import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname, search, hash, key } = useLocation()
  const navigationType = useNavigationType()
  const previousPathname = useRef(pathname)

  useLayoutEffect(() => {
    const pathnameChanged = previousPathname.current !== pathname
    previousPathname.current = pathname
    // Back/forward keeps the browser's restored position; same-page replace syncs (listing filters) and in-page anchors keep theirs.
    if (navigationType === 'POP') return
    if (pathnameChanged || (navigationType === 'PUSH' && !hash)) window.scrollTo(0, 0)
  }, [pathname, search, hash, key, navigationType])

  return null
}
