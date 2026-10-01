import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, buttonVariants, Card, Chip } from '@heroui/react'
import { Plus } from 'lucide-react'
import { fetchProviderAppointments, upcomingAppointments, type AppointmentItem } from '../api/appointments'
import { fetchConversations, type ConversationItem } from '../api/chat'
import { fetchProfileCompletion, type ProfileCompletion } from '../api/profileCompletion'
import { fetchRequestInbox, type ServiceRequestItem } from '../api/requests'
import { fetchMyServices, type ServiceItem } from '../api/services'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'
import { providerPath } from '../utils/publicPaths'
import { CONTEXT_LABELS, ROLE_HINTS } from './nav'
import {
  ActivityRows,
  EmptyBlock,
  inboxActivity,
  ProfileSetupCard,
  RowsSkeleton,
  SectionHead,
  ServiceRows,
  StatsStrip,
  TextLink,
  timeGreeting,
  type OverviewStat,
} from './OverviewParts'
import { formatWhen } from './requestDisplay'

const INBOX_PATH = '/dashboard/provider/inbox'
const MESSAGES_PATH = '/dashboard/provider/messages'
const SERVICES_PATH = '/dashboard/provider/services'
const AVAILABILITY_PATH = '/dashboard/provider/availability'
const PROFILE_PATH = '/dashboard/provider/profile'

type OverviewData = {
  requests: ServiceRequestItem[]
  pendingCount: number
  conversations: ConversationItem[]
  services: ServiceItem[]
  appointments: AppointmentItem[]
  completion: ProfileCompletion | null
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many
}

function contextSentence(data: OverviewData) {
  const next = upcomingAppointments(data.appointments)[0]
  const active = data.services.filter((item) => item.active).length
  if (data.pendingCount > 0) {
    return `Ke ${data.pendingCount} ${plural(data.pendingCount, 'kërkesë që pret', 'kërkesa që presin')} përgjigjen tënde.`
  }
  if (next) return `Termini yt i radhës është më ${formatWhen(next.startAt)}.`
  if (active > 0) {
    return `${active} ${plural(active, 'shërbim aktiv shfaqet', 'shërbime aktive shfaqen')} në ofertat e KëshillaKos.`
  }
  if (data.services.length > 0) return 'Asnjë nga shërbimet e tua nuk është aktiv për momentin.'
  return 'Publiko shërbimin e parë që klientët të të gjejnë në ofertat e KëshillaKos.'
}

function StatsSection({ data, loading }: { data: OverviewData | null; loading: boolean }) {
  const services = data?.services ?? []
  const conversations = data?.conversations ?? []
  const upcoming = upcomingAppointments(data?.appointments ?? [])
  const unread = conversations.reduce((sum, item) => sum + (item.unread || 0), 0)
  const pending = data?.pendingCount ?? 0
  const stats: OverviewStat[] = [
    {
      label: 'Kërkesa në pritje',
      value: pending,
      hint: `${data?.requests.length ?? 0} të marra gjithsej`,
      to: INBOX_PATH,
      highlight: pending > 0,
    },
    {
      label: 'Shërbime aktive',
      value: services.filter((item) => item.active).length,
      hint: services.length > 0 ? `${services.length} gjithsej` : 'Asnjë e publikuar',
      to: SERVICES_PATH,
    },
    {
      label: 'Termine të ardhshme',
      value: upcoming.length,
      hint: upcoming[0] ? `Tjetri: ${formatWhen(upcoming[0].startAt)}` : 'Asnjë i planifikuar',
      to: AVAILABILITY_PATH,
    },
    {
      label: 'Mesazhe të palexuara',
      value: unread,
      hint: `${conversations.length} biseda`,
      to: MESSAGES_PATH,
      highlight: unread > 0,
    },
  ]

  return <StatsStrip stats={stats} loading={loading} />
}

