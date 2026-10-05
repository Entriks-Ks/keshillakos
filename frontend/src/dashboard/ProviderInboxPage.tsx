import { collectionSummary, collectionTotal } from '../api/pagination'
import KeshillaPagination from '../components/KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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
import { Briefcase, CalendarDays, Clock, Inbox, Languages, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
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
  { id: 'all', label: 'Të gjitha' },
  { id: 'waiting', label: 'Në pritje', statuses: AWAITING },
  { id: 'accepted', label: 'Pranuar', statuses: ['accepted'] },
  { id: 'completed', label: 'Përfunduar', statuses: ['completed'] },
  { id: 'rejected', label: 'Refuzuar', statuses: ['rejected'] },
]

const CONTACT = {
  chat: { label: 'Chat', icon: MessageCircle },
  phone: { label: 'Telefon', icon: Phone },
  email: { label: 'Email', icon: Mail },
} as const

const URGENCY_LABELS: Record<string, string> = {
  today: 'Sot',
  this_week: 'Këtë javë',
  flexible: 'Fleksibël',
}

const STATUS_TOAST: Partial<Record<RequestStatus, string>> = {
  accepted: 'Kërkesa u pranua.',
  rejected: 'Kërkesa u refuzua.',
  completed: 'Kërkesa u shënua si e përfunduar.',
}

function isAwaiting(status: RequestStatus) {
  return AWAITING.includes(status)
}

