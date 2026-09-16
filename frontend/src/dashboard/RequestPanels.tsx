import { useEffect, useState } from 'react'
import {
  fetchMyRequests,
  fetchRequestInbox,
  fetchAllRequests,
  updateRequestStatus,
  type RequestStatus,
  type ServiceRequestItem,
} from '../api/requests'
import { getErrorMessage } from '../utils/errors'

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Në pritje',
  accepted: 'Pranuar',
  rejected: 'Refuzuar',
  completed: 'Përfunduar',
}

const CONTACT_LABELS = {
  chat: 'Chat',
  phone: 'Telefon',
  email: 'Email',
} as const

const URGENCY_LABELS: Record<string, string> = {
  today: 'Sot',
  this_week: 'Këtë javë',
  flexible: 'Fleksibël',
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('sq-AL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return value
  }
}

function formatAppointment(startAt?: string, endAt?: string) {
  if (!startAt || !endAt) return null
  try {
    const start = new Date(startAt)
    const end = new Date(endAt)
    const day = start.toLocaleDateString('sq-AL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    const from = start.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })
    const to = end.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })
    return `${day} · ${from} – ${to}`
  } catch {
    return null
  }
}

export function UserRequestsPanel() {
  const [requests, setRequests] = useState<ServiceRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchMyRequests()
      .then((items) => {
        if (!cancelled) setRequests(items)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="provider-section">
      <h2>Kërkesat e mia</h2>
      <p className="muted">Kërkesat që u ke dërguar ofruesve.</p>
      {loading ? <p className="muted">Duke u ngarkuar...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && requests.length === 0 ? (
        <p className="muted">Ende nuk ke dërguar asnjë kërkesë. Fillo nga faqja kryesore.</p>
      ) : null}
      <ul className="request-list">
        {requests.map((r) => (
          <li key={r.id}>
            <div className="request-list-head">
              <strong>{r.providerName}</strong>
              <span className={`status-pill status-${r.status}`}>{STATUS_LABELS[r.status]}</span>
            </div>
            <p className="muted">{r.serviceTitle || r.need}</p>
            <p>{r.message}</p>
            {formatAppointment(r.requestedStartAt, r.requestedEndAt) ? (
              <p className="request-appointment">
                <strong>Termini:</strong> {formatAppointment(r.requestedStartAt, r.requestedEndAt)}
              </p>
            ) : null}
            <ul className="match-meta">
              <li>{CONTACT_LABELS[r.contactMethod]}</li>
              {r.urgency ? <li>{URGENCY_LABELS[r.urgency] || r.urgency}</li> : null}
              <li>{formatDate(r.createdAt)}</li>
            </ul>
            {r.providerNote ? (
              <p className="request-note">
                <strong>Përgjigja e ofruesit:</strong> {r.providerNote}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ProviderInboxPanel() {
  const [requests, setRequests] = useState<ServiceRequestItem[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await fetchRequestInbox()
      setRequests(data.requests)
      setPendingCount(data.pendingCount)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function setStatus(id: string, status: RequestStatus) {
    setBusyId(id)
    setError('')
    try {
      await updateRequestStatus(id, {
        status,
        providerNote: notes[id]?.trim() || undefined,
      })
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="provider-section">
      <h2>Kërkesat e klientëve</h2>
      <p className="muted">
        Inbox i kërkesave
        {pendingCount > 0 ? ` · ${pendingCount} në pritje` : ''}.
      </p>
      {loading ? <p className="muted">Duke u ngarkuar...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && requests.length === 0 ? (
        <p className="muted">Ende nuk ke marrë asnjë kërkesë.</p>
      ) : null}
      <ul className="request-list">
        {requests.map((r) => (
          <li key={r.id}>
            <div className="request-list-head">
              <strong>{r.seekerName}</strong>
              <span className={`status-pill status-${r.status}`}>{STATUS_LABELS[r.status]}</span>
            </div>
            <p className="muted">
              {r.seekerEmail}
              {r.serviceTitle ? ` · ${r.serviceTitle}` : ''}
            </p>
            <p>
              <strong>Nevoja:</strong> {r.need}
            </p>
            <p>{r.message}</p>
            {formatAppointment(r.requestedStartAt, r.requestedEndAt) ? (
              <p className="request-appointment">
                <strong>Termini i kërkuar:</strong>{' '}
                {formatAppointment(r.requestedStartAt, r.requestedEndAt)}
              </p>
            ) : null}
            <ul className="match-meta">
              <li>{CONTACT_LABELS[r.contactMethod]}</li>
              {r.location ? <li>{r.location}</li> : null}
              {r.language ? <li>{r.language}</li> : null}
              {r.urgency ? <li>{URGENCY_LABELS[r.urgency] || r.urgency}</li> : null}
              <li>{formatDate(r.createdAt)}</li>
            </ul>

            {r.status === 'pending' ? (
              <div className="request-actions">
                <input
                  value={notes[r.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Shënim për klientin (opsionale)"
                />
                <div className="admin-row-actions">
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={busyId === r.id}
                    onClick={() => void setStatus(r.id, 'accepted')}
                  >
                    Prano
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={busyId === r.id}
                    onClick={() => void setStatus(r.id, 'completed')}
                  >
                    Përfundo
                  </button>
                  <button
                    type="button"
                    className="ghost danger-ghost"
                    disabled={busyId === r.id}
                    onClick={() => void setStatus(r.id, 'rejected')}
                  >
                    Refuzo
                  </button>
                </div>
              </div>
            ) : r.providerNote ? (
              <p className="request-note">
                <strong>Shënimi yt:</strong> {r.providerNote}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function AdminRequestsPanel() {
  const [requests, setRequests] = useState<ServiceRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchAllRequests()
      .then((items) => {
        if (!cancelled) setRequests(items)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="provider-section">
      <h2>Të gjitha kërkesat</h2>
      <p className="muted">Mbikëqyrja e kërkesave në platformë.</p>
      {loading ? <p className="muted">Duke u ngarkuar...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <ul className="request-list">
        {requests.map((r) => (
          <li key={r.id}>
            <div className="request-list-head">
              <strong>
                {r.seekerName} → {r.providerName}
              </strong>
              <span className={`status-pill status-${r.status}`}>{STATUS_LABELS[r.status]}</span>
            </div>
            <p>{r.message}</p>
            {formatAppointment(r.requestedStartAt, r.requestedEndAt) ? (
              <p className="request-appointment">
                <strong>Termini:</strong> {formatAppointment(r.requestedStartAt, r.requestedEndAt)}
              </p>
            ) : null}
            <ul className="match-meta">
              <li>{CONTACT_LABELS[r.contactMethod]}</li>
              <li>{formatDate(r.createdAt)}</li>
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