function ActivityCard({ data, loading, publicPath }: { data: OverviewData | null; loading: boolean; publicPath: string | null }) {
  const entries = data ? inboxActivity(data.requests, data.conversations, INBOX_PATH, MESSAGES_PATH) : []
  const hasServices = (data?.services.length ?? 0) > 0

  return (
    <Card className="uo-card uo-activity">
      <SectionHead title="Aktiviteti i fundit" action={entries.length > 0 ? <TextLink to={INBOX_PATH}>Kërkesat</TextLink> : null} />
      <Card.Content className="uo-card-body">
        {loading ? (
          <RowsSkeleton rows={4} />
        ) : entries.length === 0 ? (
          <EmptyBlock
            title="Ende s'ka aktivitet"
            text={
              hasServices
                ? 'Kërkesat nga klientët dhe bisedat me ta do të shfaqen këtu sapo të vijnë.'
                : 'Kërkesat nga klientët vijnë pasi të publikosh një shërbim në ofertat e KëshillaKos.'
            }
            action={
              hasServices ? (
                publicPath ? (
                  <Link to={publicPath} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    Shiko profilin publik
                  </Link>
                ) : null
              ) : (
                <Link to={SERVICES_PATH} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Shto shërbim
                </Link>
              )
            }
          />
        ) : (
          <ActivityRows entries={entries} />
        )}
      </Card.Content>
    </Card>
  )
}

function ServicesCard({ services, loading }: { services: ServiceItem[]; loading: boolean }) {
  return (
    <Card className="uo-card">
      <SectionHead
        title="Shërbimet e mia"
        meta={services.length > 0 ? <span className="uo-card-meta">{services.length}</span> : null}
        action={services.length > 0 ? <TextLink to={SERVICES_PATH}>Shiko të gjitha</TextLink> : null}
      />
      <Card.Content className="uo-card-body">
        {loading ? (
          <RowsSkeleton rows={2} />
        ) : services.length === 0 ? (
          <EmptyBlock
            title="Nuk ke publikuar shërbime ende"
            text="Krijo shërbimin e parë. Shërbimet aktive shfaqen në ofertat e KëshillaKos dhe klientët të dërgojnë kërkesa."
            action={
              <Link to={SERVICES_PATH} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Shto shërbim
              </Link>
            }
          />
        ) : (
          <ServiceRows services={services} />
        )}
      </Card.Content>
    </Card>
  )
}

export function ProviderOverviewPage() {
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

  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    Promise.all([
      fetchRequestInbox(),
      fetchConversations(),
      fetchMyServices(),
      fetchProviderAppointments().catch(() => [] as AppointmentItem[]),
      fetchProfileCompletion('expert').catch(() => null),
    ])
      .then(([inbox, conversations, services, appointments, completion]) => {
        if (cancelled) return
        setData({
          requests: inbox.requests,
          pendingCount: inbox.pendingCount,
          conversations,
          services,
          appointments,
          completion,
        })
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
  }, [user?.uid, reloadKey])

  const firstName = user?.firstName || user?.name?.split(' ')[0] || ''
  const completion = data?.completion
  const showSetup = !loading && completion?.overallPercent != null && completion.overallPercent < 100
  const publicPath = user?.uid && completion?.exists !== false ? providerPath({ uid: user.uid, name: user.name }) : null

  return (
    <section className="uo">
      <header className="uo-head">
        <div className="uo-head-copy">
          <Chip size="sm" variant="soft" color="accent" className="uo-role">
            <Chip.Label>{CONTEXT_LABELS.provider}</Chip.Label>
          </Chip>
          <h1>
            {timeGreeting(new Date().getHours())}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p>{data && !loading ? contextSentence(data) : ROLE_HINTS.provider}</p>
        </div>
        <Link to={SERVICES_PATH} className={`${buttonVariants({ variant: 'primary' })} uo-primary`}>
          <Plus size={16} aria-hidden />
          Shto shërbim
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
          <StatsSection data={data} loading={loading} />
          <div className="uo-grid">
            <ActivityCard data={data} loading={loading} publicPath={publicPath} />
            <div className="uo-side">
              <ServicesCard services={data?.services ?? []} loading={loading} />
              {showSetup && completion ? <ProfileSetupCard completion={completion} to={PROFILE_PATH} /> : null}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
