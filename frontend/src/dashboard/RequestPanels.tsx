import { useEffect, useState } from 'react'
import { fetchAllRequests, type RequestStatus, type ServiceRequestItem } from '../api/requests'
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

export { UserRequestsPage as UserRequestsPanel } from './UserRequestsPage'
export { ProviderInboxPage as ProviderInboxPanel } from './ProviderInboxPage'

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
              <li>
                {CONTACT_LABELS[r.contactMethod]}
                {r.contactPhone ? ` · ${r.contactPhone}` : ''}
                {r.contactMethod === 'email' && (r.contactEmail || r.seekerEmail)
                  ? ` · ${r.contactEmail || r.seekerEmail}`
                  : ''}
              </li>
              <li>{formatDate(r.createdAt)}</li>
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
