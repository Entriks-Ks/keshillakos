import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Clock,
  Inbox,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
} from 'lucide-react'
import {
  fetchMyRequests,
  fetchRequestInbox,
  fetchAllRequests,
  updateRequestStatus,
  type RequestStatus,
  type ServiceRequestItem,
} from '../api/requests'
import StartChatButton from '../components/StartChatButton'
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : parts[0][1] || ''
  return `${first}${last}`.toUpperCase()
}

function isAwaitingProvider(status: RequestStatus) {
  return status === 'pending' || status === 'open' || status === 'read'
}

function inboxStatusLabel(status: RequestStatus) {
  if (isAwaitingProvider(status)) return 'Në pritje'
  return STATUS_LABELS[status]
}

function inboxStatusClass(status: RequestStatus) {
  if (isAwaitingProvider(status)) return 'pending'
  return status
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

  const filtered =
    statusFilter === 'all' ? requests : requests.filter((r) => r.status === statusFilter)

  const statusCounts = requests.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    },
    {} as Partial<Record<RequestStatus, number>>,
  )

  const filterOptions = ([
    { id: 'all', label: 'Të gjitha', count: requests.length },
    { id: 'pending', label: 'Në pritje', count: statusCounts.pending || 0 },
    { id: 'accepted', label: 'Pranuar', count: statusCounts.accepted || 0 },
    { id: 'completed', label: 'Përfunduar', count: statusCounts.completed || 0 },
    { id: 'rejected', label: 'Refuzuar', count: statusCounts.rejected || 0 },
  ] satisfies Array<{ id: 'all' | RequestStatus; label: string; count: number }>).filter((item) => item.id === 'all' || item.count > 0)

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
              ) : r.status === 'accepted' ? (
                <p className="req-waiting">Ofruesi do ta shënojë kërkesën si të përfunduar.</p>
              ) : null}

              <div className="req-card-actions">
                {r.providerUid ? (
                  <Link to={`/providers/${r.providerUid}`} className="req-link-btn">
                    Profili
                  </Link>
                ) : null}
                {r.status === 'completed' && r.providerUid ? (
                  <Link to={`/providers/${r.providerUid}#vleresimet`} className="req-link-btn is-accent">
                    Vlerëso ofruesin
                  </Link>
                ) : null}
                {r.providerUid ? (
                  <StartChatButton
                    providerUid={r.providerUid}
                    providerName={r.providerName}
                    serviceId={r.serviceId}
                    serviceTitle={r.serviceTitle}
                    className="req-link-btn is-accent"
                    label="Dërgo mesazh"
                    hideGuestHint
                  />
                ) : (
                  <Link to="/dashboard/user/messages" className="req-link-btn is-accent">
                    <MessageCircle size={14} aria-hidden />
                    Mesazhet
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

type InboxFilter = 'all' | 'waiting' | 'accepted' | 'completed' | 'rejected'

function rankInbox(status: RequestStatus) {
  if (isAwaitingProvider(status)) return 0
  if (status === 'accepted') return 1
  if (status === 'completed') return 2
  return 3
}

export function ProviderInboxPanel() {
  const [requests, setRequests] = useState<ServiceRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<InboxFilter>('all')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await fetchRequestInbox()
      setRequests(data.requests)
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

  const waitingCount = requests.filter((r) => isAwaitingProvider(r.status)).length
  const acceptedCount = requests.filter((r) => r.status === 'accepted').length
  const completedCount = requests.filter((r) => r.status === 'completed').length
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length

  const filterOptions = (
    [
      { id: 'all', label: 'Të gjitha', count: requests.length },
      { id: 'waiting', label: 'Në pritje', count: waitingCount },
      { id: 'accepted', label: 'Pranuar', count: acceptedCount },
      { id: 'completed', label: 'Përfunduar', count: completedCount },
      { id: 'rejected', label: 'Refuzuar', count: rejectedCount },
    ] satisfies Array<{ id: InboxFilter; label: string; count: number }>
  ).filter((item) => item.id === 'all' || item.count > 0)

  const filtered = useMemo(() => {
    const next = requests.filter((r) => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'waiting') return isAwaitingProvider(r.status)
      return r.status === statusFilter
    })
    return [...next].sort((a, b) => {
      const byRank = rankInbox(a.status) - rankInbox(b.status)
      if (byRank !== 0) return byRank
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [requests, statusFilter])

  return (
    <section className="req-page inbox-page">
      <header className="req-head">
        <div>
          <h2>Kërkesat e klientëve</h2>
          <p>Prano, refuzo ose mesazho klientët që të kanë dërguar kërkesë.</p>
        </div>
        {waitingCount > 0 ? (
          <span className="inbox-pending-badge">{waitingCount} në pritje</span>
        ) : null}
      </header>

      {!loading && requests.length > 0 ? (
        <ul className="inbox-stats">
          <li className={waitingCount ? 'is-warn' : ''}>
            <strong>{waitingCount}</strong>
            <span>Në pritje</span>
          </li>
          <li className={acceptedCount ? 'is-success' : ''}>
            <strong>{acceptedCount}</strong>
            <span>Pranuar</span>
          </li>
          <li>
            <strong>{completedCount}</strong>
            <span>Përfunduar</span>
          </li>
          <li>
            <strong>{requests.length}</strong>
            <span>Gjithsej</span>
          </li>
        </ul>
      ) : null}

      {!loading && requests.length > 0 ? (
        <div className="req-filters" role="tablist" aria-label="Filtro kërkesat">
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
          <h3>Ende pa kërkesa</h3>
          <p>Kur klientët të dërgojnë kërkesë, ato do të shfaqen këtu për t’i pranuar ose refuzuar.</p>
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
          const waiting = isAwaitingProvider(r.status)
          const extraMessage = r.message && r.message.trim() !== r.need.trim() ? r.message : ''
          return (
            <li key={r.id} className={`req-card inbox-card${waiting ? ' is-action' : ''}`}>
              <div className="inbox-card-head">
                <span className="inbox-avatar" aria-hidden>
                  {initials(r.seekerName)}
                </span>
                <div className="req-card-title">
                  <strong>{r.seekerName || 'Klient'}</strong>
                  <span>
                    {r.serviceTitle || 'Kërkesë për shërbim'}
                    {r.status === 'pending' ? ' · E re' : ''}
                  </span>
                </div>
                <span className={`status-pill status-${inboxStatusClass(r.status)}`}>
                  {inboxStatusLabel(r.status)}
                </span>
              </div>

              {appointment ? (
                <p className="req-appointment">
                  <CalendarDays size={15} aria-hidden />
                  <span>{appointment}</span>
                </p>
              ) : (
                <p className="req-waiting">Klienti nuk ka zgjedhur ende një orë.</p>
              )}

              <div className="inbox-copy">
                <p className="req-need">{r.need || extraMessage || 'Pa përshkrim'}</p>
                {r.need && extraMessage ? <p className="req-message">{extraMessage}</p> : null}
              </div>

              <ul className="req-meta">
                <li>
                  {r.contactMethod === 'phone' ? (
                    <Phone size={13} aria-hidden />
                  ) : r.contactMethod === 'email' ? (
                    <Mail size={13} aria-hidden />
                  ) : (
                    <MessageCircle size={13} aria-hidden />
                  )}
                  {CONTACT_LABELS[r.contactMethod]}
                </li>
                {r.location ? (
                  <li>
                    <MapPin size={13} aria-hidden />
                    {r.location}
                  </li>
                ) : null}
                {r.urgency ? (
                  <li>
                    <Clock size={13} aria-hidden />
                    {URGENCY_LABELS[r.urgency] || r.urgency}
                  </li>
                ) : null}
                {r.language ? <li>{r.language}</li> : null}
                {r.seekerEmail ? (
                  <li>
                    <Mail size={13} aria-hidden />
                    {r.seekerEmail}
                  </li>
                ) : null}
                <li>{formatDate(r.createdAt)}</li>
              </ul>

              {r.providerNote && !waiting ? (
                <div className="req-note">
                  <strong>Shënimi yt</strong>
                  <p>{r.providerNote}</p>
                </div>
              ) : null}

              {waiting || r.status === 'accepted' ? (
                <label className="inbox-reply">
                  {waiting ? 'Përgjigja për klientin (opsionale)' : 'Shënim përfundimi (opsionale)'}
                  <textarea
                    value={notes[r.id] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder={
                      waiting
                        ? 'P.sh. e pranoj orën, na shohim atë ditë.'
                        : 'P.sh. takimi u krye, faleminderit.'
                    }
                    rows={2}
                  />
                </label>
              ) : null}

              <div className="req-card-actions inbox-actions">
                {waiting ? (
                  <>
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={busyId === r.id}
                      onClick={() => void setStatus(r.id, 'accepted')}
                    >
                      {busyId === r.id ? 'Duke ruajtur…' : 'Prano'}
                    </button>
                    <button
                      type="button"
                      className="ghost danger-ghost"
                      disabled={busyId === r.id}
                      onClick={() => void setStatus(r.id, 'rejected')}
                    >
                      Refuzo
                    </button>
                  </>
                ) : null}
                {r.status === 'accepted' ? (
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={busyId === r.id}
                    onClick={() => void setStatus(r.id, 'completed')}
                  >
                    {busyId === r.id ? 'Duke përfunduar…' : 'Përfundo kërkesën'}
                  </button>
                ) : null}
                {r.seekerUid ? (
                  <StartChatButton
                    providerUid={r.providerUid || ''}
                    seekerUid={r.seekerUid}
                    seekerName={r.seekerName}
                    serviceId={r.serviceId}
                    serviceTitle={r.serviceTitle}
                    className="req-link-btn is-accent"
                    label="Dërgo mesazh"
                    hideGuestHint
                  />
                ) : null}
              </div>
            </li>
          )
        })}
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
