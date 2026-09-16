import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { submitRating, type ProviderRatingStats } from '../api/ratings'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'

type Props = {
  providerUid: string
  providerName: string
  initialAverage?: number
  initialCount?: number
  onRated?: (stats: ProviderRatingStats) => void
  compact?: boolean
}

export default function RateProvider({
  providerUid,
  providerName,
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

  const canRate = user?.role === 'user' || user?.role === 'admin'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canRate) return
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const result = await submitRating({
        providerUid,
        providerName,
        score,
        comment: comment.trim() || undefined,
      })
      setAverage(result.stats.average)
      setCount(result.stats.count)
      setSuccess('Vlerësimi u ruajt.')
      onRated?.(result.stats)
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

      {canRate ? (
        <form onSubmit={onSubmit} className="rate-form">
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
          <button type="submit" className="ghost" disabled={submitting}>
            {submitting ? 'Duke ruajtur...' : 'Vlerëso'}
          </button>
          {error ? <p className="error">{error}</p> : null}
          {success ? <p className="success">{success}</p> : null}
        </form>
      ) : null}
    </div>
  )
}
