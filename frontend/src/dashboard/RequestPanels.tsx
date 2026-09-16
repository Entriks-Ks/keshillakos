import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Clock3, Inbox, MessageCircle, Search } from 'lucide-react'
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
  draft: 'Draft',
  open: 'E hapur',
  pending: 'Në pritje',
  read: 'Lexuar',
  accepted: 'Pranuar',
  rejected: 'Refuzuar',
  completed: 'Përfunduar',
  withdrawn: 'Tërhequr',
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
  const [statusFilter, setStatusFilter] = useState<'all' | RequestStatus>('all')

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

  const filtered =
    statusFilter === 'all' ? requests : requests.filter((r) => r.status === statusFilter)

  const statusCounts = requests.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    },
    {} as Partial<Record<RequestStatus, number>>,
  )

  const filterOptions: Array<{ id: 'all' | RequestStatus; label: string; count: number }> = [
    { id: 'all', label: 'Të gjitha', count: requests.length },
    { id: 'pending', label: 'Në pritje', count: statusCounts.pending || 0 },
    { id: 'accepted', label: 'Pranuar', count: statusCounts.accepted || 0 },
    { id: 'completed', label: 'Përfunduar', count: statusCounts.completed || 0 },
    { id: 'rejected', label: 'Refuzuar', count: statusCounts.rejected || 0 },
  ].filter((item) => item.id === 'all' || item.count > 0)

  return (
    <section className="req-page">
      <div className="req-hero">
        <div>
          <h2>Kërkesat e mia</h2>
          <p>Ndiq statusin e kërkesave që u ke dërguar ofruesve.</p>
        </div>
        <Link to="/" className="req-hero-cta">
          <Search size={16} aria-hidden />
          Kërko ndihmë
        </Link>
      </div>

      {!loading && requests.length > 0 ? (
        <div className="req-toolbar">
          <div className="req-filters" role="tablist" aria-label="Filtro sipas statusit">
            {filterOptions.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={statusFilter === item.id}
                className={`req-filter${statusFilter === item.id ? ' is-active' : ''}`}
                onClick={() => setStatusFilter(item.id)}
              >
                {item.label}
                <em>{item.count}</em>
              </button>
            ))}
          </div>
          <p className="req-count">
            <strong>{filtered.length}</strong>{' '}
            {filtered.length === 1 ? 'kërkesë' : 'kërkesa'}
          </p>
        </div>
      ) : null}

      {loading ? <p className="muted">Duke u ngarkuar...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && requests.length === 0 ? (
        <div className="req-empty">
          <span className="req-empty-icon" aria-hidden>
            <Inbox size={22} />
          </span>
          <h3>Ende nuk ke dërguar asnjë kërkesë</h3>
          <p>Fillo nga faqja kryesore për të gjetur ofruesin e duhur.</p>
          <Link to="/" className="req-hero-cta">
            <Search size={16} aria-hidden />
            Fillo matching
          </Link>
        </div>
      ) : null}

      {!loading && requests.length > 0 && filtered.length === 0 ? (
        <div className="req-empty is-soft">
          <p>Nuk ka kërkesa me këtë status.</p>
          <button type="button" className="ghost" onClick={() => setStatusFilter('all')}>
            Shiko të gjitha
          </button>
        </div>
      ) : null}

      <ul className="req-list">
        {filtered.map((r) => {
          const appointment = formatAppointment(r.requestedStartAt, r.requestedEndAt)
          return (
            <li key={r.id} className="req-card">
              <div className="req-card-head">
                <div className="req-card-title">
                  <strong>{r.providerName}</strong>
                  {r.serviceTitle ? <span>{r.serviceTitle}</span> : null}
                </div>
                <span className={`status-pill status-${r.status}`}>
                  {STATUS_LABELS[r.status]}
                </span>
              </div>

              <p className="req-need">{r.need}</p>
              {r.message ? <p className="req-message">{r.message}</p> : null}

              {appointment ? (
                <p className="req-appointment">
                  <CalendarDays size={15} aria-hidden />
                  <span>
                    <strong>Termini:</strong> {appointment}
                  </span>
                </p>
              ) : null}

              <ul className="req-meta">
                <li>
                  <MessageCircle size={14} aria-hidden />
                  {CONTACT_LABELS[r.contactMethod]}
                </li>
                {r.urgency ? (
                  <li>
                    <Clock3 size={14} aria-hidden />
                    {URGENCY_LABELS[r.urgency] || r.urgency}
                  </li>
                ) : null}
                <li>
                  <Clock3 size={14} aria-hidden />
                  {formatDate(r.createdAt)}
                </li>
              </ul>

              {r.providerNote ? (
                <div className="req-note">
                  <strong>Përgjigja e ofruesit</strong>
                  <p>{r.providerNote}</p>
                </div>
              ) : null}

              <div className="req-card-actions">
                {r.providerUid ? (
                  <Link to={`/providers/${r.providerUid}`} className="req-link-btn">
                    Shiko profilin
                    <ArrowRight size={14} aria-hidden />
                  </Link>
                ) : null}
                <Link to="/dashboard/user/messages" className="req-link-btn is-accent">
                  <MessageCircle size={14} aria-hidden />
                  Mesazhet
                </Link>
              </div>
            </li>
          )
        })}
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
