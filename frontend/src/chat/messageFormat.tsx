import type { ReactNode } from 'react'
import { dateLocale } from '../i18n'

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g
const TRAILING_PUNCTUATION = /[.,!?;:)\]]+$/
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\s)+$/u

/** Plain text with http(s) links made clickable; everything else stays text. */
export function linkify(text: string): ReactNode[] {
  return text.split(URL_PATTERN).map((part, index) => {
    if (index % 2 === 0) return part
    const trailing = part.match(TRAILING_PUNCTUATION)?.[0] ?? ''
    const href = trailing ? part.slice(0, -trailing.length) : part
    return [
      <a key={index} href={href} target="_blank" rel="noopener noreferrer nofollow">{href}</a>,
      trailing,
    ]
  }).flat()
}

/** One to three emoji with no other text are shown large, without a bubble. */
export function isEmojiOnly(text: string) {
  const trimmed = text.trim()
  if (!trimmed || !EMOJI_ONLY.test(trimmed)) return false
  return (trimmed.match(/\p{Extended_Pictographic}/gu)?.length ?? 0) <= 3
}

export function formatClock(iso?: string) {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
}
