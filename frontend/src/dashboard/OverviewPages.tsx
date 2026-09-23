import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, Chip } from '@heroui/react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  FolderKanban,
  Inbox,
  MessageCircle,
  MessageSquarePlus,
  Search,
  Star,
  Users,
} from 'lucide-react'
import { fetchAdminUsersMeta } from '../api/adminUsers'
import { fetchPlatformFeedback } from '../api/feedback'
import { fetchMyAvailability } from '../api/availability'
import { fetchConversations } from '../api/chat'
import { fetchBusinessTeam, fetchMyBusinesses } from '../api/onboarding'
import { fetchProviderRatings } from '../api/ratings'
import {
  fetchAllRequests,
  fetchMyRequests,
  fetchRequestInbox,
} from '../api/requests'
import { fetchMyServices } from '../api/services'
import { useAuth } from '../auth/AuthContext'
import {
  countByStatus,
  OVERVIEW_CHART_COLORS,
  OverviewCharts,
  requestStatusSlices,
  type OverviewChartsData,
} from './OverviewCharts'
import { ROLE_HINTS, ROLE_LABELS } from './nav'
import type { UserRole } from '../api/auth'

type StatItem = {
  label: string
  value: string | number
  hint?: string
  to?: string
  tone?: 'default' | 'accent' | 'warn' | 'success'
}

type NextStep = {
  title: string
  text: string
  to: string
  cta: string
}

function OverviewCard({
  title,
  description,
  to,
  cta,
  icon: Icon,
}: {
  title: string
  description: string
  to: string
  cta: string
  icon: LucideIcon
}) {
  return (
    <Link to={to} className="dash-overview-card-link">
      <Card className="dash-overview-card">
        <Card.Header className="dash-overview-card-header">
          <span className="dash-overview-card-icon" aria-hidden>
            <Icon size={22} strokeWidth={2} />
          </span>
          <Card.Title>{title}</Card.Title>
          <Card.Description>{description}</Card.Description>
        </Card.Header>
        <Card.Footer className="dash-overview-card-footer">
          <span className="dash-overview-card-cta">
            {cta}
            <ArrowRight size={16} aria-hidden />
          </span>
        </Card.Footer>
      </Card>
    </Link>
  )
}

function chipColor(tone?: StatItem['tone']): 'default' | 'accent' | 'warning' | 'success' {
  if (tone === 'warn') return 'warning'
  if (tone === 'success') return 'success'
  if (tone === 'accent') return 'accent'
  return 'default'
}

function OverviewStats({ items, loading }: { items: StatItem[]; loading?: boolean }) {
  if (loading && items.length === 0) {
    return (
      <div className="dash-stat-grid is-loading" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="dash-stat-card is-skeleton"><span aria-hidden="true" /></Card>
        ))}
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="dash-stat-grid" aria-label="Statistika">
      {items.map((item) => {
        const body = (
          <Card
            className={`dash-stat-card${item.tone && item.tone !== 'default' ? ` is-${item.tone}` : ''}`}
          >
            <Card.Content className="dash-stat-card-body">
              <span className="dash-stat-label">{item.label}</span>
              <strong className="dash-stat-value">{item.value}</strong>
              {item.hint ? (
                <Chip size="sm" variant="soft" color={chipColor(item.tone)} className="dash-stat-chip">
                  <Chip.Label>{item.hint}</Chip.Label>
                </Chip>
              ) : null}
            </Card.Content>
          </Card>
        )
        return item.to ? (
          <Link key={item.label} to={item.to} className="dash-stat-link">
            {body}
          </Link>
        ) : (
          <div key={item.label}>{body}</div>
        )
      })}
    </div>
  )
}

