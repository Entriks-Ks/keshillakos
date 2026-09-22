import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, ExternalLink, MessageSquareReply, Star } from 'lucide-react'
import { fetchProviderRatings, respondToRating, type RatingItem } from '../api/ratings'
import {
  formatReviewDate,
  initials,
  ratingBuckets,
  ratingWord,
  StarRow,
} from '../components/ratingUi'
import { getErrorMessage } from '../utils/errors'
import DashPageHeader from './DashPageHeader'

export default function ProviderRatingsPanel({
  providerUid,
  audience = 'provider',
}: {
  providerUid: string
  audience?: 'provider' | 'company'
}) {
  const [average, setAverage] = useState(0)
  const [count, setCount] = useState(0)
  const [ratings, setRatings] = useState<RatingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [replyId, setReplyId] = useState('')
  const [replyText, setReplyText] = useState('')
  const [replyError, setReplyError] = useState('')
  const [replying, setReplying] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchProviderRatings(providerUid)
      .then((data) => {
        if (cancelled) return
        setAverage(data.stats.average)
        setCount(data.stats.count)
        setRatings(data.ratings)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [providerUid])

  const buckets = useMemo(() => ratingBuckets(ratings.map((item) => item.score)), [ratings])

  async function onReply(e: FormEvent, id: string) {
    e.preventDefault()
    if (!replyText.trim()) return
    setReplying(true)
    setReplyError('')
    try {
      await respondToRating(id, replyText.trim())
      setRatings((prev) => prev.map((item) => (item.id === id ? { ...item, response: replyText.trim() } : item)))
      setReplyId('')
      setReplyText('')
    } catch (err) {
      setReplyError(getErrorMessage(err))
    } finally {
      setReplying(false)
    }
  }

  return (
    <section className="provider-section dash-ratings">
      <DashPageHeader
        title="Vlerësimet"
        description={
          audience === 'company'
            ? 'Feedback-u i klientëve për ofruesit dhe ekspertët e kompanisë.'
            : 'Shiko çfarë thonë klientët pas punës së përfunduar dhe përgjigju nëse do.'
        }
        actions={
          <Link to={`/providers/${providerUid}#vleresimet`} className="dash-ratings-public">
            Shiko te profili
            <ExternalLink size={14} aria-hidden />
          </Link>
        }
      />

      {loading ? <p className="muted">Duke u ngarkuar…</p> : null}

      {!loading && count > 0 ? (
        <div className="tt-reviews-summary">
          <div className="tt-reviews-score">
            <span className="tt-reviews-score-num">{average.toFixed(1)}</span>
            <StarRow value={average} size={18} label={`${average.toFixed(1)} nga 5 yje`} />
            <strong>{ratingWord(average, count)}</strong>
            <span className="muted">
              {count} {count === 1 ? 'vlerësim publik' : 'vlerësime publike'}
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
          <p>Ende pa vlerësime</p>
          <span>
            {audience === 'company'
              ? 'Klientët vlerësojnë pasi ta përfundosh kërkesën. Pastaj nota shfaqet këtu dhe te profili publik.'
              : 'Kur ta përfundosh kërkesën, klienti mund të lërë yje dhe koment. Ato shfaqen këtu dhe te profili yt publik.'}
          </span>
        </div>
      ) : null}

      {ratings.length > 0 ? (
        <ul className="tt-review-list">
          {ratings.map((item) => (
            <li key={item.id} className="tt-review-card">
              <div className="tt-review-card-head">
                <span className="tt-review-avatar" aria-hidden>
                  {initials(item.raterName)}
                </span>
                <div className="tt-review-who">
                  <strong>{item.raterName}</strong>
                  <span className="muted">
                    {formatReviewDate(item.createdAt)}
                    {item.providerName ? ` · ${item.providerName}` : ''}
                  </span>
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
              {item.comment?.trim() ? (
                <p className="tt-review-comment">{item.comment}</p>
              ) : (
                <p className="tt-review-comment is-empty">Pa koment, vetëm yje.</p>
              )}
              {item.response ? (
                <div className="tt-review-response">
                  <p>
                    <MessageSquareReply size={14} aria-hidden />
                    Përgjigja jote
                  </p>
                  <span>{item.response}</span>
                </div>
              ) : replyId === item.id ? (
                <form className="dash-ratings-reply" onSubmit={(e) => void onReply(e, item.id)}>
                  <label>
                    Përgjigju klientit
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="Faleminderit për feedback-un…"
                      required
                    />
                  </label>
                  {replyError ? <p className="error">{replyError}</p> : null}
                  <div className="dash-ratings-reply-actions">
                    <button type="submit" className="primary-btn" disabled={replying || !replyText.trim()}>
                      {replying ? 'Duke dërguar…' : 'Dërgo përgjigjen'}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setReplyId('')
                        setReplyText('')
                        setReplyError('')
                      }}
                    >
                      Anulo
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="dash-ratings-reply-open"
                  onClick={() => {
                    setReplyId(item.id)
                    setReplyText('')
                    setReplyError('')
                  }}
                >
                  <MessageSquareReply size={14} aria-hidden />
                  Përgjigju
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
