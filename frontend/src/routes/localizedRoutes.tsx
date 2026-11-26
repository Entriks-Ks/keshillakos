import type { ReactNode } from 'react'
import { Route } from 'react-router-dom'
import { LOCALES, routePattern, type RouteKey } from './routeMap'

/** One <Route> per language for a localised page. Same element type → the page stays mounted when only the language changes. */
export function localizedRoutes(key: RouteKey, element: ReactNode) {
  return LOCALES.map((locale) => <Route key={`${key}-${locale}`} path={routePattern(key, locale)} element={element} />)
}