function OverviewShell({
  role,
  greeting,
  subtitle,
  stats,
  statsLoading,
  charts,
  nextStep,
  children,
}: {
  role: UserRole
  greeting: string
  subtitle: string
  stats?: StatItem[]
  statsLoading?: boolean
  charts?: OverviewChartsData | null
  nextStep?: NextStep | null
  children: ReactNode
}) {
  return (
    <section className="dash-overview">
      <header className="dash-overview-hero">
        <p className="dash-overview-kicker">{ROLE_LABELS[role]}</p>
        <p className="dash-overview-hello">{greeting}</p>
        <p className="dash-overview-sub">{subtitle}</p>
      </header>
      {nextStep ? (
        <Link to={nextStep.to} className="dash-next-step">
          <div>
            <p>Hapi i radhës</p>
            <strong>{nextStep.title}</strong>
            <span>{nextStep.text}</span>
          </div>
          <span className="dash-next-step-cta">
            {nextStep.cta}
            <ArrowRight size={16} aria-hidden />
          </span>
        </Link>
      ) : null}
      <OverviewStats items={stats || []} loading={statsLoading} />
      <OverviewCharts data={charts} loading={statsLoading} />
      <div className="dash-overview-section">
        <div className="dash-overview-section-head">
          <h2>Veprime të shpejta</h2>
          <p>Hap seksionet që përdor më shpesh.</p>
        </div>
        <div className="dash-overview-grid">{children}</div>
      </div>
    </section>
  )
}

function unreadFromConversations(conversations: Awaited<ReturnType<typeof fetchConversations>>) {
  return conversations.reduce((sum, c) => sum + (c.unread || 0), 0)
}

