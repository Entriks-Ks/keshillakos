import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import {
  fetchEligibleByProviderUid,
  fetchProviderRatings,
  submitRating,
  type EligibleInteraction,
  type ProviderRatingStats,
} from '../api/ratings'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'

type Props = {
  providerUid: string
  providerName: string
  providerId?: string
  interaction?: EligibleInteraction
  initialAverage?: number
  initialCount?: number
  onRated?: (stats: ProviderRatingStats) => void
  /** Hide the form unless this user can rate now. Use on public pages. */
  quiet?: boolean
  className?: string
}

const STAR_HINTS = ['Shumë keq', 'Keq', 'Në rregull', 'Mirë', 'Shkëlqyeshëm'] as const

export default function RateProvider({
  providerUid,
  providerName,
  providerId: providerIdProp,
  interaction: interactionProp,
  initialAverage = 0,
  initialCount = 0,
  onRated,
  quiet = false,
  className = '',
}: Props) {
  const { user } = useAuth()
  const [score, setScore] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [average, setAverage] = useState(initialAverage)
  const [count, setCount] = useState(initialCount)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingEligible, setLoadingEligible] = useState(false)
  const [providerId, setProviderId] = useState(providerIdProp || '')
  const [interactions, setInteractions] = useState<EligibleInteraction[]>(
    interactionProp ? [interactionProp] : [],
  )
  const [selectedId, setSelectedId] = useState(interactionProp?.id || '')

  const canRate = Boolean(user && user.uid !== providerUid)
  const selected = interactions.find((item) => item.id === selectedId) || interactions[0]
  const readyToRate = Boolean(canRate && selected && providerId)

  useEffect(() => {
    setAverage(initialAverage)
    setCount(initialCount)
  }, [initialAverage, initialCount])

  useEffect(() => {
    if (interactionProp) {
      setInteractions([interactionProp])
      setSelectedId(interactionProp.id)
      if (interactionProp.providerId) setProviderId(interactionProp.providerId)
    }
    if (providerIdProp) setProviderId(providerIdProp)
  }, [interactionProp, providerIdProp])

  useEffect(() => {
    if (!canRate || !providerUid || interactionProp) return
    let cancelled = false
    setLoadingEligible(true)
    fetchEligibleByProviderUid(providerUid)
      .then((data) => {
        if (cancelled) return
        setInteractions(data.interactions)
        if (data.providerId) setProviderId(data.providerId)
        setSelectedId(data.interactions[0]?.id || '')
      })
      .catch(() => {
        if (!cancelled) setInteractions([])
      })
      .finally(() => {
        if (!cancelled) setLoadingEligible(false)
      })
    return () => {
      cancelled = true
    }
  }, [canRate, providerUid, interactionProp])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canRate || !selected || !providerId || score < 1) return
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const result = await submitRating({
        providerId,
        interactionKind: selected.kind,
        interactionId: selected.id,
        stars: score,
        text: comment.trim() || undefined,
      })
      const published = result.review?.moderation?.status !== 'pending'
      const fresh = await fetchProviderRatings(providerUid)
      setAverage(fresh.stats.average)
      setCount(fresh.stats.count)
      setSuccess(
        published
          ? 'Faleminderit! Vlerësimi u ruajt dhe tani shfaqet te profili i ofruesit.'
          : 'Faleminderit! Vlerësimi u ruajt dhe do të shfaqet pasi të miratohet.',
      )
      setInteractions((prev) => prev.filter((item) => item.id !== selected.id))
      setSelectedId('')
      setComment('')
      setScore(0)
      onRated?.(fresh.stats)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (quiet && (!canRate || loadingEligible || (!selected && !success))) return null

  const shownScore = hover || score

  return (
    <div className={`rate-box${quiet ? ' is-quiet' : ''}${className ? ` ${className}` : ''}`}>
      {!quiet ? (
        <p className="rate-summary">
          ★ {count > 0 ? average.toFixed(1) : '—'}
          <span className="muted">
            {' '}
            · {count} {count === 1 ? 'vlerësim' : 'vlerësime'}
          </span>
        </p>
      ) : null}

      {!user && !quiet ? (
        <p className="muted">
          <Link to="/login">Hyr</Link> për të lënë një vlerësim pasi ofruesi të përfundojë shërbimin.
        </p>
      ) : null}

      {user && !canRate && !quiet ? (
        <p className="muted">Vlerësimin e lënë vetëm klientët.</p>
      ) : null}

      {canRate && loadingEligible && !quiet ? <p className="muted">Duke kontrolluar…</p> : null}

      {canRate && !loadingEligible && interactions.length === 0 && !success && !quiet ? (
        <p className="muted">
          Mund ta vlerësosh <strong>{providerName}</strong> pasi ofruesi të përfundojë shërbimin.
        </p>
      ) : null}

      {readyToRate ? (
        <form onSubmit={onSubmit} className="rate-form">
          <p className="rate-form-title">Si ishte bashkëpunimi me {providerName}?</p>
          <p className="muted rate-form-hint">Zgjidh yjet — komenti është opsional.</p>
          <div className="star-row" role="group" aria-label="Vlerësimi me yje" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={`star-btn${shownScore >= value ? ' is-active' : ''}`}
                onClick={() => setScore(value)}
                onMouseEnter={() => setHover(value)}
                aria-label={`${value} yje, ${STAR_HINTS[value - 1]}`}
              >
                <Star size={26} strokeWidth={1.6} />
              </button>
            ))}
            {shownScore > 0 ? <span className="rate-star-hint">{STAR_HINTS[shownScore - 1]}</span> : null}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Çfarë shkoi mirë? Çfarë mund të përmirësohej?"
            maxLength={500}
            rows={3}
          />
          <button type="submit" className="primary-btn" disabled={submitting || score < 1}>
            {submitting ? 'Duke ruajtur…' : 'Dërgo vlerësimin'}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </form>
      ) : null}

      {success ? <p className="success">{success}</p> : null}
    </div>
  )
}
