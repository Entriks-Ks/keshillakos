import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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
  /** Mongo ProviderProfile id — preferuar kur dihet. */
  providerId?: string
  /** Ndërveprim i përfunduar i gatshëm për vlerësim. */
  interaction?: EligibleInteraction
  initialAverage?: number
  initialCount?: number
  onRated?: (stats: ProviderRatingStats) => void
  compact?: boolean
}

const INTERACTION_LABELS: Record<EligibleInteraction['kind'], string> = {
  appointment: 'Rezervim i përfunduar',
  request_delivery: 'Kërkesë e përfunduar',
}

export default function RateProvider({
  providerUid,
  providerName,
  providerId: providerIdProp,
  interaction: interactionProp,
  initialAverage = 0,
  initialCount = 0,
  onRated,
  compact = false,
}: Props) {
  const { user } = useAuth()
  const [score, setScore] = useState(5)
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

  const canRate = user?.role === 'user' || user?.role === 'admin'
  const selected = interactions.find((item) => item.id === selectedId) || interactions[0]

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
    if (!canRate || !selected || !providerId) return
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      await submitRating({
        providerId,
        interactionKind: selected.kind,
        interactionId: selected.id,
        stars: score,
        text: comment.trim() || undefined,
      })
      const fresh = await fetchProviderRatings(providerUid)
      setAverage(fresh.stats.average)
      setCount(fresh.stats.count)
      setSuccess('Vlerësimi u ruajt.')
      setInteractions((prev) => prev.filter((item) => item.id !== selected.id))
      setSelectedId('')
      setComment('')
      onRated?.(fresh.stats)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`rate-box${compact ? ' is-compact' : ''}`}>
      <p className="rate-summary">
        ★ {count > 0 ? average.toFixed(1) : '—'}
        <span className="muted">
          {' '}
          · {count} {count === 1 ? 'vlerësim' : 'vlerësime'}
        </span>
      </p>

      {!user ? (
        <p className="muted">
          <Link to="/login">Hyr</Link> si përdorues për të vlerësuar.
        </p>
      ) : null}

      {user && !canRate ? (
        <p className="muted">Vetëm përdoruesit (klientët) mund të vlerësojnë ofruesit.</p>
      ) : null}

      {canRate && loadingEligible ? <p className="muted">Duke kontrolluar ndërveprimet...</p> : null}

      {canRate && !loadingEligible && interactions.length === 0 ? (
        <p className="muted">
          Për të vlerësuar <strong>{providerName}</strong>, duhet një rezervim ose kërkesë e
          përfunduar me ta.
        </p>
      ) : null}

      {canRate && !loadingEligible && selected ? (
        <form onSubmit={onSubmit} className="rate-form">
          {interactions.length > 1 ? (
            <label className="rate-interaction">
              Ndërveprimi
              <select value={selected.id} onChange={(e) => setSelectedId(e.target.value)}>
                {interactions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {INTERACTION_LABELS[item.kind]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="muted rate-interaction-hint">{INTERACTION_LABELS[selected.kind]}</p>
          )}
          <div className="star-row" role="group" aria-label="Vlerësimi">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={`star-btn${score >= value ? ' is-active' : ''}`}
                onClick={() => setScore(value)}
                aria-label={`${value} yje`}
              >
                ★
              </button>
            ))}
          </div>
          {!compact ? (
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Koment (opsionale)"
              maxLength={500}
            />
          ) : null}
          <button type="submit" className="ghost" disabled={submitting || !providerId}>
            {submitting ? 'Duke ruajtur...' : 'Vlerëso'}
          </button>
          {error ? <p className="error">{error}</p> : null}
          {success ? <p className="success">{success}</p> : null}
        </form>
      ) : null}
    </div>
  )
}
