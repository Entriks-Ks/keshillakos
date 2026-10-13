import { collectionSummary, collectionTotal } from '../api/pagination'
import KeshillaPagination from '../components/KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import {
  Alert,
  Button,
  buttonVariants,
  Card,
  Chip,
  Label,
  Skeleton,
  Tabs,
  TextArea,
  TextField,
  toast,
} from '@heroui/react'
import { Briefcase, CalendarDays, Inbox, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { fetchRequestInbox, updateRequestStatus, type RequestStatus, type ServiceRequestItem } from '../api/requests'
import ProfileAvatar from '../components/ProfileAvatar'
import StartChatButton from '../components/StartChatButton'
import { getErrorMessage } from '../utils/errors'
import { formatAmount, formatWhen, REQUEST_STATUS, type ChipColor } from './requestDisplay'
import './UserOverview.css'
import './UserRequests.css'

type FilterId = 'all' | 'waiting' | 'accepted' | 'completed' | 'rejected'

const AWAITING: RequestStatus[] = ['open', 'pending', 'read']

const FILTERS: Array<{ id: FilterId; label: string; statuses?: RequestStatus[] }> = [
  { id: 'all', label: 'req.all' },
  { id: 'waiting', label: 'req.waiting', statuses: AWAITING },
  { id: 'accepted', label: 'req.accepted', statuses: ['accepted'] },
  { id: 'completed', label: 'req.completed', statuses: ['completed'] },
  { id: 'rejected', label: 'req.rejected', statuses: ['rejected'] },
]

const CONTACT = {
  chat: { label: 'Chat', icon: MessageCircle },
  phone: { label: 'Telefon', icon: Phone },
  email: { label: 'Email', icon: Mail },
} as const

const STATUS_TOAST: Partial<Record<RequestStatus, string>> = {
  accepted: 'req.acceptedToast',
  rejected: 'req.rejectedToast',
  completed: 'req.completedToast',
}

function isAwaiting(status: RequestStatus) {
  return AWAITING.includes(status)
}

function statusChip(status: RequestStatus): { label: string; color: ChipColor } {
  if (isAwaiting(status)) return { label: 'status.pending', color: 'warning' }
  return REQUEST_STATUS[status] ?? { label: status, color: 'default' }
}

function rank(status: RequestStatus) {
  if (isAwaiting(status)) return 0
  if (status === 'accepted') return 1
  if (status === 'completed') return 2
  return 3
}

function formatAppointment(startAt?: string, endAt?: string) {
  if (!startAt || !endAt) return null
  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const day = start.toLocaleDateString('sq-AL', { weekday: 'short', day: 'numeric', month: 'short' })
  const from = start.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })
  const to = end.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${from} – ${to}`
}

function Stats({ requests, now }: { requests: ServiceRequestItem[]; now: number }) {
  const { t } = useTranslation()
  const awaiting = AWAITING.reduce((sum, status) => sum + (collectionSummary(requests).statusCounts?.[status] ?? 0), 0)
  const accepted = collectionSummary(requests).statusCounts?.accepted ?? 0
  const upcoming = requests
    .filter(
      (item) =>
        item.requestedStartAt &&
        (isAwaiting(item.status) || item.status === 'accepted') &&
        new Date(item.requestedStartAt).getTime() > now,
    )
    .sort((a, b) => new Date(a.requestedStartAt!).getTime() - new Date(b.requestedStartAt!).getTime())

  const stats = [
    { label: t('req.waiting'), value: awaiting, highlight: awaiting > 0 },
    { label: t('req.accepted'), value: accepted },
    { label: t('req.appointments'), value: collectionSummary(requests).upcoming ?? upcoming.length },
  ]

  return (
    <Card className="uo-card">
      <ul className="ur-stats" aria-label={t('req.summary')}>
        {stats.map((stat) => (
          <li key={stat.label} className="ur-stat">
            <span className="ur-stat-label">{stat.label}</span>
            <strong className={`ur-stat-value${stat.highlight ? ' is-highlight' : ''}`}>{stat.value}</strong>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Response({ label, amount, children }: { label: string; amount?: string; children?: ReactNode }) {
  return (
    <div className="ur-response">
      <div className="ur-response-head">
        <span className="ur-response-label">{label}</span>
        {amount ? <strong className="ur-response-amount">{amount}</strong> : null}
      </div>
      {children ? <p>{children}</p> : null}
    </div>
  )
}

function RequestRow({
  item,
  note,
  onNote,
  busy,
  onStatus,
}: {
  item: ServiceRequestItem
  note: string
  onNote: (value: string) => void
  busy: boolean
  onStatus: (status: RequestStatus) => void
}) {
  const { t } = useTranslation()
  const status = statusChip(item.status)
  const waiting = isAwaiting(item.status)
  const client = item.seekerName || t('req.client')
  const appointment = formatAppointment(item.requestedStartAt, item.requestedEndAt)
  const contact = CONTACT[item.contactMethod]
  const contactValue = item.contactPhone || (item.contactMethod === 'email' ? item.contactEmail || item.seekerEmail : '')
  const need = item.need?.trim() || item.message?.trim() || ''

  return (
    <li className={`ur-item${waiting ? ' is-action' : ''}`}>
      <div className="ur-main">
        <div className="ur-top">
          <ProfileAvatar seed={item.seekerUid || client} size={40} alt="" className="ur-avatar" />
          <div className="ur-titles">
            <h3 className="ur-title">{client}</h3>
            <p className="ur-sub">
              <span className="ur-service">{item.serviceTitle || t('req.serviceRequest')}</span>
              <span aria-hidden>·</span>
              <time dateTime={item.createdAt}>{formatWhen(item.createdAt)}</time>
            </p>
          </div>
          <Chip size="sm" variant="soft" color={status.color} className="ur-status">
            <Chip.Label>{t(status.label)}</Chip.Label>
          </Chip>
        </div>

        {need ? <p className="ur-need">{need}</p> : null}

        <ul className="ur-facts">
          {appointment ? (
            <li className="is-strong">
              <CalendarDays size={14} aria-hidden />
              {appointment}
            </li>
          ) : null}
          {contactValue ? (
            <li>
              <contact.icon size={14} aria-hidden />
              {contactValue}
            </li>
          ) : null}
          {item.location ? (
            <li>
              <MapPin size={14} aria-hidden />
              {item.location}
            </li>
          ) : null}
        </ul>

        {item.offer ? (
          <Response label={t('req.yourOffer')} amount={formatAmount(item.offer)}>
            {item.offer.description}
          </Response>
        ) : null}
        {item.providerNote && !waiting ? <Response label={t('req.yourNote')}>{item.providerNote}</Response> : null}

        {waiting || item.status === 'accepted' ? (
          <TextField fullWidth value={note} onChange={onNote} isDisabled={busy} className="ur-reply">
            <Label className="sr-only">{t('req.reply')}</Label>
            <TextArea rows={2} placeholder={t('req.replyPh')} />
          </TextField>
        ) : null}

        <div className="ur-foot">
          <div className="ur-actions is-wrap">
            {item.seekerUid ? (
              <StartChatButton
                providerUid={item.providerUid || ''}
                seekerUid={item.seekerUid}
                seekerName={item.seekerName}
                serviceId={item.serviceId}
                serviceTitle={item.serviceTitle}
                className={`${buttonVariants({ variant: 'outline', size: 'sm' })} ur-chat`}
                label={t('req.message')}
                hideGuestHint
              />
            ) : null}
            {waiting ? (
              <>
                <Button variant="outline" size="sm" className="ur-reject" isDisabled={busy} onPress={() => onStatus('rejected')}>
                  {t('req.decline')}
                </Button>
                <Button variant="primary" size="sm" isPending={busy} onPress={() => onStatus('accepted')}>
                  {busy ? t('req.saving') : t('req.accept')}
                </Button>
              </>
            ) : null}
            {item.status === 'accepted' ? (
              <Button variant="primary" size="sm" isPending={busy} onPress={() => onStatus('completed')}>
                {busy ? t('req.finishing') : t('req.finish')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  )
}

function ListSkeleton() {
  return (
    <ul className="ur-list" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="ur-item">
          <Skeleton className="ur-skel-avatar" />
          <div className="ur-main">
            <Skeleton className="ur-skel-line is-title" />
            <Skeleton className="ur-skel-line is-wide" />
            <Skeleton className="ur-skel-line" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function EmptyState({ servicesPath }: { servicesPath: string }) {
  const { t } = useTranslation()
  return (
    <Card className="uo-card ur-empty">
      <span className="ur-empty-icon" aria-hidden>
        <Inbox size={22} />
      </span>
      <h2>{t('req.emptyIn')}</h2>
      <p>{t('req.emptyInText')}</p>
      <div className="ur-empty-actions">
        <Link to={servicesPath} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Briefcase size={16} aria-hidden />
          {t('req.manage')}
        </Link>
      </div>
    </Card>
  )
}

export function ProviderInboxPage() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const isCompany = pathname.startsWith('/dashboard/company')
  const servicesPath = isCompany ? '/dashboard/company/services' : '/dashboard/provider/services'
  const [requests, setRequests] = useState<ServiceRequestItem[]>([])
  const [loadedAt, setLoadedAt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter] = useState<FilterId>('all')
  const { page, setPage, pagination, receivePagination } = usePagination(filter)
  const requestParams = { page, limit: 20, statuses: FILTERS.find((item) => item.id === filter)?.statuses?.join(',') }
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    setReloadKey((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchRequestInbox(requestParams)
      .then((data) => {
        if (cancelled) return
        setRequests(data.requests)
        receivePagination(data.pagination)
        setLoadedAt(Date.now())
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey, page, filter])

  async function setStatus(id: string, status: RequestStatus) {
    setBusyId(id)
    try {
      await updateRequestStatus(id, { status, providerNote: notes[id]?.trim() || undefined })
      toast.success(t(STATUS_TOAST[status] || 'req.updated'))
      const data = await fetchRequestInbox(requestParams)
      setRequests(data.requests)
        receivePagination(data.pagination)
      setLoadedAt(Date.now())
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const sorted = useMemo(
    () =>
      [...requests].sort(
        (a, b) => rank(a.status) - rank(b.status) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [requests],
  )
  const filters = FILTERS.map((item) => ({
    ...item,
    items: item.id === filter ? sorted : [],
  }))
  const selected = filters.some((item) => item.id === filter) ? filter : 'all'

  return (
    <section className="uo ur ur-simple">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>{t('dash.received')}</h1>
        </div>
      </header>

      {error ? (
        <Alert status="danger" className="uo-alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('req.loadError')}</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="outline" onPress={reload}>
            {t('page.retry')}
          </Button>
        </Alert>
      ) : loading ? (
        <>
          <Card className="uo-card">
            <ul className="ur-stats" aria-hidden>
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="ur-stat">
                  <Skeleton className="ur-skel-line" />
                  <Skeleton className="ur-skel-value" />
                </li>
              ))}
            </ul>
          </Card>
          <Card className="uo-card ur-card">
            <ListSkeleton />
          </Card>
        </>
      ) : requests.length === 0 && filter === 'all' ? (
        <EmptyState servicesPath={servicesPath} />
      ) : (
        <>
          <Stats requests={requests} now={loadedAt} />
          <Card className="uo-card ur-card">
            <Tabs
              variant="secondary"
              selectedKey={selected}
              onSelectionChange={(key) => setFilter(key as FilterId)}
              className="ur-tabs"
            >
              <Tabs.ListContainer className="ur-tabs-bar">
                <Tabs.List aria-label={t('req.filter')}>
                  {filters.map((item) => (
                    <Tabs.Tab key={item.id} id={item.id} className="ur-tab">
                      {t(item.label)}
                      <span className="ur-tab-count">{item.statuses ? item.statuses.reduce((sum, status) => sum + (collectionSummary(requests).statusCounts?.[status] ?? 0), 0) : collectionTotal(requests)}</span>
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
              {filters.map((item) => (
                <Tabs.Panel key={item.id} id={item.id} className="ur-panel">
                  <ul className="ur-list">
                    {item.items.map((request) => (
                      <RequestRow
                        key={request.id}
                        item={request}
                        note={notes[request.id] || ''}
                        onNote={(value) => setNotes((prev) => ({ ...prev, [request.id]: value }))}
                        busy={busyId === request.id}
                        onStatus={(status) => void setStatus(request.id, status)}
                      />
                    ))}
                  </ul>
                </Tabs.Panel>
              ))}
            </Tabs>
            <KeshillaPagination pagination={pagination} onPageChange={setPage} isDisabled={loading} />
          </Card>
        </>
      )}
    </section>
  )
}
