import { Star } from 'lucide-react'

export function ratingWord(average: number, count: number) {
  if (count <= 0) return 'Ende pa vlerësime'
  if (average >= 4.8) return 'Shkëlqyeshëm'
  if (average >= 4) return 'Shumë mirë'
  if (average >= 3) return 'Mirë'
  return 'Në përmirësim'
}

export function formatReviewDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('sq-AL', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return value
  }
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : ''
  return `${first}${last}`.toUpperCase()
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
