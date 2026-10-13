import KeshillaPagination from './KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { uiText } from '../i18n'
import { BadgeCheck, MessageSquareReply, Star } from 'lucide-react'
import { fetchProviderRatings, type ProviderRatingStats, type RatingItem } from '../api/ratings'
import ProfileAvatar from './ProfileAvatar'
import RateProvider from './RateProvider'
import {
  formatReviewDate,
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
  const { i18n } = useTranslation()
  void i18n.language
  const [average, setAverage] = useState(initialAverage)
  const [count, setCount] = useState(initialCount)
  const [buckets, setBuckets] = useState<Array<{ stars: number; count: number; pct: number }>>([])
  const [ratings, setRatings] = useState<RatingItem[]>([])
  const { page, setPage, pagination, receivePagination } = usePagination(providerUid)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchProviderRatings(providerUid, { page, limit: 12 })
      .then((data) => {
        if (cancelled) return
        setAverage(data.stats.average)
        setCount(data.stats.count)
        setRatings(data.ratings)
        receivePagination(data.pagination)
        setBuckets(data.buckets)
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
  }, [providerUid, page])

  useEffect(() => {
    if (loading) return
    if (window.location.hash !== '#vleresimet') return
    document.getElementById('vleresimet')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading, providerUid])


  return (
    <section className="tt-pro-section tt-reviews" id="vleresimet" aria-labelledby={`reviews-${providerUid}`}>
      <header className="tt-reviews-head">
        <h2 id={`reviews-${providerUid}`}>{uiText('Vlerësimet', 'Ratings', 'Bewertungen')}</h2>
        <p className="muted">{uiText(`Feedback nga klientë që kanë përfunduar një shërbim me ${providerName}.`, `Feedback from clients who finished a service with ${providerName}.`, `Feedback von Kunden, die einen Dienst mit ${providerName} abgeschlossen haben.`)}</p>
      </header>

      {loading ? <p className="muted">{uiText('Duke u ngarkuar…', 'Loading…', 'Wird geladen…')}</p> : null}

      {!loading && count > 0 ? (
        <div className="tt-reviews-summary">
          <div className="tt-reviews-score">
            <span className="tt-reviews-score-num">{average.toFixed(1)}</span>
            <StarRow value={average} size={18} label={uiText(`${average.toFixed(1)} nga 5 yje`, `${average.toFixed(1)} out of 5 stars`, `${average.toFixed(1)} von 5 Sternen`)} />
            <strong>{ratingWord(average, count)}</strong>
            <span className="muted">
              {count} {count === 1 ? uiText('vlerësim', 'rating', 'Bewertung') : uiText('vlerësime', 'ratings', 'Bewertungen')}
            </span>
          </div>
          <ul className="tt-review-bars" aria-label={uiText('Shpërndarja e vlerësimeve', 'Rating distribution', 'Bewertungsverteilung')}>
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
          <p>{uiText('Ende pa vlerësime publike', 'No public ratings yet', 'Noch keine öffentlichen Bewertungen')}</p>
          <span>{uiText('Kur ofruesi përfundon shërbimin, yjet dhe komenti i klientit shfaqen këtu.', 'When the provider finishes the service, the client’s stars and comment appear here.', 'Wenn der Anbieter den Dienst abschließt, erscheinen Sterne und Kommentar des Kunden hier.')}</span>
        </div>
      ) : null}

      {ratings.length > 0 ? (
        <ul className="tt-review-list">
          {ratings.map((item) => (
            <li key={item.id} className="tt-review-card">
              <div className="tt-review-card-head">
                <span className="tt-review-avatar" aria-hidden>
                  <ProfileAvatar seed={item.raterUid} size="fill" />
                </span>
                <div className="tt-review-who">
                  <strong>{item.raterName}</strong>
                  <span className="muted">{formatReviewDate(item.createdAt)}</span>
                </div>
                <StarRow value={item.score} size={14} label={uiText(`${item.score} nga 5 yje`, `${item.score} out of 5 stars`, `${item.score} von 5 Sternen`)} />
              </div>
              {item.verified ? (
                <p className="tt-review-hired">
                  <BadgeCheck size={14} aria-hidden />
                  {uiText('Punë e përfunduar në KLAW', 'Completed work on KLAW', 'Abgeschlossene Arbeit auf KLAW')}
                </p>
              ) : (
                <p className="tt-review-hired is-plain">{uiText('Klient në KLAW', 'Client on KLAW', 'Kunde auf KLAW')}</p>
              )}
              {item.comment?.trim() ? <p className="tt-review-comment">{item.comment}</p> : null}
              {item.response ? (
                <div className="tt-review-response">
                  <p>
                    <MessageSquareReply size={14} aria-hidden />
                    {uiText('Përgjigja e ofruesit', 'Provider reply', 'Antwort des Anbieters')}
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
          fetchProviderRatings(providerUid, { page, limit: 12 })
            .then((data) => {
              setAverage(data.stats.average)
              setCount(data.stats.count)
              setRatings(data.ratings)
              receivePagination(data.pagination)
              setBuckets(data.buckets)
              onStatsChange?.(data.stats)
            })
            .catch(() => undefined)
        }}
      />
      {!loading ? <KeshillaPagination pagination={pagination} onPageChange={setPage} /> : null}
    </section>
  )
}