export function UserOverviewPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<StatItem[]>([])
  const [charts, setCharts] = useState<OverviewChartsData | null>(null)
  const [nextStep, setNextStep] = useState<NextStep | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchMyRequests(), fetchConversations()])
      .then(([requests, conversations]) => {
        if (cancelled) return
        const byStatus = countByStatus(requests)
        const pending = byStatus.pending || 0
        const accepted = byStatus.accepted || 0
        const completed = byStatus.completed || 0
        const unread = unreadFromConversations(conversations)
        setStats([
          {
            label: 'Kërkesa gjithsej',
            value: requests.length,
            hint: pending > 0 ? `${pending} në pritje` : 'Të dërguara',
            to: '/dashboard/user/requests',
            tone: 'accent',
          },
          {
            label: 'Pranuara',
            value: accepted,
            hint: completed > 0 ? `${completed} përfunduar` : 'Nga ofruesit',
            to: '/dashboard/user/requests',
            tone: accepted > 0 ? 'success' : 'default',
          },
          {
            label: 'Mesazhe',
            value: unread,
            hint: unread > 0 ? 'Të palexuara' : `${conversations.length} biseda`,
            to: '/dashboard/user/messages',
            tone: unread > 0 ? 'warn' : 'default',
          },
        ])
        setCharts({
          bar: {
            title: 'Kërkesat sipas statusit',
            subtitle: 'Si po shkojnë kërkesat e tua',
            items: requestStatusSlices(byStatus),
            emptyText: 'Dërgo kërkesën e parë për të parë grafikun.',
          },
          donut: {
            title: 'Aktiviteti yt',
            subtitle: 'Përmbledhje e shpejtë',
            centerLabel: 'Ndarje',
            items: [
              {
                label: 'Kërkesa',
                value: requests.length,
                color: OVERVIEW_CHART_COLORS.accent,
              },
              {
                label: 'Biseda',
                value: conversations.length,
                color: OVERVIEW_CHART_COLORS.info,
              },
              {
                label: 'Përfunduar',
                value: completed,
                color: OVERVIEW_CHART_COLORS.success,
              },
            ],
            emptyText: 'Aktiviteti do të shfaqet sapo të fillosh.',
          },
        })
        setNextStep(
          requests.length === 0
            ? {
                title: 'Dërgo kërkesën e parë',
                text: 'Përshkruaj çfarë të duhet dhe gjej avokat, jurist ose kontabilist.',
                to: '/',
                cta: 'Fillo',
              }
            : unread > 0
              ? {
                  title: 'Ke mesazhe të palexuara',
                  text: `${unread} biseda presin përgjigjen tënde.`,
                  to: '/dashboard/user/messages',
                  cta: 'Hap chat',
                }
              : pending > 0
                ? {
                    title: 'Kërkesa ende në pritje',
                    text: `${pending} kërkesa nuk kanë marrë përgjigje ende.`,
                    to: '/dashboard/user/requests',
                    cta: 'Shiko',
                  }
                : {
                    title: 'Gjithçka është e qetë',
                    text: 'Shiko ofertat kur të të duhet ndihmë përsëri.',
                    to: '/ofertat',
                    cta: 'Ofertat',
                  },
        )
      })
      .catch(() => {
        if (!cancelled) {
          setStats([])
          setCharts(null)
          setNextStep(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <OverviewShell
      role="user"
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle={ROLE_HINTS.user}
      stats={stats}
      statsLoading={loading}
      charts={charts}
      nextStep={loading ? null : nextStep}
    >
      <OverviewCard
        title="Kërko ndihmë"
        description="Përshkruaj problemin dhe gjej ofruesin e duhur."
        to="/"
        cta="Fillo"
        icon={Search}
      />
      <OverviewCard
        title="Kërkesat e mia"
        description="Shiko statusin e kërkesave që ke dërguar."
        to="/dashboard/user/requests"
        cta="Hap"
        icon={Inbox}
      />
      <OverviewCard
        title="Mesazhet"
        description="Bisedo drejtpërdrejt me ofruesit."
        to="/dashboard/user/messages"
        cta="Hap"
        icon={MessageCircle}
      />
    </OverviewShell>
  )
}

export function ProviderOverviewPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<StatItem[]>([])
  const [charts, setCharts] = useState<OverviewChartsData | null>(null)
  const [nextStep, setNextStep] = useState<NextStep | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchRequestInbox(),
      fetchConversations(),
      fetchMyServices(),
      fetchMyAvailability(),
      fetchProviderRatings(user.uid),
    ])
      .then(([inbox, conversations, services, slots, ratings]) => {
        if (cancelled) return
        const unread = unreadFromConversations(conversations)
        const openSlots = slots.filter((s) => s.status === 'open').length
        const booked = slots.filter((s) => s.status === 'booked' || s.status === 'held').length
        const byStatus = countByStatus(inbox.requests)
        const avg = ratings.stats.count > 0 ? ratings.stats.average.toFixed(1) : '—'
        setStats([
          {
            label: 'Në pritje',
            value: inbox.pendingCount,
            hint: `${inbox.requests.length} kërkesa gjithsej`,
            to: '/dashboard/provider/inbox',
            tone: inbox.pendingCount > 0 ? 'warn' : 'default',
          },
          {
            label: 'Shërbime',
            value: services.length,
            hint: 'Oferta të publikuara',
            to: '/dashboard/provider/services',
            tone: 'accent',
          },
          {
            label: 'Orë të lira',
            value: openSlots,
            hint: 'Disponueshmëri',
            to: '/dashboard/provider/availability',
            tone: openSlots > 0 ? 'success' : 'default',
          },
          {
            label: 'Vlerësimi',
            value: avg,
            hint:
              ratings.stats.count > 0
                ? `${ratings.stats.count} vlerësime`
                : 'Ende pa vlerësime',
            to: '/dashboard/provider/ratings',
          },
          {
            label: 'Mesazhe',
            value: unread,
            hint: unread > 0 ? 'Të palexuara' : `${conversations.length} biseda`,
            to: '/dashboard/provider/messages',
            tone: unread > 0 ? 'warn' : 'default',
          },
        ])
        setCharts({
          bar: {
            title: 'Inbox sipas statusit',
            subtitle: 'Si po trajtohen kërkesat',
            items: requestStatusSlices(byStatus),
            emptyText: 'Kur të vijnë kërkesa, grafiku mbushët këtu.',
          },
          donut: {
            title: 'Orari yt',
            subtitle: 'Disponueshmëria e terminave',
            centerLabel: 'Slot',
            items: [
              { label: 'Të lira', value: openSlots, color: OVERVIEW_CHART_COLORS.success },
              { label: 'Të zëna', value: booked, color: OVERVIEW_CHART_COLORS.warning },
              {
                label: 'Shërbime',
                value: services.length,
                color: OVERVIEW_CHART_COLORS.accent,
              },
            ],
            emptyText: 'Shto orë të lira për të parë grafikun.',
          },
        })
        setNextStep(
          services.length === 0
            ? {
                title: 'Publiko shërbimin e parë',
                text: 'Pa një ofertë publike, klientët nuk të gjejnë në kërkim.',
                to: '/dashboard/provider/services',
                cta: 'Shto',
              }
            : inbox.pendingCount > 0
              ? {
                  title: 'Përgjigju kërkesave',
                  text: `${inbox.pendingCount} klientë presin përgjigje.`,
                  to: '/dashboard/provider/inbox',
                  cta: 'Hap inbox',
                }
              : openSlots === 0
                ? {
                    title: 'Vendos orare të lira',
                    text: 'Klientët rezervojnë vetëm kur sheh termine të hapura.',
                    to: '/dashboard/provider/availability',
                    cta: 'Orari',
                  }
                : unread > 0
                  ? {
                      title: 'Ke mesazhe të palexuara',
                      text: `${unread} biseda presin përgjigjen tënde.`,
                      to: '/dashboard/provider/messages',
                      cta: 'Hap chat',
                    }
                  : {
                      title: 'Profili yt është gati',
                      text: 'Klientët mund të të gjejnë, të shkruajnë dhe të rezervojnë.',
                      to: '/dashboard/provider/ratings',
                      cta: 'Vlerësimet',
                    },
        )
      })
      .catch(() => {
        if (!cancelled) {
          setStats([])
          setCharts(null)
          setNextStep(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.uid])

  return (
    <OverviewShell
      role="provider"
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle={ROLE_HINTS.provider}
      stats={stats}
      statsLoading={loading}
      charts={charts}
      nextStep={loading ? null : nextStep}
    >
      <OverviewCard
        title="Kërkesat"
        description="Prano ose refuzo kërkesat e klientëve."
        to="/dashboard/provider/inbox"
        cta="Hap"
        icon={Inbox}
      />
      <OverviewCard
        title="Mesazhet"
        description="Përgjigju klientëve në kohë reale."
        to="/dashboard/provider/messages"
        cta="Hap"
        icon={MessageCircle}
      />
      <OverviewCard
        title="Shërbimet"
        description="Publiko dhe menaxho ofertat e tua."
        to="/dashboard/provider/services"
        cta="Hap"
        icon={Briefcase}
      />
      <OverviewCard
        title="Disponueshmëria"
        description="Vendos oraret kur je i lirë për termine."
        to="/dashboard/provider/availability"
        cta="Hap"
        icon={CalendarDays}
      />
    </OverviewShell>
  )
}

export function CompanyOverviewPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<StatItem[]>([])
  const [charts, setCharts] = useState<OverviewChartsData | null>(null)
  const [nextStep, setNextStep] = useState<NextStep | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      const [inbox, conversations, slots, businesses] = await Promise.all([
        fetchRequestInbox(),
        fetchConversations(),
        fetchMyAvailability().catch(() => []),
        fetchMyBusinesses().catch(() => []),
      ])

      let members = 0
      let invitations = 0
      if (businesses[0]?._id) {
        try {
          const team = await fetchBusinessTeam(businesses[0]._id)
          members = team.members.length
          invitations = team.invitations.length
        } catch {
          members = 0
        }
      }

      if (cancelled) return
      const unread = unreadFromConversations(conversations)
      const openSlots = slots.filter((s) => s.status === 'open').length
      const booked = slots.filter((s) => s.status === 'booked' || s.status === 'held').length
      const byStatus = countByStatus(inbox.requests)

      setStats([
        {
          label: 'Kërkesa në pritje',
          value: inbox.pendingCount,
          hint: `${inbox.requests.length} gjithsej`,
          to: '/dashboard/company/inbox',
          tone: inbox.pendingCount > 0 ? 'warn' : 'default',
        },
        {
          label: 'Ekspertë në ekip',
          value: members,
          hint: invitations > 0 ? `${invitations} ftesa në pritje` : 'Anëtarë aktivë',
          to: '/dashboard/company/experts',
          tone: 'accent',
        },
        {
          label: 'Orë të lira',
          value: openSlots,
          hint: 'Për termine',
          to: '/dashboard/company/availability',
          tone: openSlots > 0 ? 'success' : 'default',
        },
        {
          label: 'Mesazhe',
          value: unread,
          hint: unread > 0 ? 'Të palexuara' : `${conversations.length} biseda`,
          to: '/dashboard/company/messages',
          tone: unread > 0 ? 'warn' : 'default',
        },
      ])
      setCharts({
        bar: {
          title: 'Kërkesat e kompanisë',
          subtitle: 'Statusi i inbox-it',
          items: requestStatusSlices(byStatus),
          emptyText: 'Kur të vijnë kërkesa, grafiku shfaqet këtu.',
        },
        donut: {
          title: 'Ekipi & orari',
          subtitle: 'Kapaciteti i kompanisë',
          centerLabel: 'Burime',
          items: [
            { label: 'Ekspertë', value: members, color: OVERVIEW_CHART_COLORS.accent },
            { label: 'Ftesa', value: invitations, color: OVERVIEW_CHART_COLORS.info },
            { label: 'Orë të lira', value: openSlots, color: OVERVIEW_CHART_COLORS.success },
            { label: 'Të zëna', value: booked, color: OVERVIEW_CHART_COLORS.warning },
          ],
          emptyText: 'Shto ekspertë ose orë për të parë grafikun.',
        },
      })
      setNextStep(
        businesses.length === 0
          ? {
              title: 'Plotëso profilin e kompanisë',
              text: 'Pa kompani të regjistruar, ekipi dhe kërkesat nuk lidhen me ty.',
              to: '/dashboard/company/profile',
              cta: 'Profili',
            }
          : members === 0
            ? {
                title: 'Shto ekspertin e parë',
                text: 'Klientët duan të shohin kush punon në ekip.',
                to: '/dashboard/company/experts',
                cta: 'Ekipi',
              }
            : invitations > 0
              ? {
                  title: 'Ke ftesa në pritje',
                  text: `${invitations} ekspertë ende nuk e kanë pranuar ftesën.`,
                  to: '/dashboard/company/experts',
                  cta: 'Ftesat',
                }
              : inbox.pendingCount > 0
                ? {
                    title: 'Përgjigju kërkesave',
                    text: `${inbox.pendingCount} kërkesa presin kompaninë.`,
                    to: '/dashboard/company/inbox',
                    cta: 'Hap inbox',
                  }
                : unread > 0
                  ? {
                      title: 'Ke mesazhe të palexuara',
                      text: `${unread} biseda presin përgjigje.`,
                      to: '/dashboard/company/messages',
                      cta: 'Hap chat',
                    }
                  : {
                      title: 'Kompania është në rregull',
                      text: 'Shiko vlerësimet që kanë lënë klientët për ekipin.',
                      to: '/dashboard/company/ratings',
                      cta: 'Vlerësimet',
                    },
      )
    }

    load()
      .catch(() => {
        if (!cancelled) {
          setStats([])
          setCharts(null)
          setNextStep(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <OverviewShell
      role="company"
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle={ROLE_HINTS.company}
      stats={stats}
      statsLoading={loading}
      charts={charts}
      nextStep={loading ? null : nextStep}
    >
      <OverviewCard
        title="Kërkesat"
        description="Inbox-i i kërkesave për kompaninë."
        to="/dashboard/company/inbox"
        cta="Hap"
        icon={Inbox}
      />
      <OverviewCard
        title="Mesazhet"
        description="Komuniko me klientët e kompanisë."
        to="/dashboard/company/messages"
        cta="Hap"
        icon={MessageCircle}
      />
      <OverviewCard
        title="Shërbimet"
        description="Publiko çfarë ofron kompania, që klientët ta gjejnë."
        to="/dashboard/company/services"
        cta="Hap"
        icon={Briefcase}
      />
      <OverviewCard
        title="Ekspertët"
        description="Shto ekspertët. Klientët u shkruajnë dhe caktojnë takim."
        to="/dashboard/company/experts"
        cta="Hap"
        icon={Users}
      />
      <OverviewCard
        title="Disponueshmëria"
        description="Vendos oraret e lira për termine."
        to="/dashboard/company/availability"
        cta="Hap"
        icon={CalendarDays}
      />
      <OverviewCard
        title="Vlerësimet"
        description="Shiko feedback-un që kanë lënë klientët për ofruesit e kompanisë."
        to="/dashboard/company/ratings"
        cta="Hap"
        icon={Star}
      />
    </OverviewShell>
  )
}

export function AdminOverviewPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<StatItem[]>([])
  const [charts, setCharts] = useState<OverviewChartsData | null>(null)
  const [nextStep, setNextStep] = useState<NextStep | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchAdminUsersMeta(),
      fetchAllRequests(),
      fetchConversations().catch(() => []),
      fetchPlatformFeedback().catch(() => []),
    ])
      .then(([meta, requests, conversations, feedback]) => {
        if (cancelled) return
        const totalUsers =
          (meta.counts.user || 0) +
          (meta.counts.provider || 0) +
          (meta.counts.company || 0) +
          (meta.counts.admin || 0)
        const byStatus = countByStatus(requests)
        const pending = byStatus.pending || 0
        const unread = unreadFromConversations(conversations)
        const newFeedback = feedback.filter((item) => item.status === 'new').length
        setStats([
          {
            label: 'Përdorues gjithsej',
            value: totalUsers,
            hint: `${meta.counts.user || 0} klientë · ${meta.counts.provider || 0} ofrues`,
            to: '/dashboard/admin/users',
            tone: 'accent',
          },
          {
            label: 'Kompani',
            value: meta.counts.company || 0,
            hint: `${meta.counts.admin || 0} admin`,
            to: '/dashboard/admin/users',
          },
          {
            label: 'Kërkesa',
            value: requests.length,
            hint: pending > 0 ? `${pending} në pritje` : 'Në platformë',
            to: '/dashboard/admin/requests',
            tone: pending > 0 ? 'warn' : 'default',
          },
          {
            label: 'Mesazhe',
            value: unread,
            hint: unread > 0 ? 'Të palexuara' : `${conversations.length} biseda`,
            to: '/dashboard/admin/messages',
          },
          {
            label: 'Feedback i ri',
            value: newFeedback,
            hint: newFeedback > 0 ? 'Pret lexim' : 'Të gjitha të lexuara',
            to: '/dashboard/admin/feedback',
            tone: newFeedback > 0 ? 'warn' : 'success',
          },
        ])
        setCharts({
          donut: {
            title: 'Përdorues sipas rolit',
            subtitle: 'Shpërndarja në platformë',
            centerLabel: 'Llogari',
            items: [
              {
                label: 'Klientë',
                value: meta.counts.user || 0,
                color: OVERVIEW_CHART_COLORS.accent,
              },
              {
                label: 'Ofrues',
                value: meta.counts.provider || 0,
                color: OVERVIEW_CHART_COLORS.success,
              },
              {
                label: 'Kompani',
                value: meta.counts.company || 0,
                color: OVERVIEW_CHART_COLORS.info,
              },
              {
                label: 'Admin',
                value: meta.counts.admin || 0,
                color: OVERVIEW_CHART_COLORS.navy,
              },
            ],
          },
          bar: {
            title: 'Kërkesat në platformë',
            subtitle: 'Statusi global',
            items: requestStatusSlices(byStatus),
            emptyText: 'Ende nuk ka kërkesa në platformë.',
          },
        })
        setNextStep(
          newFeedback > 0
            ? {
                title: 'Lexo feedback-un e ri',
                text: `${newFeedback} mesazhe nga përdoruesit presin në panel.`,
                to: '/dashboard/admin/feedback',
                cta: 'Hap',
              }
            : pending > 0
              ? {
                  title: 'Kërkesa në pritje',
                  text: `${pending} kërkesa në platformë ende nuk janë mbyllur.`,
                  to: '/dashboard/admin/requests',
                  cta: 'Shiko',
                }
              : {
                  title: 'Platforma është e qetë',
                  text: 'Shiko llogaritë dhe rolet kur të duash një kontroll të shpejtë.',
                  to: '/dashboard/admin/users',
                  cta: 'Përdoruesit',
                },
        )
      })
      .catch(() => {
        if (!cancelled) {
          setStats([])
          setCharts(null)
          setNextStep(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <OverviewShell
      role="admin"
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle={ROLE_HINTS.admin}
      stats={stats}
      statsLoading={loading}
      charts={charts}
      nextStep={loading ? null : nextStep}
    >
      <OverviewCard
        title="Përdoruesit"
        description="Krijo, ndrysho ose fshi llogaritë."
        to="/dashboard/admin/users"
        cta="Hap"
        icon={Users}
      />
      <OverviewCard
        title="Kërkesat"
        description="Shiko të gjitha kërkesat në platformë."
        to="/dashboard/admin/requests"
        cta="Hap"
        icon={FolderKanban}
      />
      <OverviewCard
        title="Feedback"
        description="Lexo çfarë shkruajnë përdoruesit për KëshillaKos."
        to="/dashboard/admin/feedback"
        cta="Hap"
        icon={MessageSquarePlus}
      />
    </OverviewShell>
  )
}