function statusChip(status: RequestStatus): { label: string; color: ChipColor } {
  if (isAwaiting(status)) return { label: 'Në pritje', color: 'warning' }
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

function wasUpdated(item: ServiceRequestItem) {
  return new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime() > 60_000
}

function Stats({ requests, now }: { requests: ServiceRequestItem[]; now: number }) {
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
    {
      label: 'Në pritje të përgjigjes',
      value: awaiting,
      hint: awaiting > 0 ? 'Prano ose refuzo kërkesat' : 'Të gjitha kanë përgjigje',
      highlight: awaiting > 0,
    },
    {
      label: 'Pranuar, në vazhdim',
      value: accepted,
      hint: accepted > 0 ? 'Shëno si të përfunduara kur të kryhen' : 'Asnjë në vazhdim',
    },
    {
      label: 'Termine të kërkuara',
      value: collectionSummary(requests).upcoming ?? upcoming.length,
      hint: upcoming[0]?.requestedStartAt ? `Tjetri: ${formatWhen(upcoming[0].requestedStartAt)}` : 'Asnjë i ardhshëm',
    },
  ]

  return (
    <Card className="uo-card">
      <ul className="ur-stats" aria-label="Përmbledhje e kërkesave">
        {stats.map((stat) => (
          <li key={stat.label} className="ur-stat">
            <span className="ur-stat-label">{stat.label}</span>
            <strong className={`ur-stat-value${stat.highlight ? ' is-highlight' : ''}`}>{stat.value}</strong>
            <span className="ur-stat-hint">{stat.hint}</span>
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
  const status = statusChip(item.status)
  const waiting = isAwaiting(item.status)
  const client = item.seekerName || 'Klient'
  const appointment = formatAppointment(item.requestedStartAt, item.requestedEndAt)
  const contact = CONTACT[item.contactMethod]
  const contactValue = item.contactPhone || (item.contactMethod === 'email' ? item.contactEmail || item.seekerEmail : '')
  const showSeekerEmail = Boolean(item.seekerEmail && item.seekerEmail !== contactValue)
  const need = item.need?.trim() || ''
  const extraMessage = item.message && item.message.trim() !== need ? item.message : ''

  return (
    <li className={`ur-item${waiting ? ' is-action' : ''}`}>
      <ProfileAvatar seed={item.seekerUid || client} size={36} alt="" className="ur-avatar" />
      <div className="ur-main">
        <div className="ur-top">
          <div className="ur-titles">
            <h3 className="ur-title">{client}</h3>
            <p className="ur-sub">
              <span className="ur-service">
                <Briefcase size={13} aria-hidden />
                {item.serviceTitle || 'Kërkesë për shërbim'}
              </span>
              <span aria-hidden>·</span>
              <time dateTime={item.createdAt}>Marrë {formatWhen(item.createdAt)}</time>
            </p>
          </div>
          <div className="ur-chips">
            {item.status === 'pending' ? (
              <Chip size="sm" variant="soft" color="accent">
                <Chip.Label>E re</Chip.Label>
              </Chip>
            ) : null}
            <Chip size="sm" variant="soft" color={status.color} className="ur-status">
              <Chip.Label>{status.label}</Chip.Label>
            </Chip>
          </div>
        </div>

        {need || extraMessage ? (
          <>
            {need ? <p className="ur-need">{need}</p> : null}
            {extraMessage ? <p className="ur-message">{extraMessage}</p> : null}
          </>
        ) : (
          <p className="ur-message">Pa përshkrim</p>
        )}

        <ul className="ur-facts">
          <li className={appointment ? 'is-strong' : undefined}>
            <CalendarDays size={14} aria-hidden />
            {appointment || 'Klienti nuk ka zgjedhur ende një orë'}
          </li>
          {contact ? (
            <li>
              <contact.icon size={14} aria-hidden />
              {contact.label}
              {contactValue ? ` · ${contactValue}` : ''}
            </li>
          ) : null}
          {showSeekerEmail ? (
            <li>
              <Mail size={14} aria-hidden />
              {item.seekerEmail}
            </li>
          ) : null}
          {item.location ? (
            <li>
              <MapPin size={14} aria-hidden />
              {item.location}
            </li>
          ) : null}
          {item.urgency ? (
            <li>
              <Clock size={14} aria-hidden />
              {URGENCY_LABELS[item.urgency] || item.urgency}
            </li>
          ) : null}
          {item.language ? (
            <li>
              <Languages size={14} aria-hidden />
              {item.language}
            </li>
          ) : null}
        </ul>

        {item.offer ? (
          <Response label="Oferta jote" amount={formatAmount(item.offer)}>
            {item.offer.description}
          </Response>
        ) : null}
        {item.providerNote && !waiting ? <Response label="Shënimi yt">{item.providerNote}</Response> : null}

        {waiting || item.status === 'accepted' ? (
          <TextField fullWidth value={note} onChange={onNote} isDisabled={busy} className="ur-reply">
            <Label>{waiting ? 'Përgjigja për klientin (opsionale)' : 'Shënim përfundimi (opsionale)'}</Label>
            <TextArea
              rows={2}
              placeholder={waiting ? 'P.sh. e pranoj orën, na shohim atë ditë.' : 'P.sh. takimi u krye, faleminderit.'}
            />
          </TextField>
        ) : null}

        <div className="ur-foot">
          {wasUpdated(item) ? (
            <time className="ur-updated" dateTime={item.updatedAt}>
              Përditësuar {formatWhen(item.updatedAt)}
            </time>
          ) : (
            <span />
          )}
          <div className="ur-actions is-wrap">
            {item.seekerUid ? (
              <StartChatButton
                providerUid={item.providerUid || ''}
                seekerUid={item.seekerUid}
                seekerName={item.seekerName}
                serviceId={item.serviceId}
                serviceTitle={item.serviceTitle}
                className={`${buttonVariants({ variant: 'outline', size: 'sm' })} ur-chat`}
                label="Dërgo mesazh"
                hideGuestHint
              />
            ) : null}
            {waiting ? (
              <>
                <Button variant="outline" size="sm" className="ur-reject" isDisabled={busy} onPress={() => onStatus('rejected')}>
                  Refuzo
                </Button>
                <Button variant="primary" size="sm" isPending={busy} onPress={() => onStatus('accepted')}>
                  {busy ? 'Duke ruajtur…' : 'Prano'}
                </Button>
              </>
            ) : null}
            {item.status === 'accepted' ? (
              <Button variant="primary" size="sm" isPending={busy} onPress={() => onStatus('completed')}>
                {busy ? 'Duke përfunduar…' : 'Përfundo kërkesën'}
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

function EmptyState({ servicesPath, isCompany }: { servicesPath: string; isCompany: boolean }) {
  return (
    <Card className="uo-card ur-empty">
      <span className="ur-empty-icon" aria-hidden>
        <Inbox size={22} />
      </span>
      <h2>Ende nuk ke marrë kërkesa</h2>
      <p>
        Kur klientët të dërgojnë kërkesë për {isCompany ? 'shërbimet e kompanisë' : 'shërbimet e tua'}, ato shfaqen këtu.
        Mund t’i pranosh, t’i refuzosh ose t’u shkruash direkt klientëve.
      </p>
      <div className="ur-empty-actions">
        <Link to={servicesPath} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Briefcase size={16} aria-hidden />
          Menaxho shërbimet
        </Link>
      </div>
    </Card>
  )
}

export function ProviderInboxPage() {
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
      toast.success(STATUS_TOAST[status] || 'Statusi u përditësua.')
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
    <section className="uo ur">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>Kërkesat e marra</h1>
          <p>
            Kërkesat që klientët kanë dërguar për {isCompany ? 'shërbimet e kompanisë' : 'shërbimet e tua'}. Prano ose
            refuzo, shto një përgjigje dhe vazhdo bisedën me klientin.
          </p>
        </div>
      </header>

      {error ? (
        <Alert status="danger" className="uo-alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Kërkesat nuk u ngarkuan</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="outline" onPress={reload}>
            Provo përsëri
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
        <EmptyState servicesPath={servicesPath} isCompany={isCompany} />
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
                <Tabs.List aria-label="Filtro kërkesat sipas statusit">
                  {filters.map((item) => (
                    <Tabs.Tab key={item.id} id={item.id} className="ur-tab">
                      {item.label}
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
