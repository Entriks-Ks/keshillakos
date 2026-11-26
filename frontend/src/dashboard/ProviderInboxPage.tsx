import { collectionSummary, collectionTotal } from '../api/pagination'
import KeshillaPagination from '../components/KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../i18n'
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
import { Briefcase, CalendarDays, Inbox, Mail, MapPin, MessageCircle, MessageSquareText, Phone } from 'lucide-react'
import { fetchRequestInbox, updateRequestStatus, type RequestStatus, type ServiceRequestItem } from '../api/requests'
import ProfileAvatar from '../components/ProfileAvatar'
import StartChatButton from '../components/StartChatButton'
import { getErrorMessage } from '../utils/errors'
import { formatAmount, formatWhen, REQUEST_STATUS, type ChipColor } from './requestDisplay'
import './UserOverview.css'
import './UserRequests.css'
import './ProviderInbox.css'

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
  chat: { label: 'req.chat', icon: MessageCircle },
  phone: { label: 'req.phone', icon: Phone },
  email: { label: 'req.email', icon: Mail },
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
  const day = start.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
  const from = start.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
  const to = end.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
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
    <div className="ri-response">
      <div className="ri-response-head">
        <span className="ri-response-label">{label}</span>
        {amount ? <strong className="ri-response-amount">{amount}</strong> : null}
      </div>
      {children ? <p>{children}</p> : null}
    </div>
  )
}

/** Long requests stay three lines in the list; "Read more" appears only when the text is really cut off. */
function useIsClamped<T extends HTMLElement>(text: string, clamped: boolean) {
  const ref = useRef<T>(null)
  const [overflowing, setOverflowing] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !clamped) return
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text, clamped])
  return [ref, overflowing] as const
}

