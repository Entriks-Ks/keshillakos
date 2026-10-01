import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, buttonVariants, Card, Chip } from '@heroui/react'
import { Building2, Globe, MailPlus, MapPin, Plus, Users } from 'lucide-react'
import { fetchMyBusinesses as fetchOwnedBusinesses, type BusinessProfile } from '../api/businesses'
import { fetchConversations, type ConversationItem } from '../api/chat'
import { locationLabel, resolveSavedLocation } from '../api/locations'
import { fetchBusinessTeam, fetchMyBusinesses as fetchManagedBusinesses, type BusinessTeam } from '../api/onboarding'
import { fetchProfileCompletion, type ProfileCompletion } from '../api/profileCompletion'
import { fetchRequestInbox, type ServiceRequestItem } from '../api/requests'
import { fetchMyServices, type ServiceItem } from '../api/services'
import ProfileAvatar from '../components/ProfileAvatar'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'
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
  type OverviewStat,
} from './OverviewParts'
import type { ChipColor } from './requestDisplay'
import './UserRequests.css'
import './UserProfile.css'
import './DashboardSections.css'

const INBOX_PATH = '/dashboard/company/inbox'
const MESSAGES_PATH = '/dashboard/company/messages'
const SERVICES_PATH = '/dashboard/company/services'
const EXPERTS_PATH = '/dashboard/company/experts'
const PROFILE_PATH = '/dashboard/company/profile'
const CREATE_PATH = '/dashboard/company/create'

const BUSINESS_STATUS: Record<string, { label: string; color: ChipColor }> = {
  active: { label: 'Aktive', color: 'success' },
  draft: { label: 'Draft', color: 'default' },
  suspended: { label: 'Pezulluar', color: 'danger' },
  closed: { label: 'E mbyllur', color: 'default' },
}

type OverviewData = {
  business: BusinessProfile | null
  hasCompany: boolean
  team: BusinessTeam | null
  requests: ServiceRequestItem[]
  pendingCount: number
  conversations: ConversationItem[]
  services: ServiceItem[]
  completion: ProfileCompletion | null
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many
}

function websiteLabel(url: string) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function contextSentence(data: OverviewData) {
  const members = data.team?.members.length ?? 0
  const invitations = data.team?.invitations.length ?? 0
  const active = data.services.filter((item) => item.active).length
  if (!data.hasCompany) return 'Krijo kompaninë që klientët dhe ekspertët ta gjejnë në KëshillaKos.'
  if (data.pendingCount > 0) {
    return `Kompania ka ${data.pendingCount} ${plural(data.pendingCount, 'kërkesë që pret', 'kërkesa që presin')} përgjigje.`
  }
  if (invitations > 0) {
    return `${invitations} ${plural(invitations, 'ftesë për ekspert është', 'ftesa për ekspertë janë')} ende në pritje.`
  }
  if (members === 0) return 'Fto ekspertët e parë që klientët të shohin kush punon në kompani.'
  if (active > 0) {
    return `${active} ${plural(active, 'shërbim aktiv i kompanisë shfaqet', 'shërbime aktive të kompanisë shfaqen')} në ofertat e KëshillaKos.`
  }
  return ROLE_HINTS.company
}

