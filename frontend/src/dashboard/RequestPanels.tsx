import { useEffect, useState } from 'react'
import { Alert, Card, Chip } from '@heroui/react'
import { fetchAllRequests, type RequestStatus, type ServiceRequestItem } from '../api/requests'
import { getErrorMessage } from '../utils/errors'
import { EmptyBlock, RowsSkeleton, SectionHead } from './OverviewParts'
import { REQUEST_STATUS } from './requestDisplay'
import './UserOverview.css'
import './DashboardSections.css'
import './AdminDashboard.css'

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
    <section className="uo ds ad">
      <header className="uo-head"><div className="uo-head-copy"><h1>Të gjitha kërkesat</h1><p>Mbikëqyrja e kërkesave në platformë.</p></div></header>
      {error ? <Alert status="danger" className="uo-alert"><Alert.Indicator /><Alert.Content><Alert.Title>Kërkesat nuk u ngarkuan</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert> : null}
      <Card className="uo-card">
        <SectionHead title="Kërkesat" meta={!loading ? <span className="uo-card-meta">{requests.length}</span> : null} />
        {loading ? <Card.Content className="uo-card-body"><RowsSkeleton rows={4} /></Card.Content> : !error && requests.length === 0 ? <EmptyBlock title="Ende nuk ka kërkesa" text="Kërkesat e platformës do të shfaqen këtu." /> : null}
      {!loading && requests.length > 0 ? <ul className="ad-request-list">
        {requests.map((r) => (
          <li key={r.id}>
            <div className="ad-request-head">
              <strong>
                {r.seekerName} → {r.providerName}
              </strong>
              <Chip size="sm" variant="soft" color={REQUEST_STATUS[r.status]?.color || 'default'}><Chip.Label>{STATUS_LABELS[r.status]}</Chip.Label></Chip>
            </div>
            {r.message ? <p>{r.message}</p> : null}
            {formatAppointment(r.requestedStartAt, r.requestedEndAt) ? (
              <p className="request-appointment">
                <strong>Termini:</strong> {formatAppointment(r.requestedStartAt, r.requestedEndAt)}
              </p>
            ) : null}
            <ul className="ad-request-meta">
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
      </ul> : null}
      </Card>
    </section>
  )
}
