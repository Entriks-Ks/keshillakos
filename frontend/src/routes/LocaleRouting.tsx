import { useLayoutEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import i18n, { applyLanguage, readLanguage } from '../i18n'
import {
  getActiveLocale,
  isLocale,
  localeOfPath,
  localizedPath,
  resolveLegacyUrl,
} from './routeMap'

/**
 * The URL is the source of truth on public pages: /en/... selects English, /de/... German, Albanian slugs Albanian
 * (and the choice is saved as the preference). Runs as a layout effect so pages never paint or run effects with the
 * previous language after back/forward or a shared link.
 */
export function LocaleSync() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    const locale = localeOfPath(pathname)
    if (locale && (locale !== i18n.language || locale !== readLanguage())) applyLanguage(locale)
  }, [pathname])
  return null
}

/** Catch-all: old and mistyped URLs go to their localised page (ids, query and hash kept); unknown ones to the home page. */
export function LegacyRedirect() {
  const { pathname, search, hash, state } = useLocation()
  const target = resolveLegacyUrl(pathname, search, hash, getActiveLocale())
  if (target) return <Navigate to={target} replace state={state} />
  const prefix = /^\/(en|de)(?:\/|$)/.exec(pathname)?.[1]
  return <Navigate to={localizedPath('home', isLocale(prefix) ? prefix : getActiveLocale())} replace />
}
