import { useEffect, useState } from 'react'
import {
  fetchModerationQueue,
  moderateRating,
  type AdminReviewItem,
} from '../api/ratings'
import { getErrorMessage } from '../utils/errors'
import DashPageHeader from './DashPageHeader'

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return value
  }
}

function ReviewRow({
  item,
  pending,
  busyId,
  onModerate,
}: {
  item: AdminReviewItem
  pending?: boolean
  busyId: string
  onModerate?: (id: string, decision: 'published' | 'rejected') => void
}) {
  return (
    <li>
      <strong>
        ★ {item.stars} — {item.reviewerName}
      </strong>
      <span className="muted">
        {item.subjectName} · {formatDate(item.createdAt)}
      </span>
      {item.text ? <p>{item.text}</p> : <p className="muted">Pa koment</p>}
      {pending && onModerate ? (
        <div className="services-list-actions">
          <button
            type="button"
            className="ghost"
            disabled={busyId === item.id}
            onClick={() => onModerate(item.id, 'published')}
          >
            {busyId === item.id ? 'Duke ruajtur…' : 'Publiko'}
          </button>
          <button
            type="button"
            className="ghost danger-ghost"
            disabled={busyId === item.id}
            onClick={() => onModerate(item.id, 'rejected')}
          >
            Refuzo
          </button>
        </div>
      ) : null}
    </li>
  )
}

export default function AdminRatingsPanel() {
  const [pending, setPending] = useState<AdminReviewItem[]>([])
  const [published, setPublished] = useState<AdminReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busyId, setBusyId] = useState('')

  async function load() {
    setLoading(true)
    try {
      const queue = await fetchModerationQueue()
      setPending(queue.pending)
      setPublished(queue.published)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onModerate(id: string, decision: 'published' | 'rejected') {
    setBusyId(id)
    setError('')
    setSuccess('')
    try {
      await moderateRating(id, { decision })
      setSuccess(decision === 'published' ? 'Vlerësimi u publikua.' : 'Vlerësimi u refuzua.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyId('')
    }
  }

  return (
    <section className="provider-section">
      <DashPageHeader
        title="Vlerësimet"
        description="Vlerësimet e reja publikohen automatikisht te profili i ofruesit. Këtu shfaqen ato në pritje dhe të fundit të publikuara."
      />
      {loading ? <p className="muted">Duke u ngarkuar…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="success">{success}</p> : null}

      <div className="services-list">
        <h3>Në pritje të miratimit</h3>
        {!loading && pending.length === 0 ? (
          <p className="muted">Nuk ka vlerësime në pritje. Të rejat shfaqen te profili sapo klienti t’i dërgojë.</p>
        ) : null}
        <ul className="rate-provider-list">
          {pending.map((item) => (
            <ReviewRow key={item.id} item={item} pending busyId={busyId} onModerate={onModerate} />
          ))}
        </ul>
      </div>

      <div className="services-list">
        <h3>Të publikuara</h3>
        {!loading && published.length === 0 ? (
          <p className="muted">Ende nuk ka vlerësime publike në platformë.</p>
        ) : null}
        <ul className="rate-provider-list">
          {published.map((item) => (
            <ReviewRow key={item.id} item={item} busyId={busyId} />
          ))}
        </ul>
      </div>
    </section>
  )
}
