import { useEffect, useState } from 'react'
import { toast } from '@heroui/react'
import { fetchPlatformFeedback, markPlatformFeedbackRead, type PlatformFeedbackItem } from '../api/feedback'
import { getErrorMessage } from '../utils/errors'
import DashPageHeader from './DashPageHeader'
import './AdminFeedbackPanel.css'

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return value
  }
}

export default function AdminFeedbackPanel() {
  const [items, setItems] = useState<PlatformFeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  async function load() {
    setLoading(true)
    try {
      setItems(await fetchPlatformFeedback())
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

  async function onRead(id: string) {
    setBusyId(id)
    try {
      const updated = await markPlatformFeedbackRead(id)
      setItems((current) => current.map((item) => (item.id === id ? updated : item)))
      toast.success('U shënua si i lexuar.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setBusyId('')
    }
  }

  const fresh = items.filter((item) => item.status === 'new').length

  return (
    <section className="provider-section">
      <DashPageHeader
        title="Feedback"
        description="Mesazhet që vizitorët dhe përdoruesit dërgojnë për KëshillaKos nga fundi i faqes."
      />
      {loading ? <p className="muted">Duke u ngarkuar…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <p className="muted">Ende nuk ka feedback.</p>
      ) : null}
      {!loading && items.length > 0 ? (
        <div className="services-list">
          <h3>{fresh === 1 ? '1 i palexuar' : `${fresh} të palexuar`}</h3>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <strong>{item.name || 'Pa emër'}</strong>
                <span>
                  {item.email} · {formatDate(item.createdAt)}
                  {item.status === 'new' ? <em className="admin-feedback-new">E re</em> : null}
                </span>
                <p>{item.message}</p>
                {item.status === 'new' ? (
                  <div className="services-list-actions">
                    <button type="button" className="ghost" disabled={busyId === item.id} onClick={() => onRead(item.id)}>
                      {busyId === item.id ? 'Duke ruajtur…' : 'Shëno si të lexuar'}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
