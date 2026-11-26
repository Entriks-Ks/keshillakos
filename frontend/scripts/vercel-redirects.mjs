// Builds the permanent (308) legacy redirects in vercel.json from src/routes/routeMap.ts.
//   node --experimental-strip-types scripts/vercel-redirects.mjs          → print the redirects
//   node --experimental-strip-types scripts/vercel-redirects.mjs --write  → update vercel.json
// test/routeMap.test.mjs fails when vercel.json is out of date.
// Hosting redirects go to the Albanian URL: old URLs never carried a language and were indexed as the Albanian
// default. Vercel forwards the query string, so ids, filters and page numbers survive; the app drops the old `tab`.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { LEGACY_REDIRECTS, routePattern } from '../src/routes/routeMap.ts'

export function vercelRedirects() {
  const legacy = LEGACY_REDIRECTS.map((rule) => ({
    source: rule.from,
    ...(rule.when ? { has: [{ type: 'query', key: rule.when.query, value: rule.when.value }] } : {}),
    destination: routePattern(rule.to, 'sq'),
    permanent: true,
  }))
  return [
    ...legacy,
    // Albanian has no prefix; /sq/... is a common guess.
    { source: '/sq', destination: '/', permanent: true },
    { source: '/sq/:path*', destination: '/:path*', permanent: true },
  ]
}

const configPath = fileURLToPath(new URL('../vercel.json', import.meta.url))

export function vercelConfig() {
  const current = JSON.parse(readFileSync(configPath, 'utf8'))
  const { $schema, ...rest } = current
  return { $schema, redirects: vercelRedirects(), ...Object.fromEntries(Object.entries(rest).filter(([key]) => key !== 'redirects')) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--write')) {
    writeFileSync(configPath, `${JSON.stringify(vercelConfig(), null, 2)}\n`)
    console.log(`Updated ${configPath}`)
  } else {
    console.log(JSON.stringify(vercelRedirects(), null, 2))
  }
}
