import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, buttonVariants, Card, Chip, ProgressBar, Separator, Skeleton, toast } from '@heroui/react'
import { ArrowRight, Inbox, Plus } from 'lucide-react'
import type { DashboardContext, UserRole } from '../api/auth'
import { fetchMyAppointments, upcomingAppointments, type AppointmentItem } from '../api/appointments'
import { fetchConversations, type ChatPeer, type ConversationItem } from '../api/chat'
import { fetchProfileCompletion, type ProfileCompletion } from '../api/profileCompletion'
import { fetchMyRequests, type ServiceRequestItem } from '../api/requests'
import { fetchMyServices, type ServiceItem } from '../api/services'
import { useAuth } from '../auth/AuthContext'
import ProfileAvatar from '../components/ProfileAvatar'
import { getDashboardPath } from '../utils/dashboardPath'
import { getErrorMessage } from '../utils/errors'
import { formatServicePrice } from '../utils/serviceDiscovery'
import { ROLE_HINTS, ROLE_LABELS } from './nav'
import { formatAmount, formatWhen, REQUEST_STATUS, type ChipColor } from './requestDisplay'
import './UserOverview.css'

const REQUESTS_PATH = '/dashboard/user/requests'
const MESSAGES_PATH = '/dashboard/user/messages'
const PROFILE_PATH = '/dashboard/user/profile'
const ACTIVE_REQUEST_STATUSES = new Set(['open', 'pending', 'read', 'accepted'])

type OverviewData = {
  requests: ServiceRequestItem[]
  conversations: ConversationItem[]
  appointments: AppointmentItem[]
  completion: ProfileCompletion | null
  /** `null` when the account has no expert/company role and cannot own services. */
  services: ServiceItem[] | null
}

type ActivityEntry = {
  id: string
  title: string
  detail: string
  at: string
  to: string
  peer?: ChatPeer
  status?: { label: string; color: ChipColor }
  unread?: number
}

function timeGreeting(hour: number) {
  if (hour < 12) return 'Mirëmëngjes'
  if (hour < 18) return 'Mirëdita'
  return 'Mirëmbrëma'
}

function requestDetail(item: ServiceRequestItem) {
  const provider = item.providerName || 'ofruesi'
  if (item.offer) {
    const amount = formatAmount(item.offer)
    return `${provider} dërgoi një ofertë${amount ? ` · ${amount}` : ''}`
  }
  switch (item.status) {
    case 'accepted':
      return `Pranuar nga ${provider}`
    case 'completed':
      return `Përfunduar me ${provider}`
    case 'rejected':
      return `Refuzuar nga ${provider}`
    case 'withdrawn':
      return `Tërhequr · ${provider}`
    default:
      return `Dërguar te ${provider}`
  }
}

function buildActivity(requests: ServiceRequestItem[], conversations: ConversationItem[]): ActivityEntry[] {
  const fromRequests = requests.map((item) => ({
    id: `r-${item.id}`,
    title: item.need || item.serviceTitle || 'Kërkesë',
    detail: requestDetail(item),
    at: item.updatedAt || item.createdAt,
    to: REQUESTS_PATH,
    status: REQUEST_STATUS[item.status] ?? { label: item.status, color: 'default' as const },
  }))
  const fromConversations = conversations
    .filter((item) => item.lastMessageAt)
    .map((item) => ({
      id: `c-${item.id}`,
      title: item.peer.name,
      detail: item.lastMessagePreview || item.serviceTitle || 'Bisedë',
      at: item.lastMessageAt as string,
      to: `${MESSAGES_PATH}?c=${item.id}`,
      peer: item.peer,
      unread: item.unread,
    }))
  return [...fromRequests, ...fromConversations]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6)
}

function SectionHead({ title, meta, action }: { title: string; meta?: ReactNode; action?: ReactNode }) {
  return (
    <Card.Header className="uo-card-head">
      <div className="uo-card-heading">
        <Card.Title className="uo-card-title">{title}</Card.Title>
        {meta}
      </div>
      {action}
    </Card.Header>
  )
}

function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="uo-link">
      {children}
      <ArrowRight size={14} aria-hidden />
    </Link>
  )
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="uo-rows" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="uo-row is-skeleton">
          <Skeleton className="uo-skel-avatar" />
          <span className="uo-row-copy">
            <Skeleton className="uo-skel-line is-wide" />
            <Skeleton className="uo-skel-line" />
          </span>
        </li>
      ))}
    </ul>
  )
}

function EmptyBlock({ title, text, action }: { title: string; text: string; action: ReactNode }) {
  return (
    <div className="uo-empty">
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  )
}