type Busy = { id: string; status: RequestStatus } | null

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
  busy: RequestStatus | null
  onStatus: (status: RequestStatus) => void
}) {
  const { t } = useTranslation()
  const [replyOpen, setReplyOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const status = statusChip(item.status)
  const waiting = isAwaiting(item.status)
  const accepted = item.status === 'accepted'
  const tone = waiting ? 'waiting' : item.status
  const client = item.seekerName || t('req.client')
  const appointment = formatAppointment(item.requestedStartAt, item.requestedEndAt)
  const contact = CONTACT[item.contactMethod]
  const contactValue = item.contactPhone || (item.contactMethod === 'email' ? item.contactEmail || item.seekerEmail : '')
  const contactHref = contactValue
    ? item.contactPhone
      ? `tel:${item.contactPhone.replace(/[^\d+]/g, '')}`
      : `mailto:${contactValue}`
    : ''
  const need = item.need?.trim() || item.message?.trim() || ''
  const [needRef, needOverflowing] = useIsClamped<HTMLParagraphElement>(need, !expanded)
  const longNeed = expanded || needOverflowing
  const canReply = waiting || accepted
  const showReply = canReply && (replyOpen || note.length > 0)
  const isBusy = busy !== null
  const chat = item.seekerUid ? (
    <StartChatButton
      providerUid={item.providerUid || ''}
      seekerUid={item.seekerUid}
      seekerName={item.seekerName}
      serviceId={item.serviceId}
      serviceTitle={item.serviceTitle}
      className={`${buttonVariants({ variant: 'outline', size: 'sm' })} ri-chat`}
      label={t('req.message')}
      hideGuestHint
    />
  ) : null

  return (
    <li className={`ri-item is-${tone}`}>
      <ProfileAvatar seed={item.seekerUid || client} size={40} alt="" className="ri-avatar" />

      <div className="ri-head">
        <h3 className="ri-name" title={client}>
          {client}
        </h3>
        <p className="ri-meta">
          <span className="ri-service">{item.serviceTitle || t('req.serviceRequest')}</span>
          <time dateTime={item.createdAt}>
            {t('req.received')} {formatWhen(item.createdAt)}
          </time>
        </p>
      </div>

      <Chip size="sm" variant="soft" color={status.color} className="ri-status">
        <Chip.Label>{t(status.label)}</Chip.Label>
      </Chip>

      <div className="ri-body">
        {need ? (
          <div className="ri-need-wrap">
            <p ref={needRef} className={`ri-need${expanded ? '' : ' is-clamped'}`}>
              {need}
            </p>
            {longNeed ? (
              <button type="button" className="ri-link" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                {expanded ? t('cards.readLess') : t('cards.readMore')}
              </button>
            ) : null}
          </div>
        ) : null}

        {appointment || contactValue || item.location ? (
          <ul className="ri-facts">
            {appointment ? (
              <li className="ri-fact is-appointment">
                <CalendarDays size={14} aria-hidden />
                <span>{appointment}</span>
              </li>
            ) : null}
            {contactValue ? (
              <li className="ri-fact">
                <contact.icon size={14} aria-hidden />
                <a href={contactHref} className="ri-fact-link" title={contactValue}>
                  {contactValue}
                </a>
              </li>
            ) : null}
            {item.location ? (
              <li className="ri-fact">
                <MapPin size={14} aria-hidden />
                <span>{item.location}</span>
              </li>
            ) : null}
          </ul>
        ) : null}

        {item.offer ? (
          <Response label={t('req.yourOffer')} amount={formatAmount(item.offer)}>
            {item.offer.description}
          </Response>
        ) : null}
        {item.providerNote && !waiting ? <Response label={t('req.yourNote')}>{item.providerNote}</Response> : null}
      </div>

      <div className="ri-foot">
        {canReply ? (
          <div className="ri-reply-area">
            {showReply ? (
              <TextField fullWidth value={note} onChange={onNote} isDisabled={isBusy} className="ri-reply">
                <Label className="sr-only">{t('req.reply')}</Label>
                <TextArea rows={2} placeholder={t('req.replyPh')} autoFocus={replyOpen && note.length === 0} />
              </TextField>
            ) : (
              <button type="button" className="ri-link ri-reply-toggle" onClick={() => setReplyOpen(true)}>
                <MessageSquareText size={15} aria-hidden />
                {t('req.addReply')}
              </button>
            )}
          </div>
        ) : null}

        {chat || waiting || accepted ? (
          <div className={`ri-actions${waiting ? ' has-decision' : ''}${!waiting && !accepted ? ' is-single' : ''}`}>
            {chat}
            {waiting ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="ri-decline"
                  isDisabled={isBusy && busy !== 'rejected'}
                  isPending={busy === 'rejected'}
                  onPress={() => onStatus('rejected')}
                >
                  {busy === 'rejected' ? t('req.saving') : t('req.decline')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  isDisabled={isBusy && busy !== 'accepted'}
                  isPending={busy === 'accepted'}
                  onPress={() => onStatus('accepted')}
                >
                  {busy === 'accepted' ? t('req.saving') : t('req.accept')}
                </Button>
              </>
            ) : null}
            {accepted ? (
              <Button variant="primary" size="sm" isPending={busy === 'completed'} onPress={() => onStatus('completed')}>
                {busy === 'completed' ? t('req.finishing') : t('req.finish')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}

function ListSkeleton() {
  return (
    <ul className="ri-list" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="ri-item ri-skel">
          <Skeleton className="ri-avatar ri-skel-avatar" />
          <div className="ri-head">
            <Skeleton className="ur-skel-line is-title" />
            <Skeleton className="ur-skel-line" />
          </div>
          <div className="ri-body">
            <Skeleton className="ur-skel-line is-wide" />
            <Skeleton className="ur-skel-line is-wide" />
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
  const [busy, setBusy] = useState<Busy>(null)
  const hasLoaded = loadedAt > 0

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
    setBusy({ id, status })
    try {
      await updateRequestStatus(id, { status, providerNote: notes[id]?.trim() || undefined })
      toast.success(t(STATUS_TOAST[status] || 'req.updated'))
      // The note went out with this update; don't leave it in the box to be sent again.
      setNotes(({ [id]: _sent, ...rest }) => rest)
      const data = await fetchRequestInbox(requestParams)
      setRequests(data.requests)
      receivePagination(data.pagination)
      setLoadedAt(Date.now())
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const sorted = useMemo(
    () =>
      [...requests].sort(
        (a, b) => rank(a.status) - rank(b.status) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [requests],
  )
  const summary = collectionSummary(requests)
  // The summary covers every status, so tab counts stay the same whichever tab is open.
  const countFor = (statuses?: RequestStatus[]) =>
    statuses
      ? statuses.reduce((sum, status) => sum + (summary.statusCounts?.[status] ?? 0), 0)
      : summary.total ?? collectionTotal(requests)
  const firstLoad = loading && !hasLoaded
  const inboxEmpty = hasLoaded && !loading && filter === 'all' && requests.length === 0

  return (
    <section className="uo ur ri">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>{t('dash.received')}</h1>
        </div>
      </header>

      {error && !hasLoaded ? (
        <InboxError message={error} onRetry={reload} />
      ) : firstLoad ? (
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
          <Card className="uo-card ri-card">
            <ListSkeleton />
          </Card>
        </>
      ) : inboxEmpty ? (
        <EmptyState servicesPath={servicesPath} />
      ) : (
        <>
          <Stats requests={requests} now={loadedAt} />
          <Card className="uo-card ri-card">
            <Tabs
              variant="secondary"
              selectedKey={filter}
              onSelectionChange={(key) => setFilter(key as FilterId)}
              className="ur-tabs ri-tabs"
            >
              <Tabs.ListContainer className="ur-tabs-bar">
                <Tabs.List aria-label={t('req.filter')}>
                  {FILTERS.map((item) => (
                    <Tabs.Tab key={item.id} id={item.id} className={`ur-tab ri-tab is-${item.id}`}>
                      {t(item.label)}
                      <span className="ur-tab-count">{countFor(item.statuses)}</span>
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
              {FILTERS.map((item) => (
                <Tabs.Panel key={item.id} id={item.id} className="ur-panel">
                  {item.id !== filter ? null : error ? (
                    <div className="ri-panel-state">
                      <InboxError message={error} onRetry={reload} />
                    </div>
                  ) : loading ? (
                    <ListSkeleton />
                  ) : sorted.length === 0 ? (
                    <div className="ri-panel-state ri-filter-empty">
                      <p>{t('req.emptyFilter')}</p>
                      <Button variant="outline" size="sm" onPress={() => setFilter('all')}>
                        {t('req.showAll')}
                      </Button>
                    </div>
                  ) : (
                    <ul className="ri-list" aria-busy={busy !== null}>
                      {sorted.map((request) => (
                        <RequestRow
                          key={request.id}
                          item={request}
                          note={notes[request.id] || ''}
                          onNote={(value) => setNotes((prev) => ({ ...prev, [request.id]: value }))}
                          busy={busy?.id === request.id ? busy.status : null}
                          onStatus={(status) => void setStatus(request.id, status)}
                        />
                      ))}
                    </ul>
                  )}
                </Tabs.Panel>
              ))}
            </Tabs>
            <div className="ri-pager">
              <KeshillaPagination pagination={pagination} onPageChange={setPage} isDisabled={loading} />
            </div>
          </Card>
        </>
      )}
    </section>
  )
}

function InboxError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <Alert status="danger" className="uo-alert ri-alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t('req.loadError')}</Alert.Title>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
      <Button size="sm" variant="outline" onPress={onRetry}>
        {t('page.retry')}
      </Button>
    </Alert>
  )
}
