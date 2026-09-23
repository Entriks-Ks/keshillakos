export const SOCIAL_LINK_KEYS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter'] as const

export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number]

export type SocialLinks = Partial<Record<SocialLinkKey, string>>

const SOCIAL_HOST_PATTERN: Record<SocialLinkKey, RegExp> = {
  instagram: /(?:^|\.)instagram\.com$/i,
  facebook: /(?:^|\.)(?:facebook\.com|fb\.com)$/i,
  linkedin: /(?:^|\.)linkedin\.com$/i,
  tiktok: /(?:^|\.)tiktok\.com$/i,
  youtube: /(?:^|\.)(?:youtube\.com|youtu\.be)$/i,
  twitter: /(?:^|\.)(?:twitter\.com|x\.com)$/i,
}

const SOCIAL_LABEL: Record<SocialLinkKey, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'X / Twitter',
}

export function socialLinkLabel(key: SocialLinkKey) {
  return SOCIAL_LABEL[key]
}

function assertSocialUrl(key: SocialLinkKey, trimmed: string) {
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(`${SOCIAL_LABEL[key]}: URL i pavlefshëm`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${SOCIAL_LABEL[key]}: URL duhet të fillojë me http:// ose https://`)
  }
  if (!SOCIAL_HOST_PATTERN[key].test(url.hostname)) {
    throw new Error(`${SOCIAL_LABEL[key]}: lidhja duhet të jetë e platformatës së duhur`)
  }
  return url.toString()
}

/** Normalize optional social URLs; empty strings clear the field. Throws on invalid URLs. */
export function normalizeSocialLinks(input?: SocialLinks | null): SocialLinks | undefined {
  if (input === undefined) return undefined
  if (input === null) return {}

  const next: SocialLinks = {}
  for (const key of SOCIAL_LINK_KEYS) {
    const raw = input[key]
    if (raw === undefined) continue
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    if (!trimmed) {
      next[key] = undefined
      continue
    }
    next[key] = assertSocialUrl(key, trimmed)
  }
  return next
}

export function applySocialLinks(target: SocialLinks | undefined, patch: SocialLinks) {
  const merged: SocialLinks = { ...(target || {}) }
  for (const key of SOCIAL_LINK_KEYS) {
    if (!(key in patch)) continue
    const value = patch[key]
    if (!value) delete merged[key]
    else merged[key] = value
  }
  return Object.keys(merged).length ? merged : undefined
}

export function hasAnySocialLink(links?: SocialLinks | null) {
  if (!links) return false
  return SOCIAL_LINK_KEYS.some((key) => Boolean(links[key]?.trim()))
}

/** Used only for mongoose schema shape; runtime validation goes through normalizeSocialLinks. */
export function socialLinksSchemaDefinition() {
  return {
    instagram: { type: String, trim: true, maxlength: 500 },
    facebook: { type: String, trim: true, maxlength: 500 },
    linkedin: { type: String, trim: true, maxlength: 500 },
    tiktok: { type: String, trim: true, maxlength: 500 },
    youtube: { type: String, trim: true, maxlength: 500 },
    twitter: { type: String, trim: true, maxlength: 500 },
  }
}
