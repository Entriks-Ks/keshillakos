import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LOCALE_TAG, LOCALES, matchLocalizedPath, seoLinks } from './routeMap'
import { PageMetaContext, type PageMetaOverride } from './pageMeta'

const SEO_ATTR = 'data-kk-seo'
const DESCRIPTION_LIMIT = 160

function upsertMeta(attr: 'name' | 'property', key: string, content: string | null) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (content === null) {
    tag?.remove()
    return
  }
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.content = content
}

function replaceManagedLinks(links: { rel: string; href: string; hreflang?: string }[]) {
  document.head.querySelectorAll(`link[${SEO_ATTR}]`).forEach((node) => node.remove())
  for (const { rel, href, hreflang } of links) {
    const link = document.createElement('link')
    link.rel = rel
    link.href = href
    if (hreflang) link.hreflang = hreflang
    link.setAttribute(SEO_ATTR, '')
    document.head.appendChild(link)
  }
}

function replaceLocaleAlternates(locales: string[]) {
  document.head.querySelectorAll('meta[property="og:locale:alternate"]').forEach((node) => node.remove())
  for (const locale of locales) {
    const tag = document.createElement('meta')
    tag.setAttribute('property', 'og:locale:alternate')
    tag.content = locale
    document.head.appendChild(tag)
  }
}

function clip(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > DESCRIPTION_LIMIT ? `${clean.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…` : clean
}

const ogLocale = (tag: string) => tag.replace('-', '_')

/**
 * Title, description, canonical, hreflang, robots and Open Graph tags for the current URL, in the URL's language.
 * Pages with data-driven titles (service, profile) pass them with `usePageMeta`.
 */
export function SeoProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<PageMetaOverride | null>(null)
  const { pathname, search } = useLocation()
  const { t, i18n } = useTranslation()

  useEffect(() => {
    const match = matchLocalizedPath(pathname)
    const page = override?.pathname === pathname ? override : null

    if (!match) {
      // Dashboards and redirects: private, language-neutral, never indexed.
      document.title = t('seo.default.title')
      upsertMeta('name', 'robots', 'noindex, nofollow')
      upsertMeta('name', 'description', t('seo.default.description'))
      upsertMeta('property', 'og:url', null)
      replaceManagedLinks([])
      replaceLocaleAlternates([])
      return
    }

    const links = seoLinks(match, search, window.location.origin)
    const title = page?.title ? t('seo.pageTitle', { title: page.title }) : t(`seo.${match.key}.title`)
    const description = clip(page?.description || t(`seo.${match.key}.description`))

    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', links.robots)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', links.canonical)
    upsertMeta('property', 'og:locale', ogLocale(LOCALE_TAG[match.locale]))
    replaceLocaleAlternates(
      links.alternates.length ? LOCALES.filter((locale) => locale !== match.locale).map((locale) => ogLocale(LOCALE_TAG[locale])) : [],
    )
    replaceManagedLinks([
      { rel: 'canonical', href: links.canonical },
      ...links.alternates.map((alt) => ({ rel: 'alternate', href: alt.href, hreflang: alt.hreflang })),
    ])
  }, [pathname, search, override, t, i18n.language])

  return <PageMetaContext.Provider value={setOverride}>{children}</PageMetaContext.Provider>
}
