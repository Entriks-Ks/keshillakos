import { collectionSummary, collectionTotal } from '../api/pagination'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
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
import { routePath } from '../routes/routeMap'

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
  const provider = item.providerName || i18n.t('requests.activity.providerFallback')
  if (item.offer) {
    const amount = formatAmount(item.offer)
    return amount
      ? i18n.t('requests.activity.offerSentAmount', { provider, amount })
      : i18n.t('requests.activity.offerSent', { provider })
  }
  switch (item.status) {
    case 'accepted':
      return i18n.t('requests.activity.acceptedBy', { provider })
    case 'completed':
      return i18n.t('requests.activity.completedWith', { provider })
    case 'rejected':
      return i18n.t('requests.activity.rejectedBy', { provider })
    case 'withdrawn':
      return i18n.t('requests.activity.withdrawn', { provider })
    default:
      return i18n.t('requests.activity.sentTo', { provider })
  }
}

function buildActivity(requests: ServiceRequestItem[]): ActivityEntry[] {
  const fromRequests = requests.map((item) => ({
    id: `r-${item.id}`,
    title: item.need || item.serviceTitle || i18n.t('req.request'),
    detail: requestDetail(item),
    at: item.updatedAt || item.createdAt,
    to: REQUESTS_PATH,
    status: REQUEST_STATUS[item.status] ?? { label: item.status, color: 'default' as const },
  }))
  return latestActivity(fromRequests)
}

function StatsStrip({ data, loading }: { data: OverviewData | null; loading: boolean }) {
  const { t } = useTranslation()
  const requests = data?.requests ?? []
  const conversations = data?.conversations ?? []
  const upcoming = upcomingAppointments(data?.appointments ?? [])
  const unread = collectionSummary(conversations).unread ?? 0
  const offers = collectionSummary(requests).offers ?? 0
  const stats = [
    {
      label: t('overview.stats.activeRequests'),
      value: collectionSummary(requests).active ?? 0,
      hint: t('overview.stats.total', { count: collectionTotal(requests) }),
      to: REQUESTS_PATH,
    },
    {
      label: t('overview.stats.receivedOffers'),
      value: offers,
      hint: offers > 0 ? t('overview.stats.fromProviders') : t('overview.stats.noneYet'),
      to: REQUESTS_PATH,
    },
    {
      label: t('overview.stats.upcomingAppointments'),
      value: collectionSummary(data?.appointments).upcoming ?? upcoming.length,
      hint: upcoming[0] ? t('overview.stats.next', { when: formatWhen(upcoming[0].startAt) }) : t('overview.stats.noneScheduled'),
      to: REQUESTS_PATH,
    },
    {
      label: t('overview.stats.unreadMessages'),
      value: unread,
      hint: t('overview.stats.conversations', { count: collectionTotal(conversations) }),
      to: MESSAGES_PATH,
      highlight: unread > 0,
    },
  ]

  return <StatsStripView stats={stats} loading={loading} />
}

function ActivityCard({ data, loading }: { data: OverviewData | null; loading: boolean }) {
  const { t } = useTranslation()
  const entries = data ? buildActivity(data.requests) : []

  return (
    <Card className="uo-card uo-activity">
      <SectionHead title={t('overview.recentActivity')} action={entries.length > 0 ? <TextLink to={REQUESTS_PATH}>{t('dash.requests')}</TextLink> : null} />
      <Card.Content className="uo-card-body">
        {loading ? (
          <RowsSkeleton rows={4} />
        ) : entries.length === 0 ? (
          <EmptyBlock
            title={t('overview.noActivity')}
            text={t('overview.user.activityText')}
            action={
              <Link to={routePath('services')} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                {t('req.browse')}
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
  const { t } = useTranslation()
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
        <SectionHead title={t('overview.myServices')} />
        <Card.Content className="uo-card-body">
          <EmptyBlock
            title={t('overview.user.offerServicesTitle')}
            text={t('overview.user.offerServicesText')}
            action={
              <div className="uo-empty-actions">
                <Link to="/dashboard/user/become-expert" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  {t('overview.user.becomeExpert')}
                </Link>
                <Link to="/dashboard/user/create-company" className="uo-link">
                  {t('overview.user.orRegisterCompany')}
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
        title={t('overview.myServices')}
        meta={list.length > 0 ? <span className="uo-card-meta">{list.length}</span> : null}
        action={
          list.length > 0 ? (
            <Button variant="ghost" size="sm" className="uo-link-btn" isDisabled={switching} onPress={() => void openServices()}>
              {t('overview.viewAll')}
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
            title={t('overview.noServicesTitle')}
            text={t('overview.user.noServicesText')}
            action={
              <Button variant="outline" size="sm" isDisabled={switching} onPress={() => void openServices()}>
                {t('overview.addService')}
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
  const { t } = useTranslation()
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
            <Chip.Label>{t(ROLE_LABELS.user)}</Chip.Label>
          </Chip>
          <h1>
            {timeGreeting(new Date().getHours())}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p>{t(ROLE_HINTS.user)}</p>
        </div>
        <Link to={routePath('home')} className={`${buttonVariants({ variant: 'primary' })} uo-primary`}>
          <Plus size={16} aria-hidden />
          {t('dash.findHelp')}
        </Link>
      </header>

      {error ? (
        <Alert status="danger" className="uo-alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('overview.loadError')}</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="outline" onPress={reload}>
            {t('page.retry')}
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
