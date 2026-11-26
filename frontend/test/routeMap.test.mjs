import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  initialLocale,
  KEEP_SCROLL_STATE,
  keepsScroll,
  LOCALES,
  localeOfPath,
  localizedPath,
  localizeHref,
  matchLocalizedPath,
  resolveLegacyUrl,
  robotsTxt,
  ROUTE_KEYS,
  routePath,
  routePattern,
  seoLinks,
  setActiveLocale,
  sitemapEntries,
  sitemapXml,
  switchLocaleUrl,
} from '../src/routes/routeMap.ts'
import { idFromPublicParam, providerPath, servicePath } from '../src/utils/publicPaths.ts'
import { vercelRedirects } from '../scripts/vercel-redirects.mjs'

const ORIGIN = 'https://example.test'
const OBJECT_ID = '64b7f0c2a1b2c3d4e5f60718'

test('every route has a distinct URL in every language', () => {
  const patterns = ROUTE_KEYS.flatMap((key) => LOCALES.map((locale) => routePattern(key, locale)))
  assert.equal(new Set(patterns).size, patterns.length, 'no two routes share a URL')
  for (const pattern of patterns) {
    assert.ok(!pattern.startsWith('/dashboard'), 'dashboards stay language-neutral')
    assert.ok(!/^\/sq(\/|$)/.test(pattern), 'Albanian has no prefix')
  }
  for (const key of ROUTE_KEYS) {
    assert.ok(!/^\/(en|de)(\/|$)/.test(routePattern(key, 'sq')), `${key}: Albanian URL is unprefixed`)
    assert.ok(routePattern(key, 'en').startsWith('/en'), `${key}: English URL under /en`)
    assert.ok(routePattern(key, 'de').startsWith('/de'), `${key}: German URL under /de`)
  }
})

test('localised paths for the main pages', () => {
  const expected = {
    home: ['/', '/en', '/de'],
    services: ['/sherbime', '/en/services', '/de/dienstleistungen'],
    experts: ['/eksperte', '/en/experts', '/de/experten'],
    companies: ['/kompani', '/en/companies', '/de/unternehmen'],
    about: ['/rreth-nesh', '/en/about', '/de/ueber-uns'],
    login: ['/kycu', '/en/login', '/de/anmelden'],
    register: ['/regjistrohu', '/en/register', '/de/registrieren'],
    privacy: ['/privatesia', '/en/privacy', '/de/datenschutz'],
  }
  for (const [key, paths] of Object.entries(expected)) {
    assert.deepEqual(LOCALES.map((locale) => localizedPath(key, locale)), paths, key)
  }
  assert.equal(localizedPath('serviceDetail', 'de', { slug: 'steuerberatung-abc1' }), '/de/dienstleistungen/steuerberatung-abc1')
  assert.equal(routePath('experts', { locale: 'en', search: '?q=tax&page=2', hash: 'list' }), '/en/experts?q=tax&page=2#list')
  assert.equal(routePath('services', { locale: 'sq', search: new URLSearchParams({ approx: '1' }) }), '/sherbime?approx=1')
})

test('routePath follows the active language', () => {
  setActiveLocale('de')
  assert.equal(routePath('login'), '/de/anmelden')
  assert.equal(servicePath({ id: OBJECT_ID, title: 'Këshillim ligjor' }), `/de/dienstleistungen/keshillim-ligjor-${OBJECT_ID}`)
  setActiveLocale('sq')
  assert.equal(routePath('login'), '/kycu')
})