function StatsStrip({ data, loading }: { data: OverviewData | null; loading: boolean }) {
  const requests = data?.requests ?? []
  const conversations = data?.conversations ?? []
  const upcoming = upcomingAppointments(data?.appointments ?? [])
  const unread = conversations.reduce((sum, item) => sum + (item.unread || 0), 0)
  const offers = requests.filter((item) => item.offer).length
  const stats = [
    {
      label: 'Kërkesa aktive',
      value: requests.filter((item) => ACTIVE_REQUEST_STATUSES.has(item.status)).length,
      hint: `${requests.length} gjithsej`,
      to: REQUESTS_PATH,
    },
    {
      label: 'Oferta të marra',
      value: offers,
      hint: offers > 0 ? 'Nga ofruesit' : 'Asnjë ende',
      to: REQUESTS_PATH,
    },
    {
      label: 'Termine të ardhshme',
      value: upcoming.length,
      hint: upcoming[0] ? `Tjetri: ${formatWhen(upcoming[0].startAt)}` : 'Asnjë i planifikuar',
      to: REQUESTS_PATH,
    },
    {
      label: 'Mesazhe të palexuara',
      value: unread,
      hint: `${conversations.length} biseda`,
      to: MESSAGES_PATH,
      highlight: unread > 0,
    },
  ]

  return (
    <Card className="uo-card uo-stats">
      <ul className="uo-stats-list" aria-label="Statistika">
        {stats.map((stat) => (
          <li key={stat.label}>
            <Link to={stat.to} className="uo-stat">
              <span className="uo-stat-label">{stat.label}</span>
              {loading ? (
                <Skeleton className="uo-skel-value" />
              ) : (
                <strong className={`uo-stat-value${stat.highlight ? ' is-highlight' : ''}`}>{stat.value}</strong>
              )}
              {loading ? <Skeleton className="uo-skel-line" /> : <span className="uo-stat-hint">{stat.hint}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function ActivityCard({ data, loading }: { data: OverviewData | null; loading: boolean }) {
  const entries = data ? buildActivity(data.requests, data.conversations) : []

  return (
    <Card className="uo-card uo-activity">
      <SectionHead title="Aktiviteti i fundit" action={entries.length > 0 ? <TextLink to={REQUESTS_PATH}>Kërkesat</TextLink> : null} />
      <Card.Content className="uo-card-body">
        {loading ? (
          <RowsSkeleton rows={4} />
        ) : entries.length === 0 ? (
          <EmptyBlock
            title="Ende s'ka aktivitet"
            text="Kërkesat që dërgon dhe bisedat me ofruesit do të shfaqen këtu."
            action={
              <Link to="/ofertat" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Shfleto ofertat
              </Link>
            }
          />
        ) : (
          <ul className="uo-rows">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link to={entry.to} className={`uo-row${entry.unread ? ' is-unread' : ''}`}>
                  {entry.peer ? (
                    <ProfileAvatar src={entry.peer.profilePhoto} seed={entry.peer.uid} size={36} alt="" />
                  ) : (
                    <span className="uo-row-icon" aria-hidden>
                      <Inbox size={16} />
                    </span>
                  )}
                  <span className="uo-row-copy">
                    <strong>{entry.title}</strong>
                    <span>{entry.detail}</span>
                  </span>
                  <span className="uo-row-end">
                    {entry.status ? (
                      <Chip size="sm" variant="soft" color={entry.status.color}>
                        <Chip.Label>{entry.status.label}</Chip.Label>
                      </Chip>
                    ) : entry.unread ? (
                      <span className="uo-unread" aria-label={`${entry.unread} të palexuara`}>
                        {entry.unread}
                      </span>
                    ) : null}
                    <time dateTime={entry.at}>{formatWhen(entry.at)}</time>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card.Content>
    </Card>
  )
}

function ServicesCard({ services, roles, loading }: { services: ServiceItem[] | null | undefined; roles: UserRole[]; loading: boolean }) {
  const { switchContext } = useAuth()
  const navigate = useNavigate()
  const [switching, setSwitching] = useState(false)
  const list = services ?? []
  const context: DashboardContext =
    roles.includes('company') && (!roles.includes('provider') || list.some((item) => item.businessId)) ? 'company' : 'provider'

  async function openServices() {
    setSwitching(true)
    try {
      await switchContext(context)
      navigate(`${getDashboardPath(context)}/services`)
    } catch (err) {
      toast.danger(getErrorMessage(err))
      setSwitching(false)
    }
  }

  if (!loading && services === null) {
    return (
      <Card className="uo-card">
        <SectionHead title="Shërbimet e mia" />
        <Card.Content className="uo-card-body">
          <EmptyBlock
            title="Ofro shërbimet e tua"
            text="Krijo profil eksperti për të publikuar shërbime dhe për të marrë kërkesa nga klientët."
            action={
              <div className="uo-empty-actions">
                <Link to="/dashboard/user/become-expert" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Bëhu ekspert
                </Link>
                <Link to="/dashboard/user/create-company" className="uo-link">
                  ose regjistro kompaninë
                </Link>
              </div>
            }
          />
        </Card.Content>
      </Card>
    )
  }

  const recent = [...list]
    .sort((a, b) => Number(b.active) - Number(a.active) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)

  return (
    <Card className="uo-card">
      <SectionHead
        title="Shërbimet e mia"
        meta={list.length > 0 ? <span className="uo-card-meta">{list.length}</span> : null}
        action={
          list.length > 0 ? (
            <Button variant="ghost" size="sm" className="uo-link-btn" isDisabled={switching} onPress={() => void openServices()}>
              Shiko të gjitha
              <ArrowRight size={14} aria-hidden />
            </Button>
          ) : null
        }
      />
      <Card.Content className="uo-card-body">
        {loading ? (
          <RowsSkeleton rows={2} />
        ) : recent.length === 0 ? (
          <EmptyBlock
            title="Nuk ke publikuar shërbime ende"
            text="Shërbimet e publikuara shfaqen në ofertat e KëshillaKos."
            action={
              <Button variant="outline" size="sm" isDisabled={switching} onPress={() => void openServices()}>
                Shto shërbim
              </Button>
            }
          />
        ) : (
          <ul className="uo-rows">
            {recent.map((service) => {
              const price = formatServicePrice(service)
              return (
                <li key={service.id}>
                  <div className="uo-row is-static">
                    <span className="uo-row-copy">
                      <strong>{service.title}</strong>
                      <span>{[service.categoryLabel || service.category, price].filter(Boolean).join(' · ')}</span>
                    </span>
                    <Chip size="sm" variant="soft" color={service.active ? 'success' : 'default'}>
                      <Chip.Label>{service.active ? 'Aktiv' : 'Joaktiv'}</Chip.Label>
                    </Chip>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card.Content>
    </Card>
  )
}

function ProfileSetupCard({ completion }: { completion: ProfileCompletion }) {
  const percent = Math.max(0, Math.min(100, Math.round(completion.overallPercent ?? 0)))
  const missing = completion.section.missingRequired
  const shown = missing.slice(0, 4)

  return (
    <Card className="uo-card">
      <SectionHead title="Plotëso profilin" meta={<span className="uo-card-meta is-strong">{percent}%</span>} />
      <Card.Content className="uo-card-body uo-setup">
        <ProgressBar aria-label="Plotësimi i profilit" value={percent} className="uo-progress">
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
        {shown.length > 0 ? (
          <div className="uo-missing">
            <span>Mungojnë:</span>
            {shown.map((field) => (
              <Chip key={field.key} size="sm" variant="soft">
                <Chip.Label>{field.label}</Chip.Label>
              </Chip>
            ))}
            {missing.length > shown.length ? <span>+{missing.length - shown.length}</span> : null}
          </div>
        ) : null}
        <Separator />
        <TextLink to={PROFILE_PATH}>Përditëso profilin</TextLink>
      </Card.Content>
    </Card>
  )
}

export function UserOverviewPage() {
  const { user } = useAuth()
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    setReloadKey((n) => n + 1)
  }, [])
  const roles: UserRole[] = user?.roles ?? (user?.role ? [user.role] : [])
  const canOfferServices = roles.includes('provider') || roles.includes('company')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchMyRequests(),
      fetchConversations(),
      fetchMyAppointments().catch(() => [] as AppointmentItem[]),
      fetchProfileCompletion('private').catch(() => null),
      canOfferServices ? fetchMyServices().catch(() => [] as ServiceItem[]) : Promise.resolve(null),
    ])
      .then(([requests, conversations, appointments, completion, services]) => {
        if (!cancelled) setData({ requests, conversations, appointments, completion, services })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey, canOfferServices])

  const firstName = user?.firstName || user?.name?.split(' ')[0] || ''
  const completion = data?.completion
  const showSetup = !loading && completion?.overallPercent != null && completion.overallPercent < 100

  return (
    <section className="uo">
      <header className="uo-head">
        <div className="uo-head-copy">
          <Chip size="sm" variant="soft" color="accent" className="uo-role">
            <Chip.Label>{ROLE_LABELS.user}</Chip.Label>
          </Chip>
          <h1>
            {timeGreeting(new Date().getHours())}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p>{ROLE_HINTS.user}</p>
        </div>
        <Link to="/" className={`${buttonVariants({ variant: 'primary' })} uo-primary`}>
          <Plus size={16} aria-hidden />
          Kërko ndihmë
        </Link>
      </header>

      {error ? (
        <Alert status="danger" className="uo-alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Nuk u ngarkuan të dhënat</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="outline" onPress={reload}>
            Provo përsëri
          </Button>
        </Alert>
      ) : (
        <>
          <StatsStrip data={data} loading={loading} />
          <div className="uo-grid">
            <ActivityCard data={data} loading={loading} />
            <div className="uo-side">
              <ServicesCard services={loading ? undefined : data?.services} roles={roles} loading={loading} />
              {showSetup && completion ? <ProfileSetupCard completion={completion} /> : null}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
