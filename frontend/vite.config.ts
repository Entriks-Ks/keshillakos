import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { robotsTxt, sitemapXml } from './src/routes/routeMap.ts'

/*
 * Hover styles only on devices that can hover.
 * On phones and tablets a tap applies `:hover` and leaves it stuck until the next tap elsewhere. This wraps every rule
 * whose selector uses `:hover` in `@media (hover: hover)`, so mouse and trackpad users keep exactly the same hover
 * styles while touch screens rely on the press feedback in index.css. Selectors without `:hover` in the same rule
 * (e.g. `:focus-visible`) stay unconditional; rules already inside a hover media query and `:not(:hover)` are left alone.
 */
type CssNode = { type: string; name?: string; params?: string; parent?: CssNode }
type CssRule = CssNode & {
  selector: string
  selectors: string[]
  clone(overrides: { selectors: string[] }): CssRule
  after(node: unknown): void
  remove(): void
}
type CssAtRule = CssNode & { append(node: unknown): void }

const positiveHover = (selector: string) => /:hover\b/.test(selector.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, ''))

function hoverOnlyOnHoverDevices() {
  return {
    postcssPlugin: 'kk-hover-only-on-hover-devices',
    Rule(rule: CssRule, { AtRule }: { AtRule: new (init: { name: string; params: string }) => CssAtRule }) {
      if (!rule.selector.includes(':hover')) return
      for (let node = rule.parent; node; node = node.parent) {
        if (node.type === 'atrule' && (/keyframes$/i.test(node.name ?? '') || /\b(any-)?hover\s*:/.test(node.params ?? ''))) return
      }
      const hover = rule.selectors.filter(positiveHover)
      if (!hover.length) return
      const media = new AtRule({ name: 'media', params: '(hover: hover)' })
      media.append(rule.clone({ selectors: hover }))
      rule.after(media)
      const rest = rule.selectors.filter((selector) => !positiveHover(selector))
      if (rest.length) rule.selectors = rest
      else rule.remove()
    },
  }
}
hoverOnlyOnHoverDevices.postcss = true as const

/*
 * sitemap.xml + robots.txt from the localised route map (src/routes/routeMap.ts). Sitemap URLs must be absolute, so the
 * public origin comes from VITE_SITE_URL (e.g. https://www.example.com). Without it only robots.txt is written.
 */
function seoFiles(): Plugin {
  let origin: string | null = null
  return {
    name: 'kk-seo-files',
    apply: 'build',
    configResolved(config) {
      const value = String(config.env.VITE_SITE_URL ?? '').trim().replace(/\/+$/, '')
      origin = /^https?:\/\/[^/]+$/.test(value) ? value : null
      if (!origin) config.logger.warn('[kk-seo-files] VITE_SITE_URL is not set to an origin; sitemap.xml was not generated.')
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(origin) })
      if (origin) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(origin) })
    },
  }
}

// https://vite.dev/config/
// LiveKit WebRTC Cloud enabled: wss://keshillakos-zy51rpqv.livekit.cloud
export default defineConfig({
  plugins: [react(), tailwindcss(), seoFiles()],
  css: {
    postcss: { plugins: [hoverOnlyOnHoverDevices()] },
  },
  server: {
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react/') || id.includes('react-dom/') || id.includes('react-router-dom/')) {
              return 'vendor-react'
            }
            if (id.includes('@heroui/') || id.includes('lucide-react/')) {
              return 'vendor-ui'
            }
          }
        },
      },
    },
  },
})