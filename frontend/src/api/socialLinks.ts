export const SOCIAL_LINK_KEYS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter'] as const

export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number]

export type SocialLinks = Partial<Record<SocialLinkKey, string>>

export const SOCIAL_LINK_LABELS: Record<SocialLinkKey, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'X / Twitter',
}

export const SOCIAL_LINK_PLACEHOLDERS: Record<SocialLinkKey, string> = {
  instagram: 'https://instagram.com/...',
  facebook: 'https://facebook.com/...',
  linkedin: 'https://linkedin.com/in/...',
  tiktok: 'https://tiktok.com/@...',
  youtube: 'https://youtube.com/...',
  twitter: 'https://x.com/...',
}

export function emptySocialLinks(): SocialLinks {
  return {
    instagram: '',
    facebook: '',
    linkedin: '',
    tiktok: '',
    youtube: '',
    twitter: '',
  }
}

export function socialLinksFrom(value?: SocialLinks | null): SocialLinks {
  const next = emptySocialLinks()
  if (!value) return next
  for (const key of SOCIAL_LINK_KEYS) next[key] = value[key] || ''
  return next
}
