import { useEffect, useMemo, useState } from 'react'
import { fetchProviderRatings, type RatingItem } from '../api/ratings'
import RateProvider from './RateProvider'

type Props = {
  providerUid: string
  providerName: string
  initialAverage?: number
  initialCount?: number
}

function ratingWord(average: number, count: number) {
  if (count <= 0) return 'Ende pa vlerësime'
  if (average >= 4.8) return 'Shkëlqyeshëm'
  if (average >= 4) return 'Shumë mirë'
  if (average >= 3) return 'Mirë'
  return 'Në përmirësim'
}

function formatReviewDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('sq-AL', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return value
  }
}

export default function ProviderReviews({
  providerUid,
  providerName,
  initialAverage = 0,
  initialCount = 0,
}: Props) {
  const [average, setAverage] = useState(initialAverage)
  const [count, setCount] = useState(initialCount)
  const [ratings, setRatings] = useState<RatingItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchProviderRatings(providerUid)
      .then((data) => {
        if (cancelled) return
        setAverage(data.stats.average)
        setCount(data.stats.count)
        setRatings(data.ratings)
      })
      .catch(() => {
        if (!cancelled) setRatings([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [providerUid])

  const comments = ratings.filter((item) => item.comment?.trim())
  const buckets = useMemo(() => {
    const total = ratings.length || 1
    return [5, 4, 3, 2, 1].map((stars) => {
      const n = ratings.filter((item) => item.score === stars).length
      return { stars, count: n, pct: Math.round((n / total) * 100) }
    })
  }, [ratings])

  return (
    <section className="tt-pro-section tt-reviews" id="vleresimet" aria-labelledby={`reviews-${providerUid}`}>
      <header className="tt-reviews-head">
        <h2 id={`reviews-${providerUid}`}>Vlerësimet</h2>
        <p className="tt-pro-rating">
          <strong>{ratingWord(average, count)}</strong>
          {count > 0 ? (
            <>
              <span className="tt-pro-rating-score">{average.toFixed(1)}</span>
              <span className="tt-pro-stars" aria-hidden>
                {'★'.repeat(Math.round(average))}
                {'☆'.repeat(5 - Math.round(average))}
              </span>
              <span className="muted">({count})</span>
            </>
          ) : (
            <span className="muted"> · ende pa vlerësime publike</span>
          )}
        </p>
      </header>

      {loading ? <p className="muted">Duke u ngarkuar…</p> : null}

      {!loading && count > 0 ? (
        <ul className="tt-review-bars" aria-label="Shpërndarja e vlerësimeve">
          {buckets.map((bucket) => (
            <li key={bucket.stars}>
              <span>{bucket.stars}</span>
              <span className="tt-review-bar">
                <em style={{ width: `${bucket.pct}%` }} />
              </span>
              <span>{bucket.pct}%</span>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && comments.length === 0 ? (
        <p className="muted">Kur ofruesi përfundon shërbimin, komenti i klientit shfaqet këtu.</p>
      ) : null}

      {comments.length > 0 ? (
        <ul className="tt-review-list">
          {comments.slice(0, 6).map((item) => (
            <li key={item.id}>
              <div className="tt-review-meta">
                <strong>{item.raterName}</strong>
                <span className="muted">{formatReviewDate(item.createdAt)}</span>
              </div>
              <p className="tt-review-stars" aria-label={`${item.score} nga 5 yje`}>
                {'★'.repeat(item.score)}
                <span>{'☆'.repeat(5 - item.score)}</span>
              </p>
              <p className="tt-review-hired">Punë e përfunduar në KëshillaKos</p>
              <p className="tt-review-comment">{item.comment}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <RateProvider
        providerUid={providerUid}
        providerName={providerName}
        initialAverage={average}
        initialCount={count}
        quiet
        onRated={(stats) => {
          setAverage(stats.average)
          setCount(stats.count)
        }}
      />
    </section>
  )
}