test('matching localised URLs, with and without trailing slash', () => {
  assert.deepEqual(matchLocalizedPath('/en/services/tax-advice-abc1'), { key: 'serviceDetail', locale: 'en', params: { slug: 'tax-advice-abc1' } })
  assert.deepEqual(matchLocalizedPath('/sherbime/'), { key: 'services', locale: 'sq', params: {} })
  assert.deepEqual(matchLocalizedPath('/de'), { key: 'home', locale: 'de', params: {} })
  assert.deepEqual(matchLocalizedPath('/en/'), { key: 'home', locale: 'en', params: {} })
  assert.equal(matchLocalizedPath('/dashboard/user'), null)
  assert.equal(matchLocalizedPath('/ofertat'), null)
  assert.equal(matchLocalizedPath('/sq/sherbime'), null)
  assert.equal(matchLocalizedPath('/en/sherbime'), null)
  assert.equal(localeOfPath('/de/ueber-uns'), 'de')
  assert.equal(localeOfPath('/cookies'), 'sq')
  assert.equal(localeOfPath('/en/cookies'), 'en')
})

test('initial language: URL first, saved preference on neutral and old URLs', () => {
  assert.equal(initialLocale('/en/plans', 'sq'), 'en')
  assert.equal(initialLocale('/planet', 'de'), 'sq')
  assert.equal(initialLocale('/dashboard/provider', 'de'), 'de')
  assert.equal(initialLocale('/ofertat', 'en'), 'en')
  assert.equal(initialLocale('/de/unknown-page', 'sq'), 'de')
})

test('switching language keeps the page, the id, the filters and the hash', () => {
  assert.equal(switchLocaleUrl('/sherbime', '?q=tax&categoryId=law&page=2', '', 'en'), '/en/services?q=tax&categoryId=law&page=2')
  assert.equal(switchLocaleUrl('/en/experts', '?sort=rating', '', 'de'), '/de/experten?sort=rating')
  assert.equal(switchLocaleUrl('/de/dienstleistungen/beratung-abc1', '', '', 'sq'), '/sherbime/beratung-abc1')
  assert.equal(switchLocaleUrl('/ofrues/arben-k-uid1234567890abcd', '?page=2', '#vleresimet', 'en'), '/en/providers/arben-k-uid1234567890abcd?page=2#vleresimet')
  assert.equal(switchLocaleUrl('/', '', '#how', 'de'), '/de#how')
  assert.equal(switchLocaleUrl('/en', '', '', 'sq'), '/')
  assert.equal(switchLocaleUrl('/kycu', '', '', 'de'), '/de/anmelden')
  assert.equal(switchLocaleUrl('/krahaso', '?uids=a,b', '', 'en'), '/en/compare?uids=a,b')
  // Language-neutral: only the UI language changes.
  assert.equal(switchLocaleUrl('/dashboard/user/settings', '', '', 'en'), null)
  // Switching to every language and back returns the same URL.
  for (const key of ROUTE_KEYS) {
    const start = routePath(key, { locale: 'sq', params: { slug: 'x-abc1' } })
    for (const target of LOCALES) {
      const there = switchLocaleUrl(start, '', '', target)
      assert.equal(switchLocaleUrl(there, '', '', 'sq'), start, `${key} via ${target}`)
    }
  }
})

test('old URLs resolve to their localised page, keeping ids and query', () => {
  const cases = [
    ['/ofertat', '', 'sq', '/sherbime'],
    ['/ofertat', '?tab=experts&q=tax', 'sq', '/eksperte?q=tax'],
    ['/ofertat', '?tab=companies', 'en', '/en/companies'],
    ['/ofertat', '?tab=services&categoryId=law&page=3', 'de', '/de/dienstleistungen?categoryId=law&page=3'],
    ['/ofertat/', '?approx=1', 'sq', '/sherbime?approx=1'],
    ['/krahaso-avokatet', '?uids=a', 'sq', '/krahaso?uids=a'],
    [`/services/${OBJECT_ID}`, '', 'sq', `/sherbime/${OBJECT_ID}`],
    [`/services/tax-help-${OBJECT_ID}`, '', 'en', `/en/services/tax-help-${OBJECT_ID}`],
    ['/providers/Xy12ab34Cd56ef78Gh90', '#vleresimet', 'sq', '/ofrues/Xy12ab34Cd56ef78Gh90#vleresimet'],
    ['/login', '', 'sq', '/kycu'],
    ['/login', '', 'de', '/de/anmelden'],
    ['/register', '?ref=plans', 'sq', '/regjistrohu?ref=plans'],
    ['/sq', '', 'en', '/'],
    ['/sq/ofertat', '?tab=experts', 'en', '/eksperte'],
    ['/sq/rreth-nesh', '', 'en', '/rreth-nesh'],
    ['/en/sherbime', '?q=x', 'sq', '/en/services?q=x'],
    ['/de/about', '', 'sq', '/de/ueber-uns'],
  ]
  for (const [pathname, search, fallback, expected] of cases) {
    const [path, hash = ''] = pathname.split('#')
    const searchPart = search.startsWith('#') ? '' : search
    const hashPart = search.startsWith('#') ? search : hash
    assert.equal(resolveLegacyUrl(path, searchPart, hashPart, fallback), expected, `${pathname}${search}`)
  }
})

