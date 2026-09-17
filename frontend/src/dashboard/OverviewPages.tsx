import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, Chip } from '@heroui/react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  FolderKanban,
  Inbox,
  MessageCircle,
  Search,
  Star,
  Tags,
  Users,
} from 'lucide-react'
import { fetchAdminUsersMeta } from '../api/adminUsers'
import { fetchMyAvailability } from '../api/availability'
import { fetchConversations } from '../api/chat'
import { fetchDomains } from '../api/domains'
import { fetchMyExperts } from '../api/experts'
import { fetchBusinessTeam, fetchMyBusinesses } from '../api/onboarding'
import { fetchProviderRatings, fetchRateableProviders } from '../api/ratings'
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
import { ROLE_HINTS } from './nav'

type StatItem = {
  label: string
  value: string | number
  hint?: string
  to?: string
  tone?: 'default' | 'accent' | 'warn' | 'success'
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
          <Card key={i} className="dash-stat-card is-skeleton" />
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
  greeting,
  subtitle,
  stats,
  statsLoading,
  charts,
  children,
}: {
  greeting: string
  subtitle: string
  stats?: StatItem[]
  statsLoading?: boolean
  charts?: OverviewChartsData | null
  children: ReactNode
}) {
  return (
    <section className="dash-overview">
      <header className="dash-overview-hero">
        <p className="dash-overview-hello">{greeting}</p>
        <p className="dash-overview-sub">{subtitle}</p>
      </header>
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchMyRequests(), fetchConversations(), fetchRateableProviders()])
      .then(([requests, conversations, rateable]) => {
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
          {
            label: 'Për vlerësim',
            value: rateable.length,
            hint: 'Ofrues të gatshëm',
            to: '/dashboard/user/ratings',
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
                label: 'Për vlerësim',
                value: rateable.length,
                color: OVERVIEW_CHART_COLORS.warning,
              },
            ],
            emptyText: 'Aktiviteti do të shfaqet sapo të fillosh.',
          },
        })
      })
      .catch(() => {
        if (!cancelled) {
          setStats([])
          setCharts(null)
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
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle={ROLE_HINTS.user}
      stats={stats}
      statsLoading={loading}
      charts={charts}
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
      <OverviewCard
        title="Vlerëso ofruesit"
        description="Jep feedback pasi të marrësh ndihmë."
        to="/dashboard/user/ratings"
        cta="Hap"
        icon={Star}
      />
    </OverviewShell>
  )
}

export function ProviderOverviewPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<StatItem[]>([])
  const [charts, setCharts] = useState<OverviewChartsData | null>(null)
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
      })
      .catch(() => {
        if (!cancelled) {
          setStats([])
          setCharts(null)
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
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle={ROLE_HINTS.provider}
      stats={stats}
      statsLoading={loading}
      charts={charts}
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      const [inbox, conversations, experts, slots, businesses] = await Promise.all([
        fetchRequestInbox(),
        fetchConversations(),
        fetchMyExperts().catch(() => []),
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
          members = experts.length
        }
      } else {
        members = experts.length
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
    }

    load()
      .catch(() => {
        if (!cancelled) {
          setStats([])
          setCharts(null)
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
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle={ROLE_HINTS.company}
      stats={stats}
      statsLoading={loading}
      charts={charts}
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
        title="Ekspertët"
        description="Shto dhe menaxho ekspertët e ekipit."
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
    </OverviewShell>
  )
}

export function AdminOverviewPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<StatItem[]>([])
  const [charts, setCharts] = useState<OverviewChartsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchAdminUsersMeta(),
      fetchAllRequests(),
      fetchDomains(),
      fetchConversations().catch(() => []),
    ])
      .then(([meta, requests, domains, conversations]) => {
        if (cancelled) return
        const totalUsers =
          (meta.counts.user || 0) +
          (meta.counts.provider || 0) +
          (meta.counts.company || 0) +
          (meta.counts.admin || 0)
        const byStatus = countByStatus(requests)
        const pending = byStatus.pending || 0
        const unread = unreadFromConversations(conversations)
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
            label: 'Kategori',
            value: domains.length,
            hint: 'Domene aktive',
            to: '/dashboard/admin/domains',
            tone: 'success',
          },
          {
            label: 'Mesazhe',
            value: unread,
            hint: unread > 0 ? 'Të palexuara' : `${conversations.length} biseda`,
            to: '/dashboard/admin/messages',
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
      })
      .catch(() => {
        if (!cancelled) {
          setStats([])
          setCharts(null)
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
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle={ROLE_HINTS.admin}
      stats={stats}
      statsLoading={loading}
      charts={charts}
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
        title="Kategoritë"
        description="Menaxho domenet dhe kategoritë."
        to="/dashboard/admin/domains"
        cta="Hap"
        icon={Tags}
      />
      <OverviewCard
        title="Shërbimet"
        description="Shiko dhe administro ofertat e publikuara."
        to="/dashboard/admin/services"
        cta="Hap"
        icon={Building2}
      />
    </OverviewShell>
  )
}
