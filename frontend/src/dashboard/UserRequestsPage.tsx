import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, buttonVariants, Card, Chip, Dropdown, Label, Skeleton, Tabs } from '@heroui/react'
import {
  CalendarDays,
  Clock,
  Inbox,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
  Star,
  UserRound,
} from 'lucide-react'
import { fetchMyRequests, type RequestStatus, type ServiceRequestItem } from '../api/requests'
import ProfileAvatar from '../components/ProfileAvatar'
import RateProvider from '../components/RateProvider'
import StartChatButton from '../components/StartChatButton'
import { getErrorMessage } from '../utils/errors'
import { providerPath } from '../utils/publicPaths'
import { marketplaceLink } from '../utils/siteNavMenu'
import { formatAmount, formatWhen, REQUEST_STATUS } from './requestDisplay'
import './UserOverview.css'
import './UserRequests.css'

type FilterId = 'all' | 'waiting' | 'accepted' | 'completed' | 'closed'

const FILTERS: Array<{ id: FilterId; label: string; statuses?: RequestStatus[] }> = [
  { id: 'all', label: 'Të gjitha' },
  { id: 'waiting', label: 'Në pritje', statuses: ['open', 'pending', 'read'] },
  { id: 'accepted', label: 'Pranuar', statuses: ['accepted'] },
  { id: 'completed', label: 'Përfunduar', statuses: ['completed'] },
  { id: 'closed', label: 'Refuzuar / tërhequr', statuses: ['rejected', 'withdrawn'] },
]

