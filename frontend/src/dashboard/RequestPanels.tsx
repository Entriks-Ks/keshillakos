import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Inbox, MessageCircle, Search } from 'lucide-react'
import {
  fetchMyRequests,
  fetchRequestInbox,
  fetchAllRequests,
  updateRequestStatus,
  completeMyRequest,
  type RequestStatus,
  type ServiceRequestItem,
} from '../api/requests'
import { getErrorMessage } from '../utils/errors'
import DashPageHeader from './DashPageHeader'

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
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRequests(await fetchMyRequests())
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

  async function markCompleted(id: string) {
    setBusyId(id)
    setError('')
    try {
      const updated = await completeMyRequest(id)
      setRequests((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

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
      <header className="req-head">
        <div>
          <h2>Kërkesat e mia</h2>
          <p>Ndiq përgjigjet e ofruesve për kërkesat që ke dërguar.</p>
        </div>
        <Link to="/ofertat" className="req-head-cta">
          <Search size={16} aria-hidden />
          Shiko ofertat
        </Link>
      </header>

      {!loading && requests.length > 0 ? (
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
      ) : null}

      {loading ? <p className="muted">Duke u ngarkuar…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && requests.length === 0 ? (
        <div className="req-empty">
          <span className="req-empty-icon" aria-hidden>
            <Inbox size={22} />
          </span>
          <h3>Ende nuk ke dërguar kërkesë</h3>
          <p>Shiko ofertat, zgjidh ofruesin dhe dërgo kërkesë me një hap.</p>
          <Link to="/ofertat" className="req-head-cta">
            <Search size={16} aria-hidden />
            Shiko ofertat
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
                  <span>{appointment}</span>
                </p>
              ) : null}

              <p className="req-meta-line">
                {CONTACT_LABELS[r.contactMethod]}
                {r.urgency ? ` · ${URGENCY_LABELS[r.urgency] || r.urgency}` : ''}
                {' · '}
                {formatDate(r.createdAt)}
              </p>

              {r.providerNote ? (
                <div className="req-note">
                  <strong>Përgjigja</strong>
                  <p>{r.providerNote}</p>
                </div>
              ) : r.status === 'pending' || r.status === 'open' || r.status === 'read' ? (
                <p className="req-waiting">Në pritje të përgjigjes së ofruesit…</p>
              ) : null}

              <div className="req-card-actions">
                {r.status === 'accepted' ? (
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={busyId === r.id}
                    onClick={() => void markCompleted(r.id)}
                  >
                    {busyId === r.id ? 'Duke përfunduar…' : 'Shëno si të përfunduar'}
                  </button>
                ) : null}
                {r.providerUid ? (
                  <Link to={`/providers/${r.providerUid}`} className="req-link-btn">
                    Profili
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
      <DashPageHeader
        title="Kërkesat e klientëve"
        description={
          pendingCount > 0
            ? `Inbox i kërkesave · ${pendingCount} në pritje.`
            : 'Inbox i kërkesave që kanë arritur te ti.'
        }
      />
      {loading ? <p className="muted">Duke u ngarkuar...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && requests.length === 0 ? (
        <div className="req-empty is-soft">
          <span className="req-empty-icon" aria-hidden>
            <Inbox size={22} />
          </span>
          <h3>Ende pa kërkesa</h3>
          <p>Kur klientët të dërgojnë kërkesa, ato do të shfaqen këtu.</p>
        </div>
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

            {r.status === 'pending' || r.status === 'read' ? (
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
                    className="ghost danger-ghost"
                    disabled={busyId === r.id}
                    onClick={() => void setStatus(r.id, 'rejected')}
                  >
                    Refuzo
                  </button>
                </div>
              </div>
            ) : null}

            {r.status === 'accepted' ? (
              <div className="request-actions">
                <input
                  value={notes[r.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Shënim përfundimi (opsionale)"
                />
                <div className="admin-row-actions">
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={busyId === r.id}
                    onClick={() => void setStatus(r.id, 'completed')}
                  >
                    {busyId === r.id ? 'Duke përfunduar…' : 'Përfundo kërkesën'}
                  </button>
                </div>
              </div>
            ) : null}

            {r.status !== 'pending' && r.status !== 'read' && r.status !== 'accepted' && r.providerNote ? (
              <p className="request-note">
                <strong>Shënimi yt:</strong> {r.providerNote}
              </p>
            ) : null}

            {r.status === 'accepted' && r.providerNote ? (
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
      <DashPageHeader
        title="Të gjitha kërkesat"
        description="Mbikëqyrja e kërkesave në platformë."
      />
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
