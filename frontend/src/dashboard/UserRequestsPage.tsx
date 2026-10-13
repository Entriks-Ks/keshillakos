import { collectionSummary, collectionTotal } from '../api/pagination'
import KeshillaPagination from '../components/KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Alert, Button, buttonVariants, Card, Chip, Skeleton, Tabs } from '@heroui/react'
import { CalendarDays, Inbox, Mail, MapPin, MessageCircle, Phone, Search } from 'lucide-react'
import { fetchMyRequests, type RequestStatus, type ServiceRequestItem } from '../api/requests'
import ProfileAvatar from '../components/ProfileAvatar'
import RateProvider from '../components/RateProvider'
import StartChatButton from '../components/StartChatButton'
import { getErrorMessage } from '../utils/errors'
import { providerPath } from '../utils/publicPaths'
import { formatAmount, formatWhen, REQUEST_STATUS } from './requestDisplay'
import './UserOverview.css'
import './UserRequests.css'

type FilterId = 'all' | 'waiting' | 'accepted' | 'completed' | 'closed'

const FILTERS: Array<{ id: FilterId; label: string; statuses?: RequestStatus[] }> = [
  { id: 'all', label: 'req.all' },
  { id: 'waiting', label: 'req.waiting', statuses: ['open', 'pending', 'read'] },
  { id: 'accepted', label: 'req.accepted', statuses: ['accepted'] },
  { id: 'completed', label: 'req.completed', statuses: ['completed'] },
  { id: 'closed', label: 'req.closed', statuses: ['rejected', 'withdrawn'] },
]

