import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, MessageSquareReply, Star } from 'lucide-react'
import { fetchProviderRatings, type ProviderRatingStats, type RatingItem } from '../api/ratings'
import RateProvider from './RateProvider'
import {
  formatReviewDate,
  initials,
  ratingBuckets,
  ratingWord,
  StarRow,
} from './ratingUi'

type Props = {
  providerUid: string
  providerName: string
  initialAverage?: number
  initialCount?: number
  onStatsChange?: (stats: ProviderRatingStats) => void
}

export default function ProviderReviews({
  providerUid,
  providerName,
  initialAverage = 0,
  initialCount = 0,
  onStatsChange,
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
        onStatsChange?.(data.stats)
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

  useEffect(() => {
    if (loading) return
    if (window.location.hash !== '#vleresimet') return
    document.getElementById('vleresimet')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading, providerUid])

  const buckets = useMemo(() => ratingBuckets(ratings.map((item) => item.score)), [ratings])

  return (
    <section className="tt-pro-section tt-reviews" id="vleresimet" aria-labelledby={`reviews-${providerUid}`}>
      <header className="tt-reviews-head">
        <h2 id={`reviews-${providerUid}`}>Vlerësimet</h2>
        <p className="muted">Feedback nga klientë që kanë përfunduar një shërbim me {providerName}.</p>
      </header>

      {loading ? <p className="muted">Duke u ngarkuar…</p> : null}

      {!loading && count > 0 ? (
        <div className="tt-reviews-summary">
          <div className="tt-reviews-score">
            <span className="tt-reviews-score-num">{average.toFixed(1)}</span>
            <StarRow value={average} size={18} label={`${average.toFixed(1)} nga 5 yje`} />
            <strong>{ratingWord(average, count)}</strong>
            <span className="muted">
              {count} {count === 1 ? 'vlerësim' : 'vlerësime'}
            </span>
          </div>
          <ul className="tt-review-bars" aria-label="Shpërndarja e vlerësimeve">
            {buckets.map((bucket) => (
              <li key={bucket.stars}>
                <span>
                  {bucket.stars}
                  <Star size={11} className="is-filled" aria-hidden />
                </span>
                <span className="tt-review-bar">
                  <em style={{ width: `${bucket.pct}%` }} />
                </span>
                <span>{bucket.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!loading && ratings.length === 0 ? (
        <div className="tt-reviews-empty">
          <Star size={22} aria-hidden />
          <p>Ende pa vlerësime publike</p>
          <span>Kur ofruesi përfundon shërbimin, yjet dhe komenti i klientit shfaqen këtu.</span>
        </div>
      ) : null}

      {ratings.length > 0 ? (
        <ul className="tt-review-list">
          {ratings.slice(0, 8).map((item) => (
            <li key={item.id} className="tt-review-card">
              <div className="tt-review-card-head">
                <span className="tt-review-avatar" aria-hidden>
                  {initials(item.raterName)}
                </span>
                <div className="tt-review-who">
                  <strong>{item.raterName}</strong>
                  <span className="muted">{formatReviewDate(item.createdAt)}</span>
                </div>
                <StarRow value={item.score} size={14} label={`${item.score} nga 5 yje`} />
              </div>
              {item.verified ? (
                <p className="tt-review-hired">
                  <BadgeCheck size={14} aria-hidden />
                  Punë e përfunduar në KëshillaKos
                </p>
              ) : (
                <p className="tt-review-hired is-plain">Klient në KëshillaKos</p>
              )}
              {item.comment?.trim() ? <p className="tt-review-comment">{item.comment}</p> : null}
              {item.response ? (
                <div className="tt-review-response">
                  <p>
                    <MessageSquareReply size={14} aria-hidden />
                    Përgjigja e ofruesit
                  </p>
                  <span>{item.response}</span>
                </div>
              ) : null}
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
        className="tt-reviews-rate"
        onRated={(stats) => {
          setAverage(stats.average)
          setCount(stats.count)
          onStatsChange?.(stats)
          fetchProviderRatings(providerUid)
            .then((data) => {
              setAverage(data.stats.average)
              setCount(data.stats.count)
              setRatings(data.ratings)
              onStatsChange?.(data.stats)
            })
            .catch(() => undefined)
        }}
      />
    </section>
  )
}
