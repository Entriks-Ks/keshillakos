import { Star } from 'lucide-react'
import i18n, { uiText } from '../i18n'

function dateLocale() {
  const language = (i18n.language || 'sq').toLowerCase()
  if (language.startsWith('de')) return 'de-DE'
  if (language.startsWith('en')) return 'en-GB'
  return 'sq-AL'
}

export function ratingWord(average: number, count: number) {
  if (count <= 0) return uiText('Ende pa vlerësime', 'No ratings yet', 'Noch keine Bewertungen')
  if (average >= 4.8) return uiText('Shkëlqyeshëm', 'Excellent', 'Ausgezeichnet')
  if (average >= 4) return uiText('Shumë mirë', 'Very good', 'Sehr gut')
  if (average >= 3) return uiText('Mirë', 'Good', 'Gut')
  return uiText('Në përmirësim', 'Needs improvement', 'Ausbaufähig')
}

export function formatReviewDate(value: string) {
  try {
    return new Date(value).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return value
  }
}

export function StarRow({ value, size = 16, label }: { value: number; size?: number; label?: string }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)))
  return (
    <span className="tt-star-row" aria-label={label} aria-hidden={!label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          strokeWidth={1.6}
          className={star <= filled ? 'is-filled' : undefined}
        />
      ))}
    </span>
  )
}

export function ratingBuckets(scores: number[]) {
  const total = scores.length || 1
  return [5, 4, 3, 2, 1].map((stars) => {
    const n = scores.filter((score) => score === stars).length
    return { stars, count: n, pct: Math.round((n / total) * 100) }
  })
}