const AWAITING: RequestStatus[] = ['open', 'pending', 'read']
const SCHEDULABLE: RequestStatus[] = ['open', 'pending', 'read', 'accepted']

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
  const offers = collectionSummary(requests).offers ?? 0
  const upcoming = requests
    .filter((item) => item.requestedStartAt && SCHEDULABLE.includes(item.status) && new Date(item.requestedStartAt).getTime() > now)
    .sort((a, b) => new Date(a.requestedStartAt!).getTime() - new Date(b.requestedStartAt!).getTime())

  const stats = [
    { label: t('req.waiting'), value: awaiting },
    { label: t('req.offers'), value: offers },
    { label: t('req.appointments'), value: collectionSummary(requests).upcoming ?? upcoming.length },
  ]

  return (
    <Card className="uo-card">
      <ul className="ur-stats" aria-label={t('req.summary')}>
        {stats.map((stat) => (
          <li key={stat.label} className="ur-stat">
            <span className="ur-stat-label">{stat.label}</span>
            <strong className="ur-stat-value">{stat.value}</strong>
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

function RequestRow({ item, showRating }: { item: ServiceRequestItem; showRating: boolean }) {
  const { t } = useTranslation()
  const status = REQUEST_STATUS[item.status] ?? { label: item.status, color: 'default' as const }
  const provider = item.providerName || t('req.provider')
  const profileTo = item.providerUid ? providerPath({ uid: item.providerUid, name: item.providerName }) : null
  const appointment = formatAppointment(item.requestedStartAt, item.requestedEndAt)
  const contactValue =
    item.contactPhone || (item.contactMethod === 'email' ? item.contactEmail || item.seekerEmail : '')
  const title = item.serviceTitle || item.need || t('req.request')
  const detail = item.serviceTitle && item.need?.trim() && item.need.trim() !== item.serviceTitle ? item.need.trim() : ''

  return (
    <li className="ur-item">
      <div className="ur-main">
        <div className="ur-top">
          <ProfileAvatar seed={item.providerUid || item.providerName} size={40} alt="" className="ur-avatar" />
          <div className="ur-titles">
            <h3 className="ur-title">{title}</h3>
            <p className="ur-sub">
              {profileTo ? (
                <Link to={profileTo} className="ur-provider">
                  {provider}
                </Link>
              ) : (
                <span className="ur-provider">{provider}</span>
              )}
              <span aria-hidden>·</span>
              <time dateTime={item.createdAt}>{formatWhen(item.createdAt)}</time>
            </p>
          </div>
          <Chip size="sm" variant="soft" color={status.color} className="ur-status">
            <Chip.Label>{t(status.label)}</Chip.Label>
          </Chip>
        </div>

        {detail ? <p className="ur-need">{detail}</p> : null}

        <ul className="ur-facts">
          {appointment ? (
            <li className="is-strong">
              <CalendarDays size={14} aria-hidden />
              {appointment}
            </li>
          ) : null}
          {contactValue ? (
            <li>
              {item.contactMethod === 'email' ? <Mail size={14} aria-hidden /> : item.contactMethod === 'phone' ? <Phone size={14} aria-hidden /> : <MessageCircle size={14} aria-hidden />}
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
          <Response label={t('req.offer')} amount={formatAmount(item.offer)}>
            {item.offer.description}
          </Response>
        ) : null}
        {item.providerNote ? <Response label={t('req.reply')}>{item.providerNote}</Response> : null}

        <div className="ur-foot">
          <div className="ur-actions">
            {item.providerUid ? (
              <StartChatButton
                providerUid={item.providerUid}
                providerName={item.providerName}
                serviceId={item.serviceId}
                serviceTitle={item.serviceTitle}
                className={`${buttonVariants({ variant: 'outline', size: 'sm' })} ur-chat`}
                label={t('req.message')}
                hideGuestHint
              />
            ) : null}
            {profileTo ? (
              <Link to={profileTo} className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} ur-chat`}>
                {t('req.profile')}
              </Link>
            ) : null}
          </div>
        </div>

        {showRating && item.providerUid ? (
          <div className="ur-rate">
            <RateProvider providerUid={item.providerUid} providerName={provider} providerId={item.providerId} quiet />
          </div>
        ) : null}
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

function EmptyState() {
  const { t } = useTranslation()
  return (
    <Card className="uo-card ur-empty">
      <span className="ur-empty-icon" aria-hidden>
        <Inbox size={22} />
      </span>
      <h2>{t('req.emptyMine')}</h2>
      <p>{t('req.emptyMineText')}</p>
      <div className="ur-empty-actions">
        <Link to="/ofertat" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
          <Search size={16} aria-hidden />
          {t('req.browse')}
        </Link>
      </div>
    </Card>
  )
}

export function UserRequestsPage() {
  const { t } = useTranslation()
  const [requests, setRequests] = useState<ServiceRequestItem[]>([])
  const [loadedAt, setLoadedAt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter] = useState<FilterId>('all')
  const { page, setPage, pagination, receivePagination } = usePagination(filter)
  const requestParams = { page, limit: 20, statuses: FILTERS.find((item) => item.id === filter)?.statuses?.join(',') }

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    setReloadKey((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchMyRequests(requestParams)
      .then((items) => {
        if (cancelled) return
        setRequests(items)
        receivePagination(items.pagination)
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

  const filters = FILTERS.map((item) => ({
    ...item,
    items: item.id === filter ? requests : [],
  }))
  const selected = filters.some((item) => item.id === filter) ? filter : 'all'

  /** One rating prompt per provider, on their most recent completed request. */
  const ratingIds = useMemo(() => {
    const seen = new Set<string>()
    const ids = new Set<string>()
    for (const request of requests) {
      if (request.status !== 'completed' || !request.providerUid || seen.has(request.providerUid)) continue
      seen.add(request.providerUid)
      ids.add(request.id)
    }
    return ids
  }, [requests])

  return (
    <section className="uo ur ur-simple">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>{t('dash.myRequests')}</h1>
        </div>
        <Link to="/ofertat" className={`${buttonVariants({ variant: 'primary' })} uo-primary`}>
          <Search size={16} aria-hidden />
          {t('req.browse')}
        </Link>
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
        <EmptyState />
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
                      <RequestRow key={request.id} item={request} showRating={ratingIds.has(request.id)} />
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
