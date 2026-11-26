/*
 * Single source of truth for public, language-aware URLs.
 *
 * Albanian (sq) is the default language and has no prefix; English and German live under /en and /de with their own
 * slugs. Dashboards (/dashboard/...) stay language-neutral: they are private, never indexed, and the backend writes
 * /dashboard links into notifications. Pure module (no React, no i18next) so node tests, vite.config.ts and the
 * Vercel redirect check can import it.
 */

export const LOCALES = ['sq', 'en', 'de'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'sq'

export const LOCALE_PREFIX: Record<Locale, string> = { sq: '', en: '/en', de: '/de' }

/** BCP-47 tags for hreflang / og:locale. */
export const LOCALE_TAG: Record<Locale, string> = { sq: 'sq-AL', en: 'en-GB', de: 'de-DE' }

export type RouteKey =
  | 'home'
  | 'services'
  | 'experts'
  | 'companies'
  | 'serviceDetail'
  | 'provider'
  | 'compare'
  | 'community'
  | 'aiAssistant'
  | 'plans'
  | 'about'
  | 'terms'
  | 'privacy'
  | 'cookies'
  | 'login'
  | 'register'

export type RouteParams = { slug?: string }

type RouteDefinition = {
  /** Path after the language prefix. `:slug` marks the single dynamic segment. */
  paths: Record<Locale, string>
  /**
   * `translated`: every language is a real translation → hreflang alternates, sitemap entries, self canonical.
   * `sq-content`: only the UI chrome is translated (user-written service/profile text stays in its original
   *   language) → en/de canonicalise to the Albanian URL and get no hreflang.
   * `noindex`: usable in every language but kept out of search results (auth pages).
   */
  seo: 'translated' | 'sq-content' | 'noindex'
  /** Query params that change the page content enough to keep in the canonical URL. */
  canonicalParams?: readonly string[]
}

export const ROUTES: Record<RouteKey, RouteDefinition> = {
  home: { paths: { sq: '/', en: '/', de: '/' }, seo: 'translated' },
  services: { paths: { sq: '/sherbime', en: '/services', de: '/dienstleistungen' }, seo: 'translated', canonicalParams: ['page'] },
  experts: { paths: { sq: '/eksperte', en: '/experts', de: '/experten' }, seo: 'translated', canonicalParams: ['page'] },
  companies: { paths: { sq: '/kompani', en: '/companies', de: '/unternehmen' }, seo: 'translated', canonicalParams: ['page'] },
  serviceDetail: { paths: { sq: '/sherbime/:slug', en: '/services/:slug', de: '/dienstleistungen/:slug' }, seo: 'sq-content' },
  provider: { paths: { sq: '/ofrues/:slug', en: '/providers/:slug', de: '/anbieter/:slug' }, seo: 'sq-content' },
  compare: { paths: { sq: '/krahaso', en: '/compare', de: '/vergleich' }, seo: 'translated' },
  community: { paths: { sq: '/komuniteti', en: '/community', de: '/community' }, seo: 'translated' },
  aiAssistant: { paths: { sq: '/ai-asistenti', en: '/ai-assistant', de: '/ki-assistent' }, seo: 'translated' },
  plans: { paths: { sq: '/planet', en: '/plans', de: '/tarife' }, seo: 'translated' },
  about: { paths: { sq: '/rreth-nesh', en: '/about', de: '/ueber-uns' }, seo: 'translated' },
  terms: { paths: { sq: '/kushtet', en: '/terms', de: '/agb' }, seo: 'translated' },
  privacy: { paths: { sq: '/privatesia', en: '/privacy', de: '/datenschutz' }, seo: 'translated' },
  cookies: { paths: { sq: '/cookies', en: '/cookies', de: '/cookies' }, seo: 'translated' },
  login: { paths: { sq: '/kycu', en: '/login', de: '/anmelden' }, seo: 'noindex' },
  register: { paths: { sq: '/regjistrohu', en: '/register', de: '/registrieren' }, seo: 'noindex' },
}

export const ROUTE_KEYS = Object.keys(ROUTES) as RouteKey[]

export function isLocale(value: unknown): value is Locale {
  return value === 'sq' || value === 'en' || value === 'de'
}

/* ── Active language ─────────────────────────────────────────────────────────────────────────────────────────────
 * Kept here (not read from i18next) so path builders stay dependency-free. i18n/index.ts updates it on init and on
 * every languageChanged, which happens before components re-render with the new language. */
let activeLocale: Locale = DEFAULT_LOCALE
export function getActiveLocale(): Locale {
  return activeLocale
}
export function setActiveLocale(locale: string | undefined) {
  if (isLocale(locale)) activeLocale = locale
}

/* ── Building ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/** React Router `path` pattern for a route in one language, e.g. `/en/services/:slug`. */
export function routePattern(key: RouteKey, locale: Locale): string {
  const path = ROUTES[key].paths[locale]
  if (path === '/') return LOCALE_PREFIX[locale] || '/'
  return `${LOCALE_PREFIX[locale]}${path}`
}

/** Localised pathname for a route, e.g. `localizedPath('serviceDetail', 'de', { slug: 'x-1' })` → `/de/dienstleistungen/x-1`. */
export function localizedPath(key: RouteKey, locale: Locale = activeLocale, params: RouteParams = {}): string {
  return routePattern(key, locale).replace(':slug', () => encodeURIComponent(params.slug ?? ''))
}

/** `routePath('experts', { search: '?q=x' })` in the active language. */
export function routePath(
  key: RouteKey,
  options: { params?: RouteParams; search?: string | URLSearchParams; hash?: string; locale?: Locale } = {},
): string {
  const search = typeof options.search === 'string' ? options.search.replace(/^\?/, '') : options.search?.toString() ?? ''
  const hash = (options.hash ?? '').replace(/^#/, '')
  return `${localizedPath(key, options.locale ?? activeLocale, options.params)}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`
}

/* ── Matching ───────────────────────────────────────────────────────────────────────────────────────────────────── */

export type RouteMatch = { key: RouteKey; locale: Locale; params: RouteParams }

function normalizePathname(pathname: string) {
  const clean = (pathname || '/').split(/[?#]/)[0]
  const trimmed = clean.replace(/\/+$/, '')
  return trimmed || '/'
}

function splitLocalePrefix(pathname: string): { locale: Locale; rest: string; prefixed: boolean } {
  const path = normalizePathname(pathname)
  const match = /^\/(en|de|sq)(\/.*)?$/.exec(path)
  if (match && isLocale(match[1])) return { locale: match[1], rest: match[2] || '/', prefixed: true }
  return { locale: DEFAULT_LOCALE, rest: path, prefixed: false }
}

function matchPath(pattern: string, path: string): RouteParams | null {
  if (!pattern.includes(':slug')) return pattern === path ? {} : null
  const [before, after] = pattern.split(':slug')
  if (!path.startsWith(before) || !path.endsWith(after)) return null
  const raw = path.slice(before.length, path.length - after.length)
  if (!raw || raw.includes('/')) return null
  try {
    return { slug: decodeURIComponent(raw) }
  } catch {
    return { slug: raw }
  }
}

/** Exact match of a localised URL (`/en/services/x` → serviceDetail/en). `/sq/...` is not canonical and never matches. */
export function matchLocalizedPath(pathname: string): RouteMatch | null {
  const { locale, rest, prefixed } = splitLocalePrefix(pathname)
  if (prefixed && locale === DEFAULT_LOCALE) return null
  for (const key of ROUTE_KEYS) {
    const params = matchPath(ROUTES[key].paths[locale], rest)
    if (params) return { key, locale, params }
  }
  return null
}

/** The route key of a pathname (any language), or null for dashboards and unknown paths. */
export function routeKeyOf(pathname: string): RouteKey | null {
  return matchLocalizedPath(pathname)?.key ?? null
}

/** Language the URL itself asks for, or null when the path is language-neutral (dashboards, legacy or unknown URLs). */
export function localeOfPath(pathname: string): Locale | null {
  return matchLocalizedPath(pathname)?.locale ?? null
}

/** Initial UI language: a localised URL wins; language-neutral paths keep the saved preference. */
export function initialLocale(pathname: string, saved: Locale): Locale {
  const fromPath = localeOfPath(pathname)
  if (fromPath) return fromPath
  const { locale, prefixed } = splitLocalePrefix(pathname)
  return prefixed ? locale : saved
}

/** History state for navigations that show the same page under another URL (language switch, marketplace tab). */
export const KEEP_SCROLL_STATE = { kkKeepScroll: true } as const

export function keepsScroll(state: unknown) {
  return typeof state === 'object' && state !== null && (state as { kkKeepScroll?: unknown }).kkKeepScroll === true
}

/* ── Language switching ─────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * URL of the same page in another language, keeping the entity id, query string (filters, page, tab state) and hash.
 * Returns null for language-neutral paths (dashboards), where only the UI language changes.
 */
export function switchLocaleUrl(pathname: string, search: string, hash: string, target: Locale): string | null {
  const match = matchLocalizedPath(pathname)
  if (!match) return null
  return routePath(match.key, { locale: target, params: match.params, search, hash })
}

/* ── Backward compatibility ─────────────────────────────────────────────────────────────────────────────────────── */

type LegacyRule = {
  from: string
  to: RouteKey
  /** Only when `?query=value` is present. Rules are checked top to bottom. */
  when?: { query: string; value: string }
  /** Query params that the new URL expresses in the path and must drop. */
  dropParams?: readonly string[]
}

/**
 * URLs that existed before localisation. All of them were Albanian-default pages. Paths whose Albanian slug did not
 * change (/rreth-nesh, /planet, /kushtet, /privatesia, /cookies, /krahaso, /komuniteti, /ai-asistenti, /) need no rule.
 * The same list drives vercel.json (see scripts/vercel-redirects.mjs; a test keeps them in sync).
 */
export const LEGACY_REDIRECTS: readonly LegacyRule[] = [
  { from: '/ofertat', when: { query: 'tab', value: 'experts' }, to: 'experts', dropParams: ['tab'] },
  { from: '/ofertat', when: { query: 'tab', value: 'companies' }, to: 'companies', dropParams: ['tab'] },
  { from: '/ofertat', to: 'services', dropParams: ['tab'] },
  { from: '/krahaso-avokatet', to: 'compare' },
  { from: '/services/:slug', to: 'serviceDetail' },
  { from: '/providers/:slug', to: 'provider' },
  { from: '/login', to: 'login' },
  { from: '/register', to: 'register' },
]

function withoutParams(search: string, drop: readonly string[] = []) {
  const params = new URLSearchParams(search)
  for (const key of drop) params.delete(key)
  return params.toString()
}

/**
 * Where an old or mistyped URL should go, or null when it is already canonical / unknown.
 * `fallbackLocale` is used for unprefixed legacy URLs (they never carried a language; the UI used the saved preference).
 * Handles: the legacy table above, `/sq/...` prefixes, and slugs of another language (`/en/sherbime` → `/en/services`).
 */
export function resolveLegacyUrl(pathname: string, search: string, hash: string, fallbackLocale: Locale): string | null {
  if (matchLocalizedPath(pathname)) return null
  const { locale: prefixLocale, rest, prefixed } = splitLocalePrefix(pathname)
  const locale = prefixed ? prefixLocale : fallbackLocale
  const params = new URLSearchParams(search)

  if (!prefixed || prefixLocale === DEFAULT_LOCALE) {
    for (const rule of LEGACY_REDIRECTS) {
      const routeParams = matchPath(rule.from, rest)
      if (!routeParams) continue
      if (rule.when && params.get(rule.when.query) !== rule.when.value) continue
      return routePath(rule.to, { locale, params: routeParams, search: withoutParams(search, rule.dropParams), hash })
    }
  }

  // A slug from another language under this prefix, or `/sq/<albanian slug>`.
  for (const key of ROUTE_KEYS) {
    for (const other of LOCALES) {
      const routeParams = matchPath(ROUTES[key].paths[other], rest)
      if (routeParams) return routePath(key, { locale, params: routeParams, search, hash })
    }
  }
  return null
}

/**
 * In-app link from data we do not control (AI chat answers, stored links): old URLs become the localised URL in the
 * active language; everything else (dashboards, external links, already-localised paths) is returned unchanged.
 */
export function localizeHref(href: string, locale: Locale = activeLocale): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href
  const url = new URL(href, 'http://local')
  return resolveLegacyUrl(url.pathname, url.search, url.hash, locale) ?? href
}

/* ── SEO ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

export type SeoLinks = {
  canonical: string
  /** hreflang → absolute URL. Empty when the page has no real translations. */
  alternates: { hreflang: string; href: string }[]
  robots: 'index, follow' | 'noindex, follow'
}

function canonicalSearch(key: RouteKey, search: string) {
  const keep = ROUTES[key].canonicalParams ?? []
  const params = new URLSearchParams(search)
  const out = new URLSearchParams()
  for (const name of keep) {
    const value = params.get(name)
    if (value && !(name === 'page' && value === '1')) out.set(name, value)
  }
  return out.toString()
}

/** Canonical URL, hreflang alternates and robots value for a localised page. `origin` has no trailing slash. */
export function seoLinks(match: RouteMatch, search: string, origin: string): SeoLinks {
  const { key, locale, params } = match
  const { seo } = ROUTES[key]
  const query = canonicalSearch(key, search)
  const url = (target: Locale) => `${origin}${routePath(key, { locale: target, params, search: query })}`

  if (seo === 'noindex') return { canonical: url(locale), alternates: [], robots: 'noindex, follow' }
  if (seo === 'sq-content') return { canonical: url(DEFAULT_LOCALE), alternates: [], robots: 'index, follow' }
  return {
    canonical: url(locale),
    alternates: [
      ...LOCALES.map((target) => ({ hreflang: target, href: url(target) })),
      { hreflang: 'x-default', href: url(DEFAULT_LOCALE) },
    ],
    robots: 'index, follow',
  }
}

/** Static, indexable URLs for sitemap.xml: one entry per language with its hreflang alternates. */
export function sitemapEntries(origin: string) {
  return ROUTE_KEYS.filter((key) => ROUTES[key].seo === 'translated').flatMap((key) =>
    LOCALES.map((locale) => ({
      loc: `${origin}${localizedPath(key, locale)}`,
      alternates: [
        ...LOCALES.map((target) => ({ hreflang: target, href: `${origin}${localizedPath(key, target)}` })),
        { hreflang: 'x-default', href: `${origin}${localizedPath(key, DEFAULT_LOCALE)}` },
      ],
    })),
  )
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function sitemapXml(origin: string) {
  const urls = sitemapEntries(origin).map((entry) => [
    '  <url>',
    `    <loc>${escapeXml(entry.loc)}</loc>`,
    ...entry.alternates.map((alt) => `    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${escapeXml(alt.href)}"/>`),
    '  </url>',
  ].join('\n'))
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

export function robotsTxt(origin: string | null) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /dashboard',
    ...(origin ? ['', `Sitemap: ${origin}/sitemap.xml`] : []),
    '',
  ].join('\n')
}
