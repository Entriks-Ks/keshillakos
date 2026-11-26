/** Number of designed default covers in ProfileCover.css (`data-variant="0"` … `"5"`). */
export const DEFAULT_COVER_VARIANTS = 6

/**
 * Default cover for an account without its own cover, chosen from the account id (FNV-1a hash).
 * The same account always gets the same design, on every page, browser and refresh; different accounts are spread
 * across the variants. Use the account uid so the editor preview and the public profile match.
 */
export function defaultCoverVariant(seed: string) {
  return seedHash(seed) % DEFAULT_COVER_VARIANTS
}

/**
 * Where the design's light glow sits and which way its gradient runs, also from the account id. Two accounts that share a design still look
 * clearly different, and each account looks the same everywhere.
 */
export function defaultCoverGlow(seed: string) {
  const hash = seedHash(`${seed}:glow`)
  return { x: 8 + (hash % 85), y: -30 + ((hash >>> 8) % 160), angle: 95 + ((hash >>> 16) % 170) }
}

function seedHash(seed: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
