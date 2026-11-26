import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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

// https://vite.dev/config/
// LiveKit WebRTC Cloud enabled: wss://keshillakos-zy51rpqv.livekit.cloud
export default defineConfig({
  plugins: [react(), tailwindcss()],
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