const AWAITING: RequestStatus[] = ['open', 'pending', 'read']
const SCHEDULABLE: RequestStatus[] = ['open', 'pending', 'read', 'accepted']

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
  const awaiting = requests.filter((item) => AWAITING.includes(item.status)).length
  const offers = requests.filter((item) => item.offer).length
  const upcoming = requests
    .filter((item) => item.requestedStartAt && SCHEDULABLE.includes(item.status) && new Date(item.requestedStartAt).getTime() > now)
    .sort((a, b) => new Date(a.requestedStartAt!).getTime() - new Date(b.requestedStartAt!).getTime())

  const stats = [
    {
      label: 'Në pritje të përgjigjes',
      value: awaiting,
      hint: awaiting > 0 ? 'Ofruesi ende s’është përgjigjur' : 'Të gjitha kanë përgjigje',
    },
    { label: 'Oferta të marra', value: offers, hint: offers > 0 ? 'Shiko detajet te kërkesa' : 'Asnjë ende' },
    {
      label: 'Termine të kërkuara',
      value: upcoming.length,
      hint: upcoming[0]?.requestedStartAt ? `Tjetri: ${formatWhen(upcoming[0].requestedStartAt)}` : 'Asnjë i ardhshëm',
    },
  ]

  return (
    <Card className="uo-card">
      <ul className="ur-stats" aria-label="Përmbledhje e kërkesave">
        {stats.map((stat) => (
          <li key={stat.label} className="ur-stat">
            <span className="ur-stat-label">{stat.label}</span>
            <strong className="ur-stat-value">{stat.value}</strong>
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

function RequestRow({ item, showRating }: { item: ServiceRequestItem; showRating: boolean }) {
  const status = REQUEST_STATUS[item.status] ?? { label: item.status, color: 'default' as const }
  const provider = item.providerName || 'Ofruesi'
  const profileTo = item.providerUid ? providerPath({ uid: item.providerUid, name: item.providerName }) : null
  const appointment = formatAppointment(item.requestedStartAt, item.requestedEndAt)
  const contact = CONTACT[item.contactMethod]
  const contactValue =
    item.contactPhone || (item.contactMethod === 'email' ? item.contactEmail || item.seekerEmail : '')
  const title = item.serviceTitle || item.need || 'Kërkesë'
  const showNeed = Boolean(item.serviceTitle && item.need)
  const awaiting = AWAITING.includes(item.status)

  return (
    <li className="ur-item">
      <ProfileAvatar seed={item.providerUid || item.providerName} size={36} alt="" className="ur-avatar" />
      <div className="ur-main">
        <div className="ur-top">
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
              <time dateTime={item.createdAt}>Dërguar {formatWhen(item.createdAt)}</time>
            </p>
          </div>
          <Chip size="sm" variant="soft" color={status.color} className="ur-status">
            <Chip.Label>{status.label}</Chip.Label>
          </Chip>
        </div>

        {showNeed ? <p className="ur-need">{item.need}</p> : null}
        {item.message ? <p className="ur-message">{item.message}</p> : null}

        <ul className="ur-facts">
          {appointment ? (
            <li className="is-strong">
              <CalendarDays size={14} aria-hidden />
              {appointment}
            </li>
          ) : null}
          {contact ? (
            <li>
              <contact.icon size={14} aria-hidden />
              {contact.label}
              {contactValue ? ` · ${contactValue}` : ''}
            </li>
          ) : null}
          {item.urgency ? (
            <li>
              <Clock size={14} aria-hidden />
              {URGENCY_LABELS[item.urgency] || item.urgency}
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
          <Response label={`Oferta nga ${provider}`} amount={formatAmount(item.offer)}>
            {item.offer.description}
          </Response>
        ) : null}
        {item.providerNote ? <Response label="Përgjigja e ofruesit">{item.providerNote}</Response> : null}
        {!item.offer && !item.providerNote && (awaiting || item.status === 'accepted') ? (
          <p className="ur-waiting">
            <Clock size={14} aria-hidden />
            {awaiting
              ? `Në pritje të përgjigjes nga ${provider}.`
              : 'Ofruesi do ta shënojë kërkesën si të përfunduar.'}
          </p>
        ) : null}

        <div className="ur-foot">
          {wasUpdated(item) ? (
            <time className="ur-updated" dateTime={item.updatedAt}>
              Përditësuar {formatWhen(item.updatedAt)}
            </time>
          ) : (
            <span />
          )}
          <div className="ur-actions">
            {item.providerUid ? (
              <StartChatButton
                providerUid={item.providerUid}
                providerName={item.providerName}
                serviceId={item.serviceId}
                serviceTitle={item.serviceTitle}
                className={`${buttonVariants({ variant: 'outline', size: 'sm' })} ur-chat`}
                label="Dërgo mesazh"
                hideGuestHint
              />
            ) : (
              <Link to="/dashboard/user/messages" className={`${buttonVariants({ variant: 'outline', size: 'sm' })} ur-chat`}>
                <MessageCircle size={16} aria-hidden />
                Mesazhet
              </Link>
            )}
            {profileTo ? (
              <Dropdown>
                <Button isIconOnly variant="ghost" size="sm" className="ur-more" aria-label={`Më shumë për ${provider}`}>
                  <MoreHorizontal size={18} aria-hidden />
                </Button>
                <Dropdown.Popover placement="bottom end" className="ur-menu">
                  <Dropdown.Menu aria-label="Veprime për kërkesën">
                    <Dropdown.Item id="profile" href={profileTo} textValue="Shiko profilin">
                      <UserRound size={16} aria-hidden className="ur-menu-icon" />
                      <Label>Shiko profilin</Label>
                    </Dropdown.Item>
                    {item.status === 'completed' ? (
                      <Dropdown.Item id="reviews" href={`${profileTo}#vleresimet`} textValue="Shiko vlerësimet">
                        <Star size={16} aria-hidden className="ur-menu-icon" />
                        <Label>Shiko vlerësimet</Label>
                      </Dropdown.Item>
                    ) : null}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
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
  const experts = marketplaceLink('experts')
  const companies = marketplaceLink('companies')
  return (
    <Card className="uo-card ur-empty">
      <span className="ur-empty-icon" aria-hidden>
        <Inbox size={22} />
      </span>
      <h2>Ende nuk ke dërguar kërkesë</h2>
      <p>
        Zgjidh një shërbim, ekspert ose kompani dhe dërgo kërkesën tënde. Këtu do të ndjekësh statusin, përgjigjet dhe
        ofertat e ofruesve.
      </p>
      <div className="ur-empty-actions">
        <Link to="/ofertat" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
          <Search size={16} aria-hidden />
          Shfleto shërbimet
        </Link>
        <Link to={experts.to} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {experts.label}
        </Link>
        <Link to={companies.to} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {companies.label}
        </Link>
      </div>
    </Card>
  )
}

export function UserRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequestItem[]>([])
  const [loadedAt, setLoadedAt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter] = useState<FilterId>('all')

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    setReloadKey((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchMyRequests()
      .then((items) => {
        if (cancelled) return
        setRequests(items)
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
  }, [reloadKey])

  const filters = FILTERS.map((item) => ({
    ...item,
    items: item.statuses ? requests.filter((request) => item.statuses!.includes(request.status)) : requests,
  })).filter((item) => item.id === 'all' || item.items.length > 0)
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
    <section className="uo ur">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>Kërkesat e mia</h1>
          <p>Ndiq statusin e kërkesave që ke dërguar, lexo përgjigjet dhe ofertat e ofruesve dhe vazhdo bisedën me ta.</p>
        </div>
        <Link to="/ofertat" className={`${buttonVariants({ variant: 'primary' })} uo-primary`}>
          <Search size={16} aria-hidden />
          Shiko ofertat
        </Link>
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
      ) : requests.length === 0 ? (
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
                <Tabs.List aria-label="Filtro kërkesat sipas statusit">
                  {filters.map((item) => (
                    <Tabs.Tab key={item.id} id={item.id} className="ur-tab">
                      {item.label}
                      <span className="ur-tab-count">{item.items.length}</span>
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
          </Card>
        </>
      )}
    </section>
  )
}
