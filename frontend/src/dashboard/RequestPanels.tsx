import KeshillaPagination from '../components/KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { Alert, Card, Chip } from '@heroui/react'
import { fetchAllRequests, type RequestStatus, type ServiceRequestItem } from '../api/requests'
import { getErrorMessage } from '../utils/errors'
import { EmptyBlock, RowsSkeleton, SectionHead } from './OverviewParts'
import { REQUEST_STATUS } from './requestDisplay'
import './UserOverview.css'
import './DashboardSections.css'
import './AdminDashboard.css'

const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'status.draft',
  open: 'status.open',
  pending: 'status.pending',
  read: 'status.read',
  accepted: 'status.accepted',
  rejected: 'status.rejected',
  completed: 'status.completed',
  withdrawn: 'status.withdrawn',
}

const CONTACT_LABELS = {
  chat: 'Chat',
  phone: 'Telefon',
  email: 'Email',
} as const

function dateLocale() {
  const language = (i18n.language || 'sq').slice(0, 2)
  return language === 'de' ? 'de-DE' : language === 'en' ? 'en-GB' : 'sq-AL'
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString(dateLocale(), {
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
    const day = start.toLocaleDateString(dateLocale(), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    const from = start.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
    const to = end.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
    return `${day} · ${from} – ${to}`
  } catch {
    return null
  }
}

export { UserRequestsPage as UserRequestsPanel } from './UserRequestsPage'
export { ProviderInboxPage as ProviderInboxPanel } from './ProviderInboxPage'

const PAGE_SIZES = [5, 10, 15] as const

export function AdminRequestsPanel() {
  const { t } = useTranslation()
  const [requests, setRequests] = useState<ServiceRequestItem[]>([])
  const [limit, setLimit] = useState<(typeof PAGE_SIZES)[number]>(5)
  const { page, setPage, pagination, receivePagination } = usePagination(String(limit))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchAllRequests({ page, limit })
      .then((items) => {
        if (!cancelled) { setRequests(items); receivePagination(items.pagination) }
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
  }, [page, limit])

  return (
    <section className="uo ds ad">
      <header className="uo-head"><div className="uo-head-copy"><h1>Të gjitha kërkesat</h1><p>Mbikëqyrja e kërkesave në platformë.</p></div></header>
      {error ? <Alert status="danger" className="uo-alert"><Alert.Indicator /><Alert.Content><Alert.Title>Kërkesat nuk u ngarkuan</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert> : null}
      <Card className="uo-card">
        <SectionHead
          title="Kërkesat"
          meta={!loading ? <span className="uo-card-meta">{pagination.total || requests.length}</span> : null}
          action={
            <label className="ad-page-size">
              <span>{t('page.perPage')}</span>
              <select
                value={limit}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (next === 5 || next === 10 || next === 15) setLimit(next)
                }}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          }
        />
        {loading ? <Card.Content className="uo-card-body"><RowsSkeleton rows={4} /></Card.Content> : !error && requests.length === 0 ? <EmptyBlock title={t('req.emptyIn')} text={t('req.emptyInText')} /> : null}
        {!loading && requests.length > 0 ? (
          <Card.Content className="uo-card-body ad-request-body">
            <ul className="ad-request-list">
              {requests.map((r) => (
                <li key={r.id}>
                  <div className="ad-request-head">
                    <strong>
                      {r.seekerName} → {r.providerName}
                    </strong>
                    <Chip size="sm" variant="soft" color={REQUEST_STATUS[r.status]?.color || 'default'}><Chip.Label>{t(STATUS_LABELS[r.status])}</Chip.Label></Chip>
                  </div>
                  {r.message ? <p>{r.message}</p> : null}
                  {formatAppointment(r.requestedStartAt, r.requestedEndAt) ? (
                    <p className="request-appointment">
                      <strong>{t('req.appointments')}:</strong> {formatAppointment(r.requestedStartAt, r.requestedEndAt)}
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
            </ul>
          </Card.Content>
        ) : null}
      </Card>
      {!loading && !error ? <KeshillaPagination pagination={pagination} onPageChange={setPage} /> : null}
    </section>
  )
}