test('redirect targets are final (no loops, no chains) and unknown URLs are left alone', () => {
  const olds = ['/ofertat', '/krahaso-avokatet', '/services/x-abc1', '/providers/uid1234567890abcdef', '/login', '/register', '/sq/kushtet', '/en/sherbime']
  for (const old of olds) {
    for (const locale of LOCALES) {
      const target = resolveLegacyUrl(old, '?tab=experts', '', locale)
      assert.ok(target, old)
      const url = new URL(target, ORIGIN)
      assert.ok(matchLocalizedPath(url.pathname), `${old} → ${target} is a real page`)
      assert.equal(resolveLegacyUrl(url.pathname, url.search, '', locale), null, `${target} does not redirect again`)
    }
  }
  for (const current of ['/', '/sherbime', '/en/services', '/de/anmelden', '/rreth-nesh', '/cookies']) {
    assert.equal(resolveLegacyUrl(current, '', '', 'en'), null, current)
  }
  assert.equal(resolveLegacyUrl('/dashboard/user', '', '', 'sq'), null)
  assert.equal(resolveLegacyUrl('/no-such-page', '', '', 'sq'), null)
})

test('links from AI answers and stored data are localised', () => {
  assert.equal(localizeHref(`/services/${OBJECT_ID}`, 'en'), `/en/services/${OBJECT_ID}`)
  assert.equal(localizeHref('/ofertat?category=law', 'de'), '/de/dienstleistungen?category=law')
  assert.equal(localizeHref('/providers/uid1234567890abcdef', 'sq'), '/ofrues/uid1234567890abcdef')
  assert.equal(localizeHref('/dashboard/admin/reports', 'en'), '/dashboard/admin/reports')
  assert.equal(localizeHref('/en/experts', 'sq'), '/en/experts')
  assert.equal(localizeHref('https://example.org/x', 'en'), 'https://example.org/x')
})

test('service and profile URLs keep the slug-id strategy in every language', () => {
  const service = { id: OBJECT_ID, title: 'Hartimi i kontratës së punës' }
  for (const locale of LOCALES) {
    const path = servicePath(service, locale)
    const match = matchLocalizedPath(path)
    assert.equal(match.key, 'serviceDetail')
    assert.equal(idFromPublicParam(match.params.slug), OBJECT_ID, path)
  }
  assert.equal(servicePath(service, 'sq'), `/sherbime/hartimi-i-kontrates-se-punes-${OBJECT_ID}`)
  const provider = { uid: 'Xy12ab34Cd56ef78Gh90', name: 'Arbër Krasniqi' }
  assert.equal(providerPath(provider, 'de'), '/de/anbieter/arber-krasniqi-Xy12ab34Cd56ef78Gh90')
  assert.equal(idFromPublicParam(matchLocalizedPath(providerPath(provider, 'en')).params.slug), provider.uid)
  // Old bare-id links still resolve to the same entity.
  assert.equal(idFromPublicParam(matchLocalizedPath(resolveLegacyUrl(`/services/${OBJECT_ID}`, '', '', 'sq')).params.slug), OBJECT_ID)
})

