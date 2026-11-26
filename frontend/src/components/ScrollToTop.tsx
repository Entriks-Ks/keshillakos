import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { keepsScroll } from '../routes/routeMap'

export default function ScrollToTop() {
  const { pathname, search, hash, key, state } = useLocation()
  const navigationType = useNavigationType()
  const previousPathname = useRef(pathname)

  useLayoutEffect(() => {
    const pathnameChanged = previousPathname.current !== pathname
    previousPathname.current = pathname
    // Back/forward keeps the browser's restored position; same-page replace syncs (listing filters) and in-page anchors keep theirs.
    if (navigationType === 'POP') return
    // Same page under another URL (language switch, marketplace tab): stay where the reader is.
    if (keepsScroll(state)) return
    if (pathnameChanged || (navigationType === 'PUSH' && !hash)) window.scrollTo(0, 0)
  }, [pathname, search, hash, key, state, navigationType])

  return null
}
