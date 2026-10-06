import { collectionSummary, collectionTotal } from '../api/pagination'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, buttonVariants, Card, Chip, toast } from '@heroui/react'
import { ArrowRight, Plus } from 'lucide-react'
import type { DashboardContext, UserRole } from '../api/auth'
import { fetchMyAppointments, upcomingAppointments, type AppointmentItem } from '../api/appointments'
import { fetchConversations, type ConversationItem } from '../api/chat'
import { fetchProfileCompletion, type ProfileCompletion } from '../api/profileCompletion'
import { fetchMyRequests, type ServiceRequestItem } from '../api/requests'
import { fetchMyServices, type ServiceItem } from '../api/services'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../utils/dashboardPath'
import { getErrorMessage } from '../utils/errors'
import { ROLE_HINTS, ROLE_LABELS } from './nav'
import {
  ActivityRows,
  EmptyBlock,
  latestActivity,
  ProfileSetupCard,
  RowsSkeleton,
  SectionHead,
  ServiceRows,
  StatsStrip as StatsStripView,
  TextLink,
  timeGreeting,
  type ActivityEntry,
} from './OverviewParts'
import { formatAmount, formatWhen, REQUEST_STATUS } from './requestDisplay'

const REQUESTS_PATH = '/dashboard/user/requests'
const MESSAGES_PATH = '/dashboard/user/messages'
const PROFILE_PATH = '/dashboard/user/profile'

type OverviewData = {
  requests: ServiceRequestItem[]
  conversations: ConversationItem[]
  appointments: AppointmentItem[]
  completion: ProfileCompletion | null
  /** `null` when the account has no expert/company role and cannot own services. */
  services: ServiceItem[] | null
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

function buildActivity(requests: ServiceRequestItem[]): ActivityEntry[] {
  const fromRequests = requests.map((item) => ({
    id: `r-${item.id}`,
    title: item.need || item.serviceTitle || 'Kërkesë',
    detail: requestDetail(item),
    at: item.updatedAt || item.createdAt,
    to: REQUESTS_PATH,
    status: REQUEST_STATUS[item.status] ?? { label: item.status, color: 'default' as const },
  }))
  return latestActivity(fromRequests)
}

function StatsStrip({ data, loading }: { data: OverviewData | null; loading: boolean }) {
  const requests = data?.requests ?? []
  const conversations = data?.conversations ?? []
  const upcoming = upcomingAppointments(data?.appointments ?? [])
  const unread = collectionSummary(conversations).unread ?? 0
  const offers = collectionSummary(requests).offers ?? 0
  const stats = [
    {
      label: 'Kërkesa aktive',
      value: collectionSummary(requests).active ?? 0,
      hint: `${collectionTotal(requests)} gjithsej`,
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
      value: collectionSummary(data?.appointments).upcoming ?? upcoming.length,
      hint: upcoming[0] ? `Tjetri: ${formatWhen(upcoming[0].startAt)}` : 'Asnjë i planifikuar',
      to: REQUESTS_PATH,
    },
    {
      label: 'Mesazhe të palexuara',
      value: unread,
      hint: `${collectionTotal(conversations)} biseda`,
      to: MESSAGES_PATH,
      highlight: unread > 0,
    },
  ]

  return <StatsStripView stats={stats} loading={loading} />
}

function ActivityCard({ data, loading }: { data: OverviewData | null; loading: boolean }) {
  const entries = data ? buildActivity(data.requests) : []

  return (
    <Card className="uo-card uo-activity">
      <SectionHead title="Aktiviteti i fundit" action={entries.length > 0 ? <TextLink to={REQUESTS_PATH}>Kërkesat</TextLink> : null} />
      <Card.Content className="uo-card-body">
        {loading ? (
          <RowsSkeleton rows={4} />
        ) : entries.length === 0 ? (
          <EmptyBlock
            title="Ende s'ka aktivitet"
            text="Kërkesat që dërgon dhe ndryshimet e statusit të tyre do të shfaqen këtu."
            action={
              <Link to="/ofertat" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Shfleto ofertat
              </Link>
            }
          />
        ) : (
          <ActivityRows entries={entries} />
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
        ) : list.length === 0 ? (
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
          <ServiceRows services={list} />
        )}
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
              {showSetup && completion ? <ProfileSetupCard completion={completion} to={PROFILE_PATH} /> : null}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
