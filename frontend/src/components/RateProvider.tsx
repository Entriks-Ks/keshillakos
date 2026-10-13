import KeshillaPagination from './KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { uiText } from '../i18n'
import { toast } from '@heroui/react'
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

function starHints() {
  return [
    uiText('Shumë keq', 'Very bad', 'Sehr schlecht'),
    uiText('Keq', 'Bad', 'Schlecht'),
    uiText('Në rregull', 'Okay', 'In Ordnung'),
    uiText('Mirë', 'Good', 'Gut'),
    uiText('Shkëlqyeshëm', 'Excellent', 'Ausgezeichnet'),
  ]
}

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
  const { i18n } = useTranslation()
  void i18n.language
  const { user } = useAuth()
  const { page, setPage, pagination, receivePagination } = usePagination(providerUid)
  const [eligibleRevision, setEligibleRevision] = useState(0)
  const [score, setScore] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [average, setAverage] = useState(initialAverage)
  const [count, setCount] = useState(initialCount)
  const [rated, setRated] = useState(false)
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
    fetchEligibleByProviderUid(providerUid, { page, limit: 20 })
      .then((data) => {
        if (cancelled) return
        setInteractions(data.interactions)
        receivePagination(data.pagination)
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
  }, [canRate, providerUid, interactionProp, page, eligibleRevision])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canRate || !selected || !providerId || score < 1) return
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
      toast.success(
        published
          ? uiText('Faleminderit! Vlerësimi u ruajt dhe tani shfaqet te profili i ofruesit.', 'Thank you! The rating was saved and now shows on the provider profile.', 'Danke! Die Bewertung wurde gespeichert und erscheint jetzt im Profil des Anbieters.')
          : uiText('Faleminderit! Vlerësimi u ruajt dhe do të shfaqet pasi të miratohet.', 'Thank you! The rating was saved and will appear after approval.', 'Danke! Die Bewertung wurde gespeichert und erscheint nach der Freigabe.'),
      )
      setRated(true)
      setInteractions((prev) => prev.filter((item) => item.id !== selected.id))
      setSelectedId('')
      setEligibleRevision((value) => value + 1)
      setComment('')
      setScore(0)
      onRated?.(fresh.stats)
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (quiet && (!canRate || loadingEligible || (!selected && !rated))) return null

  const shownScore = hover || score

  return (
    <div className={`rate-box${quiet ? ' is-quiet' : ''}${className ? ` ${className}` : ''}`}>
      {!quiet ? (
        <p className="rate-summary">
          ★ {count > 0 ? average.toFixed(1) : '—'}
          <span className="muted">
            {' '}
            · {count} {count === 1 ? uiText('vlerësim', 'rating', 'Bewertung') : uiText('vlerësime', 'ratings', 'Bewertungen')}
          </span>
        </p>
      ) : null}

      {!user && !quiet ? (
        <p className="muted">
          <Link to="/login">{uiText('Hyr', 'Log in', 'Anmelden')}</Link> {uiText('për të lënë një vlerësim pasi ofruesi të përfundojë shërbimin.', 'to leave a rating after the provider finishes the service.', 'um eine Bewertung zu hinterlassen, nachdem der Anbieter den Dienst abschließt.')}
        </p>
      ) : null}

      {user && !canRate && !quiet ? (
        <p className="muted">{uiText('Vlerësimin e lënë vetëm klientët.', 'Only clients can leave a rating.', 'Nur Kunden können eine Bewertung hinterlassen.')}</p>
      ) : null}

      {canRate && loadingEligible && !quiet ? <p className="muted">{uiText('Duke kontrolluar…', 'Checking…', 'Wird geprüft…')}</p> : null}

      {canRate && !loadingEligible && interactions.length === 0 && !rated && !quiet ? (
        <p className="muted">
          {uiText('Mund ta vlerësosh', 'You can rate', 'Du kannst')} <strong>{providerName}</strong> {uiText('pasi ofruesi të përfundojë shërbimin.', 'after the provider finishes the service.', 'bewerten, nachdem der Anbieter den Dienst abschließt.')}
        </p>
      ) : null}

      {readyToRate ? (
        <form onSubmit={onSubmit} className="rate-form">
          <p className="rate-form-title">{uiText(`Si ishte bashkëpunimi me ${providerName}?`, `How was working with ${providerName}?`, `Wie war die Zusammenarbeit mit ${providerName}?`)}</p>
          <p className="muted rate-form-hint">{uiText('Zgjidh yjet — komenti është opsional.', 'Pick the stars — a comment is optional.', 'Wähle die Sterne — ein Kommentar ist optional.')}</p>
          {!interactionProp && interactions.length > 1 ? <label className="muted">{uiText('Shërbimi i përfunduar', 'Finished service', 'Abgeschlossener Dienst')}
            <select value={selectedId} onChange={(event) => { const choice = interactions.find((item) => item.id === event.target.value); setSelectedId(event.target.value); if (choice) setProviderId(choice.providerId) }}>
              {interactions.map((item, index) => <option key={item.id} value={item.id}>{item.kind === 'appointment' ? uiText('Takim', 'Meeting', 'Termin') : uiText('Kërkesë', 'Request', 'Anfrage')} {(page - 1) * 20 + index + 1}</option>)}
            </select>
          </label> : null}
          {!interactionProp ? <KeshillaPagination pagination={pagination} onPageChange={setPage} isDisabled={loadingEligible || submitting} /> : null}
          <div className="star-row" role="group" aria-label={uiText('Vlerësimi me yje', 'Star rating', 'Sternebewertung')} onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={`star-btn${shownScore >= value ? ' is-active' : ''}`}
                onClick={() => setScore(value)}
                onMouseEnter={() => setHover(value)}
                aria-label={uiText(`${value} yje, ${starHints()[value - 1]}`, `${value} stars, ${starHints()[value - 1]}`, `${value} Sterne, ${starHints()[value - 1]}`)}
              >
                <Star size={26} strokeWidth={1.6} />
              </button>
            ))}
            {shownScore > 0 ? <span className="rate-star-hint">{starHints()[shownScore - 1]}</span> : null}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={uiText('Çfarë shkoi mirë? Çfarë mund të përmirësohej?', 'What went well? What could be better?', 'Was lief gut? Was könnte besser sein?')}
            maxLength={500}
            rows={3}
          />
          <button type="submit" className="primary-btn" disabled={submitting || score < 1}>
            {submitting ? uiText('Duke ruajtur…', 'Saving…', 'Wird gespeichert…') : uiText('Dërgo vlerësimin', 'Send rating', 'Bewertung senden')}
          </button>
        </form>
      ) : null}
    </div>
  )
}