test('SEO: self canonical + hreflang (sq/en/de/x-default) for translated pages', () => {
  const links = seoLinks(matchLocalizedPath('/en/experts'), '?q=tax&page=2&sort=rating', ORIGIN)
  assert.equal(links.canonical, `${ORIGIN}/en/experts?page=2`)
  assert.equal(links.robots, 'index, follow')
  assert.deepEqual(links.alternates, [
    { hreflang: 'sq', href: `${ORIGIN}/eksperte?page=2` },
    { hreflang: 'en', href: `${ORIGIN}/en/experts?page=2` },
    { hreflang: 'de', href: `${ORIGIN}/de/experten?page=2` },
    { hreflang: 'x-default', href: `${ORIGIN}/eksperte?page=2` },
  ])
  assert.equal(seoLinks(matchLocalizedPath('/sherbime'), '?page=1', ORIGIN).canonical, `${ORIGIN}/sherbime`)
  assert.equal(seoLinks(matchLocalizedPath('/de'), '', ORIGIN).canonical, `${ORIGIN}/de`)
})

test('SEO: untranslated user content canonicalises to Albanian; auth pages are noindex', () => {
  const service = seoLinks(matchLocalizedPath('/de/dienstleistungen/beratung-abc1'), '?x=1', ORIGIN)
  assert.equal(service.canonical, `${ORIGIN}/sherbime/beratung-abc1`)
  assert.deepEqual(service.alternates, [])
  const login = seoLinks(matchLocalizedPath('/en/login'), '', ORIGIN)
  assert.equal(login.robots, 'noindex, follow')
  assert.deepEqual(login.alternates, [])
})

test('sitemap lists every translated page in every language with alternates', () => {
  const entries = sitemapEntries(ORIGIN)
  const locs = entries.map((entry) => entry.loc)
  assert.equal(new Set(locs).size, locs.length)
  assert.ok(locs.includes(`${ORIGIN}/`))
  assert.ok(locs.includes(`${ORIGIN}/de/ueber-uns`))
  assert.ok(locs.includes(`${ORIGIN}/en/services`))
  assert.ok(!locs.some((loc) => /kycu|login|anmelden|regjistrohu|register|dashboard|:slug/.test(loc)))
  for (const entry of entries) assert.equal(entry.alternates.length, 4)
  const xml = sitemapXml(ORIGIN)
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/)
  assert.match(xml, /<xhtml:link rel="alternate" hreflang="x-default" href="https:\/\/example\.test\/eksperte"\/>/)
  assert.match(robotsTxt(ORIGIN), /Disallow: \/dashboard\n\nSitemap: https:\/\/example\.test\/sitemap\.xml/)
  assert.doesNotMatch(robotsTxt(null), /Sitemap/)
})

test('vercel.json permanent redirects match the route map', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.deepEqual(config.redirects, vercelRedirects(), 'run: node --experimental-strip-types scripts/vercel-redirects.mjs --write')
  for (const rule of config.redirects) {
    assert.equal(rule.permanent, true)
    const destination = rule.destination.replace(':slug', 'x-abc1').replace(':path*', 'rreth-nesh')
    assert.ok(matchLocalizedPath(destination), `${rule.source} → ${rule.destination} lands on a real page`)
  }
  assert.ok(config.rewrites.some((rule) => rule.destination === '/index.html'), 'SPA rewrite kept')
})

test('same-page navigations keep the scroll position', () => {
  assert.equal(keepsScroll(KEEP_SCROLL_STATE), true)
  assert.equal(keepsScroll({ ...KEEP_SCROLL_STATE, section: 'x' }), true)
  assert.equal(keepsScroll(null), false)
  assert.equal(keepsScroll({}), false)
})