function CompanyIdentity({ business, team }: { business: BusinessProfile; team: BusinessTeam | null }) {
  const [location, setLocation] = useState('')
  const status = business.status ? BUSINESS_STATUS[business.status] : null
  const verification = business.verification?.status
  const members = team?.members.length ?? 0

  useEffect(() => {
    if (!business.location) return
    const controller = new AbortController()
    resolveSavedLocation(business.location, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setLocation(value ? locationLabel(value, 'sq') : '')
      })
      .catch(() => {
        if (!controller.signal.aborted) setLocation('')
      })
    return () => controller.abort()
  }, [business.location])

  return (
    <Card className="uo-card up-hero ds-company-hero">
      <div className="up-hero-main">
        <ProfileAvatar
          className="up-hero-avatar"
          src={business.logoUrl}
          seed={business._id}
          size={64}
          fit="contain"
          alt={business.publicName}
        />
        <div className="up-hero-copy">
          <div className="up-hero-title">
            <h2>{business.publicName}</h2>
            {status ? (
              <Chip size="sm" variant="soft" color={status.color}>
                <Chip.Label>{status.label}</Chip.Label>
              </Chip>
            ) : null}
            {verification === 'verified' ? (
              <Chip size="sm" variant="soft" color="accent">
                <Chip.Label>E verifikuar</Chip.Label>
              </Chip>
            ) : verification === 'pending' ? (
              <Chip size="sm" variant="soft" color="warning">
                <Chip.Label>Verifikimi në shqyrtim</Chip.Label>
              </Chip>
            ) : null}
          </div>
          <ul className="up-hero-meta">
            {location ? (
              <li>
                <MapPin size={14} aria-hidden />
                <span className="up-truncate">{location}</span>
              </li>
            ) : null}
            {team ? (
              <li>
                <Users size={14} aria-hidden />
                {members} {plural(members, 'ekspert', 'ekspertë')} në ekip
              </li>
            ) : null}
            {business.website ? (
              <li>
                <Globe size={14} aria-hidden />
                <span className="up-truncate">{websiteLabel(business.website)}</span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <Link to={PROFILE_PATH} className={`${buttonVariants({ variant: 'outline' })} up-hero-action`}>
        Profili i kompanisë
      </Link>
    </Card>
  )
}

function StatsSection({ data, loading }: { data: OverviewData | null; loading: boolean }) {
  const services = data?.services ?? []
  const conversations = data?.conversations ?? []
  const members = data?.team?.members.length ?? 0
  const invitations = data?.team?.invitations.length ?? 0
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
      label: 'Ekspertë në ekip',
      value: members,
      hint: invitations > 0 ? `${invitations} ${plural(invitations, 'ftesë', 'ftesa')} në pritje` : 'Asnjë ftesë në pritje',
      to: EXPERTS_PATH,
    },
    {
      label: 'Shërbime aktive',
      value: services.filter((item) => item.active).length,
      hint: services.length > 0 ? `${services.length} gjithsej` : 'Asnjë e publikuar',
      to: SERVICES_PATH,
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

function ActivityCard({ data, loading }: { data: OverviewData | null; loading: boolean }) {
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
                ? 'Kërkesat për kompaninë dhe bisedat me klientët do të shfaqen këtu sapo të vijnë.'
                : 'Kërkesat nga klientët vijnë pasi kompania të publikojë një shërbim në ofertat e KëshillaKos.'
            }
            action={
              hasServices ? null : (
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

function TeamCard({ team, loading }: { team: BusinessTeam | null; loading: boolean }) {
  const members = team?.members ?? []
  const invitations = team?.invitations ?? []

  return (
    <Card className="uo-card">
      <SectionHead
        title="Ekipi"
        meta={members.length > 0 ? <span className="uo-card-meta">{members.length}</span> : null}
        action={members.length > 0 || invitations.length > 0 ? <TextLink to={EXPERTS_PATH}>Menaxho</TextLink> : null}
      />
      <Card.Content className="uo-card-body">
        {loading ? (
          <RowsSkeleton rows={3} />
        ) : members.length === 0 && invitations.length === 0 ? (
          <EmptyBlock
            title="Ende nuk ka ekspertë në ekip"
            text="Fto ekspertë që janë në KëshillaKos me email-in e tyre. Pasi e pranojnë ftesën, klientët i shohin te profili i kompanisë."
            action={
              <Link to={EXPERTS_PATH} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Fto ekspert
              </Link>
            }
          />
        ) : (
          <ul className="uo-rows">
            {members.slice(0, 4).map((member) => (
              <li key={member.id}>
                <Link to={EXPERTS_PATH} className="uo-row">
                  <ProfileAvatar src={member.photoUrl} seed={member.uid} size={36} alt="" />
                  <span className="uo-row-copy">
                    <strong>{member.name}</strong>
                    <span>{member.headline || member.email}</span>
                  </span>
                  {member.role === 'manager' ? (
                    <Chip size="sm" variant="soft" color="accent">
                      <Chip.Label>Menaxher</Chip.Label>
                    </Chip>
                  ) : null}
                </Link>
              </li>
            ))}
            {invitations.length > 0 ? (
              <li>
                <Link to={EXPERTS_PATH} className="uo-row">
                  <span className="uo-row-icon" aria-hidden>
                    <MailPlus size={16} />
                  </span>
                  <span className="uo-row-copy">
                    <strong>
                      {invitations.length} {plural(invitations.length, 'ftesë në pritje', 'ftesa në pritje')}
                    </strong>
                    <span>Ekspertët i shohin ftesat te profili i tyre.</span>
                  </span>
                </Link>
              </li>
            ) : null}
          </ul>
        )}
      </Card.Content>
    </Card>
  )
}

function ServicesCard({ services, loading }: { services: ServiceItem[]; loading: boolean }) {
  return (
    <Card className="uo-card">
      <SectionHead
        title="Shërbimet e kompanisë"
        meta={services.length > 0 ? <span className="uo-card-meta">{services.length}</span> : null}
        action={services.length > 0 ? <TextLink to={SERVICES_PATH}>Shiko të gjitha</TextLink> : null}
      />
      <Card.Content className="uo-card-body">
        {loading ? (
          <RowsSkeleton rows={2} />
        ) : services.length === 0 ? (
          <EmptyBlock
            title="Kompania nuk ka publikuar shërbime"
            text="Shërbimet aktive shfaqen në ofertat e KëshillaKos dhe klientët i dërgojnë kërkesa kompanisë."
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

export function CompanyOverviewPage() {
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

    async function load() {
      const [inbox, conversations, services, owned, managed, completion] = await Promise.all([
        fetchRequestInbox(),
        fetchConversations(),
        fetchMyServices().catch(() => [] as ServiceItem[]),
        fetchOwnedBusinesses().catch(() => [] as BusinessProfile[]),
        fetchManagedBusinesses().catch(() => []),
        fetchProfileCompletion('company').catch(() => null),
      ])
      const business = owned[0] ?? null
      const teamId = business?._id || managed[0]?._id
      const team = teamId ? await fetchBusinessTeam(teamId).catch(() => null) : null
      return {
        business,
        hasCompany: Boolean(teamId),
        team,
        requests: inbox.requests,
        pendingCount: inbox.pendingCount,
        conversations,
        services,
        completion,
      }
    }

    load()
      .then((next) => {
        if (!cancelled) setData(next)
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

  const completion = data?.completion
  const showSetup = !loading && completion?.overallPercent != null && completion.overallPercent < 100
  const noCompany = !loading && !error && data !== null && !data.hasCompany

  return (
    <section className="uo">
      <header className="uo-head">
        <div className="uo-head-copy">
          <Chip size="sm" variant="soft" color="accent" className="uo-role">
            <Chip.Label>{CONTEXT_LABELS.company}</Chip.Label>
          </Chip>
          <h1>Përmbledhje</h1>
          <p>{data && !loading ? contextSentence(data) : ROLE_HINTS.company}</p>
        </div>
        {noCompany ? null : (
          <Link to={EXPERTS_PATH} className={`${buttonVariants({ variant: 'primary' })} uo-primary`}>
            <Plus size={16} aria-hidden />
            Shto ekspert
          </Link>
        )}
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
      ) : noCompany ? (
        <Card className="uo-card ur-empty">
          <span className="ur-empty-icon" aria-hidden>
            <Building2 size={22} />
          </span>
          <h2>Ende nuk ke një kompani</h2>
          <p>
            Krijo profilin e kompanisë për të ftuar ekspertë, për të publikuar shërbime dhe për të marrë kërkesa nga
            klientët.
          </p>
          <div className="ur-empty-actions">
            <Link to={CREATE_PATH} className={buttonVariants({ variant: 'primary' })}>
              <Plus size={16} aria-hidden />
              Krijo kompaninë
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {data?.business ? <CompanyIdentity business={data.business} team={data.team} /> : null}
          <StatsSection data={data} loading={loading} />
          <div className="uo-grid">
            <ActivityCard data={data} loading={loading} />
            <div className="uo-side">
              <TeamCard team={data?.team ?? null} loading={loading} />
              <ServicesCard services={data?.services ?? []} loading={loading} />
              {showSetup && completion ? <ProfileSetupCard completion={completion} to={PROFILE_PATH} /> : null}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
