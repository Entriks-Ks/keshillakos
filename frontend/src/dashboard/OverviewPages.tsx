import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Chip, ProgressBar } from '@heroui/react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  FolderKanban,
  Inbox,
  MessageCircle,
  MessageSquarePlus,
  Plus,
  Search,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react'
import { fetchAdminUsersMeta, fetchPendingRoleRequests } from '../api/adminUsers'
import {
  fetchMyAppointments,
  fetchProviderAppointments,
  upcomingAppointments,
  type AppointmentItem,
} from '../api/appointments'
import { fetchMyAvailability } from '../api/availability'
import { fetchConversations, type ConversationItem } from '../api/chat'
import { fetchPlatformFeedback } from '../api/feedback'
import { fetchBusinessTeam, fetchMyBusinesses } from '../api/onboarding'
import { fetchProfileCompletion } from '../api/profileCompletion'
import { fetchProviderRatings } from '../api/ratings'
import {
  fetchAllRequests,
  fetchMyRequests,
  fetchRequestInbox,
  type ServiceRequestItem,
} from '../api/requests'
import { fetchMyServices } from '../api/services'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'
import {
  countByStatus,
  OVERVIEW_CHART_COLORS,
  OverviewBarChart,
  OverviewDonutChart,
  requestStatusSlices,
  weekActivitySlices,
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
  featured?: boolean
}

type NextStep = {
  title: string
  text: string
  to: string
  cta: string
}

type QuickAction = {
  title: string
  description: string
  to: string
  cta: string
  icon: LucideIcon
}

type ActivityItem = {
  id: string
  title: string
  meta: string
  status?: string
  statusTone?: 'default' | 'success' | 'warning' | 'danger' | 'accent'
  to?: string
}

type HeaderAction = {
  label: string
  to: string
  variant?: 'primary' | 'secondary'
  icon?: LucideIcon
}

type Reminder = {
  title: string
  text: string
  meta?: string
  to: string
  cta: string
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('sq-AL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function statusTone(status: string): ActivityItem['statusTone'] {
  if (status === 'accepted' || status === 'completed' || status === 'confirmed') return 'success'
  if (status === 'pending' || status === 'open' || status === 'draft' || status === 'read') return 'warning'
  if (status === 'rejected' || status === 'cancelled' || status === 'withdrawn') return 'danger'
  return 'default'
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: 'Në pritje',
    accepted: 'Pranuar',
    completed: 'Përfunduar',
    rejected: 'Refuzuar',
    open: 'Hapur',
    draft: 'Draft',
    read: 'Lexuar',
    withdrawn: 'Tërhequr',
    confirmed: 'Konfirmuar',
    cancelled: 'Anuluar',
  }
  return map[status] || status
}

function chipColor(tone?: StatItem['tone']): 'default' | 'accent' | 'warning' | 'success' {
  if (tone === 'warn') return 'warning'
  if (tone === 'success') return 'success'
  if (tone === 'accent') return 'accent'
  return 'default'
}

function activityChipColor(
  tone?: ActivityItem['statusTone'],
): 'default' | 'accent' | 'warning' | 'success' | 'danger' {
  if (tone === 'warning') return 'warning'
  if (tone === 'success') return 'success'
  if (tone === 'danger') return 'danger'
  if (tone === 'accent') return 'accent'
  return 'default'
}

function requestsToActivity(requests: ServiceRequestItem[], basePath: string): ActivityItem[] {
  return [...requests]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      title: item.need || item.serviceTitle || 'Kërkesë',
      meta: `${item.providerName || item.seekerName || '—'} · ${formatWhen(item.updatedAt || item.createdAt)}`,
      status: statusLabel(item.status),
      statusTone: statusTone(item.status),
      to: basePath,
    }))
}

function appointmentReminder(appointments: AppointmentItem[], to: string): Reminder | null {
  const next = upcomingAppointments(appointments)[0]
  if (!next) return null
  return {
    title: 'Termini i radhës',
    text: next.mode === 'online' ? 'Takim online' : 'Takim fizik',
    meta: formatWhen(next.startAt),
    to,
    cta: 'Shiko',
  }
}

function unreadFromConversations(conversations: ConversationItem[]) {
  return conversations.reduce((sum, c) => sum + (c.unread || 0), 0)
}

function OverviewCard({ title, description, to, cta, icon: Icon }: QuickAction) {
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

function OverviewStats({ items, loading }: { items: StatItem[]; loading?: boolean }) {
  if (loading && items.length === 0) {
    return (
      <div className="dash-stat-grid is-loading" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="dash-stat-card is-skeleton">
            <span aria-hidden="true" />
          </Card>
        ))}
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="dash-stat-grid" aria-label="Statistika">
      {items.map((item, index) => {
        const featured = item.featured ?? index === 0
        const body = (
          <Card
            className={[
              'dash-stat-card',
              featured ? 'is-featured' : '',
              item.tone && item.tone !== 'default' ? `is-${item.tone}` : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <Card.Content className="dash-stat-card-body">
              <div className="dash-stat-card-top">
                <span className="dash-stat-label">{item.label}</span>
                <span className="dash-stat-trend" aria-hidden>
                  <TrendingUp size={16} strokeWidth={2.25} />
                </span>
              </div>
              <strong className="dash-stat-value">{item.value}</strong>
              {item.hint ? (
                <Chip
                  size="sm"
                  variant="soft"
                  color={featured ? 'default' : chipColor(item.tone)}
                  className="dash-stat-chip"
                >
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

function ActivityPanel({
  title,
  subtitle,
  items,
  emptyText,
  loading,
  viewAllTo,
}: {
  title: string
  subtitle?: string
  items: ActivityItem[]
  emptyText: string
  loading?: boolean
  viewAllTo?: string
}) {
  return (
    <Card className="dash-panel-card">
      <Card.Header className="dash-panel-card-head">
        <div>
          <Card.Title>{title}</Card.Title>
          {subtitle ? <Card.Description>{subtitle}</Card.Description> : null}
        </div>
        {viewAllTo ? (
          <Link to={viewAllTo} className="dash-panel-link">
            Shiko të gjitha
            <ArrowRight size={14} aria-hidden />
          </Link>
        ) : null}
      </Card.Header>
      <Card.Content className="dash-panel-card-body">
        {loading ? (
          <ul className="dash-activity-list is-loading" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="is-skeleton" />
            ))}
          </ul>
        ) : items.length === 0 ? (
          <p className="dash-panel-empty">{emptyText}</p>
        ) : (
          <ul className="dash-activity-list">
            {items.map((item) => {
              const inner = (
                <>
                  <span className="dash-activity-dot" aria-hidden />
                  <div className="dash-activity-copy">
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                  </div>
                  {item.status ? (
                    <Chip size="sm" variant="soft" color={activityChipColor(item.statusTone)}>
                      <Chip.Label>{item.status}</Chip.Label>
                    </Chip>
                  ) : null}
                </>
              )
              return (
                <li key={item.id}>
                  {item.to ? (
                    <Link to={item.to} className="dash-activity-row">
                      {inner}
                    </Link>
                  ) : (
                    <div className="dash-activity-row">{inner}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card.Content>
    </Card>
  )
}

function ReminderCard({ reminder, loading }: { reminder: Reminder | null; loading?: boolean }) {
  if (loading) {
    return (
      <Card className="dash-reminder-card is-skeleton" aria-busy="true">
        <span aria-hidden="true" />
      </Card>
    )
  }
  if (!reminder) {
    return (
      <Card className="dash-reminder-card is-empty">
        <Card.Content>
          <p className="dash-reminder-kicker">Kujtesë</p>
          <strong>Nuk ka termine të ardhshme</strong>
          <span>Kur të konfirmohen takime, shfaqen këtu.</span>
        </Card.Content>
      </Card>
    )
  }
  return (
    <Card className="dash-reminder-card">
      <Card.Content className="dash-reminder-body">
        <p className="dash-reminder-kicker">Kujtesë</p>
        <strong>{reminder.title}</strong>
        <span>{reminder.text}</span>
        {reminder.meta ? <em>{reminder.meta}</em> : null}
        <Button variant="primary" size="sm" className="dash-reminder-cta">
          <Link to={reminder.to} className="tt-btn-link">
            {reminder.cta}
          </Link>
        </Button>
      </Card.Content>
    </Card>
  )
}

function ProfileProgressCard({
  percent,
  label,
  to,
  loading,
}: {
  percent: number | null
  label: string
  to: string
  loading?: boolean
}) {
  if (loading) {
    return (
      <Card className="dash-progress-card is-skeleton" aria-busy="true">
        <span aria-hidden="true" />
      </Card>
    )
  }
  const value = percent == null ? 0 : Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <Card className="dash-progress-card">
      <Card.Header className="dash-panel-card-head">
        <div>
          <Card.Title>Plotësimi i profilit</Card.Title>
          <Card.Description>{label}</Card.Description>
        </div>
        <Link to={to} className="dash-panel-link">
          Plotëso
          <ArrowRight size={14} aria-hidden />
        </Link>
      </Card.Header>
      <Card.Content className="dash-progress-body">
        <div className="dash-progress-meter" aria-label={`${value}% i plotësuar`}>
          <strong>{value}%</strong>
          <ProgressBar aria-label="Plotësimi i profilit" value={value} className="dash-profile-progress">
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </div>
        <p>
          {percent == null
            ? 'Profili nuk është krijuar ende.'
            : value >= 100
              ? 'Profili është i plotë.'
              : 'Plotëso fushat e mbetura për më shumë dukshmëri.'}
        </p>
      </Card.Content>
    </Card>
  )
}

function OverviewShell({
  role,
  greeting,
  subtitle,
  actions,
  stats,
  statsLoading,
  charts,
  activity,
  activityLoading,
  reminder,
  reminderLoading,
  profilePercent,
  profileLabel,
  profileTo,
  nextStep,
  error,
  onRetry,
  children,
}: {
  role: UserRole
  greeting: string
  subtitle: string
  actions?: HeaderAction[]
  stats?: StatItem[]
  statsLoading?: boolean
  charts?: OverviewChartsData | null
  activity?: {
    title: string
    subtitle?: string
    items: ActivityItem[]
    emptyText: string
    viewAllTo?: string
  }
  activityLoading?: boolean
  reminder?: Reminder | null
  reminderLoading?: boolean
  profilePercent?: number | null
  profileLabel?: string
  profileTo?: string
  nextStep?: NextStep | null
  error?: string
  onRetry?: () => void
  children: ReactNode
}) {
  return (
    <section className="dash-overview">
      <header className="dash-overview-head">
        <div>
          <p className="dash-overview-kicker">{ROLE_LABELS[role]}</p>
          <h1 className="dash-overview-title">Dashboard</h1>
          <p className="dash-overview-hello">{greeting}</p>
          <p className="dash-overview-sub">{subtitle}</p>
        </div>
        {actions && actions.length > 0 ? (
          <div className="dash-overview-actions">
            {actions.map((action) => {
              const Icon = action.icon
              return (
                <Button
                  key={action.to + action.label}
                  variant={action.variant === 'secondary' ? 'outline' : 'primary'}
                  className="dash-overview-action-btn"
                >
                  <Link to={action.to} className="tt-btn-link">
                    {Icon ? <Icon size={16} aria-hidden /> : null}
                    {action.label}
                  </Link>
                </Button>
              )
            })}
          </div>
        ) : null}
      </header>

      {error ? (
        <Card className="dash-overview-error">
          <Card.Content>
            <strong>Nuk u ngarkuan të dhënat</strong>
            <p>{error}</p>
            {onRetry ? (
              <Button variant="outline" onPress={onRetry}>
                Provo përsëri
              </Button>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}

      {nextStep && !error ? (
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

      <div className="dash-overview-board">
        <div className="dash-overview-main-col">
          {charts?.bar ? (
            <OverviewBarChart
              title={charts.bar.title}
              subtitle={charts.bar.subtitle}
              items={charts.bar.items}
              emptyText={charts.bar.emptyText}
            />
          ) : statsLoading ? (
            <div className="dash-chart-card is-skeleton" aria-busy="true" />
          ) : null}

          {activity ? (
            <ActivityPanel
              title={activity.title}
              subtitle={activity.subtitle}
              items={activity.items}
              emptyText={activity.emptyText}
              loading={activityLoading}
              viewAllTo={activity.viewAllTo}
            />
          ) : null}
        </div>

        <aside className="dash-overview-side-col">
          <ReminderCard reminder={reminder ?? null} loading={reminderLoading} />
          {charts?.donut ? (
            <OverviewDonutChart
              title={charts.donut.title}
              subtitle={charts.donut.subtitle}
              items={charts.donut.items}
              centerLabel={charts.donut.centerLabel}
              centerValue={charts.donut.centerValue}
              emptyText={charts.donut.emptyText}
            />
          ) : statsLoading ? (
            <div className="dash-chart-card is-skeleton" aria-busy="true" />
          ) : null}
          {profileTo ? (
            <ProfileProgressCard
              percent={profilePercent ?? null}
              label={profileLabel || 'Profili yt'}
              to={profileTo}
              loading={statsLoading}
            />
          ) : null}
        </aside>
      </div>

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

export function UserOverviewPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<StatItem[]>([])
  const [charts, setCharts] = useState<OverviewChartsData | null>(null)
  const [nextStep, setNextStep] = useState<NextStep | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [reminder, setReminder] = useState<Reminder | null>(null)
  const [profilePercent, setProfilePercent] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      fetchMyRequests(),
      fetchConversations(),
      fetchMyAppointments().catch(() => [] as AppointmentItem[]),
      fetchProfileCompletion('private').catch(() => null),
    ])
      .then(([requests, conversations, appointments, completion]) => {
        if (cancelled) return
        const byStatus = countByStatus(requests)
        const pending = byStatus.pending || 0
        const accepted = byStatus.accepted || 0
        const completed = byStatus.completed || 0
        const unread = unreadFromConversations(conversations)
        const upcoming = upcomingAppointments(appointments).length
        setStats([
          {
            label: 'Kërkesa gjithsej',
            value: requests.length,
            hint: pending > 0 ? `${pending} në pritje` : 'Të dërguara',
            to: '/dashboard/user/requests',
            tone: 'accent',
            featured: true,
          },
          {
            label: 'Pranuara',
            value: accepted,
            hint: completed > 0 ? `${completed} përfunduar` : 'Nga ofruesit',
            to: '/dashboard/user/requests',
            tone: accepted > 0 ? 'success' : 'default',
          },
          {
            label: 'Termine',
            value: upcoming,
            hint: upcoming > 0 ? 'Të ardhshme' : 'Asnjë i planifikuar',
            to: '/dashboard/user/requests',
            tone: upcoming > 0 ? 'success' : 'default',
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
            title: 'Aktiviteti i javës',
            subtitle: 'Kërkesa të dërguara 7 ditët e fundit',
            items: weekActivitySlices(requests),
            emptyText: 'Dërgo kërkesën e parë për të parë aktivitetin.',
          },
          donut: {
            title: 'Kërkesat sipas statusit',
            subtitle: 'Si po shkojnë kërkesat e tua',
            centerLabel: 'Gjithsej',
            items: requestStatusSlices(byStatus),
            emptyText: 'Aktiviteti do të shfaqet sapo të fillosh.',
          },
        })
        setActivity(requestsToActivity(requests, '/dashboard/user/requests'))
        setReminder(appointmentReminder(appointments, '/dashboard/user/requests'))
        setProfilePercent(completion?.overallPercent ?? null)
        setNextStep(
          requests.length === 0
            ? {
                title: 'Dërgo kërkesën e parë',
                text: 'Përshkruaj çfarë të duhet dhe gjej ofruesin e duhur.',
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
      .catch((err: unknown) => {
        if (!cancelled) {
          setStats([])
          setCharts(null)
          setActivity([])
          setReminder(null)
          setNextStep(null)
          setError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return (
    <OverviewShell
      role="user"
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle={ROLE_HINTS.user}
      actions={[
        { label: 'Kërko ndihmë', to: '/', variant: 'primary', icon: Plus },
        { label: 'Shiko ofertat', to: '/ofertat', variant: 'secondary', icon: Search },
      ]}
      stats={stats}
      statsLoading={loading}
      charts={charts}
      activity={{
        title: 'Aktiviteti i fundit',
        subtitle: 'Kërkesat më të reja',
        items: activity,
        emptyText: 'Ende nuk ke dërguar asnjë kërkesë.',
        viewAllTo: '/dashboard/user/requests',
      }}
      activityLoading={loading}
      reminder={reminder}
      reminderLoading={loading}
      profilePercent={profilePercent}
      profileLabel="Profili privat"
      profileTo="/dashboard/user/profile"
      nextStep={loading || error ? null : nextStep}
      error={error}
      onRetry={reload}
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
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [reminder, setReminder] = useState<Reminder | null>(null)
  const [profilePercent, setProfilePercent] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((n) => n + 1), [])

  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      fetchRequestInbox(),
      fetchConversations(),
      fetchMyServices(),
      fetchMyAvailability(),
      fetchProviderRatings(user.uid),
      fetchProviderAppointments().catch(() => [] as AppointmentItem[]),
      fetchProfileCompletion('expert').catch(() => null),
    ])
      .then(([inbox, conversations, services, slots, ratings, appointments, completion]) => {
        if (cancelled) return
        const unread = unreadFromConversations(conversations)
        const openSlots = slots.filter((s) => s.status === 'open').length
        const booked = slots.filter((s) => s.status === 'booked' || s.status === 'held').length
        const avg = ratings.stats.count > 0 ? ratings.stats.average.toFixed(1) : '—'
        const upcoming = upcomingAppointments(appointments).length
        setStats([
          {
            label: 'Në pritje',
            value: inbox.pendingCount,
            hint: `${inbox.requests.length} kërkesa gjithsej`,
            to: '/dashboard/provider/inbox',
            tone: inbox.pendingCount > 0 ? 'warn' : 'default',
            featured: true,
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
            hint: upcoming > 0 ? `${upcoming} termine të ardhshme` : 'Disponueshmëri',
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
        ])
        setCharts({
          bar: {
            title: 'Aktiviteti i javës',
            subtitle: 'Kërkesa të reja 7 ditët e fundit',
            items: weekActivitySlices(inbox.requests),
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
        setActivity(requestsToActivity(inbox.requests, '/dashboard/provider/inbox'))
        setReminder(appointmentReminder(appointments, '/dashboard/provider/availability'))
        setProfilePercent(completion?.overallPercent ?? null)
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
      .catch((err: unknown) => {
        if (!cancelled) {
          setStats([])
          setCharts(null)
          setActivity([])
          setReminder(null)
          setNextStep(null)
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

  return (
    <OverviewShell
      role="provider"
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle={ROLE_HINTS.provider}
      actions={[
        { label: 'Shto shërbim', to: '/dashboard/provider/services', variant: 'primary', icon: Plus },
        {
          label: 'Disponueshmëria',
          to: '/dashboard/provider/availability',
          variant: 'secondary',
          icon: CalendarDays,
        },
      ]}
      stats={stats}
      statsLoading={loading}
      charts={charts}
      activity={{
        title: 'Kërkesat e fundit',
        subtitle: 'Inbox i ofruesit',
        items: activity,
        emptyText: 'Ende nuk ke marrë asnjë kërkesë.',
        viewAllTo: '/dashboard/provider/inbox',
      }}
      activityLoading={loading}
      reminder={reminder}
      reminderLoading={loading}
      profilePercent={profilePercent}
      profileLabel="Profili i ekspertit"
      profileTo="/dashboard/provider/profile"
      nextStep={loading || error ? null : nextStep}
      error={error}
      onRetry={reload}
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
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [reminder, setReminder] = useState<Reminder | null>(null)
  const [profilePercent, setProfilePercent] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    async function load() {
      const [inbox, conversations, slots, businesses, services, appointments, completion] =
        await Promise.all([
          fetchRequestInbox(),
          fetchConversations(),
          fetchMyAvailability().catch(() => []),
          fetchMyBusinesses().catch(() => []),
          fetchMyServices().catch(() => []),
          fetchProviderAppointments().catch(() => [] as AppointmentItem[]),
          fetchProfileCompletion('company').catch(() => null),
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
      const upcoming = upcomingAppointments(appointments).length

      setStats([
        {
          label: 'Kërkesa në pritje',
          value: inbox.pendingCount,
          hint: `${inbox.requests.length} gjithsej`,
          to: '/dashboard/company/inbox',
          tone: inbox.pendingCount > 0 ? 'warn' : 'default',
          featured: true,
        },
        {
          label: 'Ekspertë në ekip',
          value: members,
          hint: invitations > 0 ? `${invitations} ftesa në pritje` : 'Anëtarë aktivë',
          to: '/dashboard/company/experts',
          tone: 'accent',
        },
        {
          label: 'Shërbime',
          value: services.length,
          hint: 'Oferta të kompanisë',
          to: '/dashboard/company/services',
        },
        {
          label: 'Orë të lira',
          value: openSlots,
          hint: upcoming > 0 ? `${upcoming} termine të ardhshme` : 'Për termine',
          to: '/dashboard/company/availability',
          tone: openSlots > 0 ? 'success' : 'default',
        },
      ])
      setCharts({
        bar: {
          title: 'Aktiviteti i javës',
          subtitle: 'Kërkesa të reja 7 ditët e fundit',
          items: weekActivitySlices(inbox.requests),
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
      setActivity(requestsToActivity(inbox.requests, '/dashboard/company/inbox'))
      setReminder(appointmentReminder(appointments, '/dashboard/company/availability'))
      setProfilePercent(completion?.overallPercent ?? null)
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
      .catch((err: unknown) => {
        if (!cancelled) {
          setStats([])
          setCharts(null)
          setActivity([])
          setReminder(null)
          setNextStep(null)
          setError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return (
    <OverviewShell
      role="company"
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle={ROLE_HINTS.company}
      actions={[
        { label: 'Shto ekspert', to: '/dashboard/company/experts', variant: 'primary', icon: Plus },
        { label: 'Shërbimet', to: '/dashboard/company/services', variant: 'secondary', icon: Briefcase },
      ]}
      stats={stats}
      statsLoading={loading}
      charts={charts}
      activity={{
        title: 'Kërkesat e fundit',
        subtitle: 'Inbox i kompanisë',
        items: activity,
        emptyText: 'Ende nuk ka kërkesa për kompaninë.',
        viewAllTo: '/dashboard/company/inbox',
      }}
      activityLoading={loading}
      reminder={reminder}
      reminderLoading={loading}
      profilePercent={profilePercent}
      profileLabel="Profili i kompanisë"
      profileTo="/dashboard/company/profile"
      nextStep={loading || error ? null : nextStep}
      error={error}
      onRetry={reload}
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
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [reminder, setReminder] = useState<Reminder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      fetchAdminUsersMeta(),
      fetchAllRequests(),
      fetchPlatformFeedback().catch(() => []),
      fetchPendingRoleRequests().catch(() => []),
    ])
      .then(([meta, requests, feedback, roleRequests]) => {
        if (cancelled) return
        const totalUsers =
          (meta.counts.user || 0) +
          (meta.counts.provider || 0) +
          (meta.counts.company || 0) +
          (meta.counts.admin || 0)
        const byStatus = countByStatus(requests)
        const pending = byStatus.pending || 0
        const newFeedback = feedback.filter((item) => item.status === 'new').length
        const pendingRoles = roleRequests.length
        setStats([
          {
            label: 'Përdorues gjithsej',
            value: totalUsers,
            hint: `${meta.counts.user || 0} klientë · ${meta.counts.provider || 0} ofrues`,
            to: '/dashboard/admin/users',
            tone: 'accent',
            featured: true,
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
            label: 'Feedback i ri',
            value: newFeedback,
            hint: newFeedback > 0 ? 'Pret lexim' : 'Të gjitha të lexuara',
            to: '/dashboard/admin/feedback',
            tone: newFeedback > 0 ? 'warn' : 'success',
          },
        ])
        setCharts({
          bar: {
            title: 'Aktiviteti i javës',
            subtitle: 'Kërkesa të reja në platformë',
            items: weekActivitySlices(requests),
            emptyText: 'Ende nuk ka kërkesa në platformë.',
          },
          donut: {
            title: 'Përdorues sipas rolit',
            subtitle: 'Shpërndarja në platformë',
            centerLabel: 'Llogari',
            centerValue: totalUsers,
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
        })
        setActivity(requestsToActivity(requests, '/dashboard/admin/requests'))
        setReminder(
          pendingRoles > 0
            ? {
                title: 'Kërkesa për role',
                text: `${pendingRoles} përdorues presin aprovim roli.`,
                to: '/dashboard/admin/users',
                cta: 'Shiko',
              }
            : newFeedback > 0
              ? {
                  title: 'Feedback i ri',
                  text: `${newFeedback} mesazhe nga përdoruesit.`,
                  to: '/dashboard/admin/feedback',
                  cta: 'Hap',
                }
              : null,
        )
        setNextStep(
          newFeedback > 0
            ? {
                title: 'Lexo feedback-un e ri',
                text: `${newFeedback} mesazhe nga përdoruesit presin në panel.`,
                to: '/dashboard/admin/feedback',
                cta: 'Hap',
              }
            : pendingRoles > 0
              ? {
                  title: 'Shqyrto kërkesat e roleve',
                  text: `${pendingRoles} kërkesa roli janë në pritje.`,
                  to: '/dashboard/admin/users',
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
      .catch((err: unknown) => {
        if (!cancelled) {
          setStats([])
          setCharts(null)
          setActivity([])
          setReminder(null)
          setNextStep(null)
          setError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return (
    <OverviewShell
      role="admin"
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle={ROLE_HINTS.admin}
      actions={[
        { label: 'Përdoruesit', to: '/dashboard/admin/users', variant: 'primary', icon: Users },
        {
          label: 'Feedback',
          to: '/dashboard/admin/feedback',
          variant: 'secondary',
          icon: MessageSquarePlus,
        },
      ]}
      stats={stats}
      statsLoading={loading}
      charts={charts}
      activity={{
        title: 'Kërkesat e fundit',
        subtitle: 'Aktiviteti global',
        items: activity,
        emptyText: 'Ende nuk ka kërkesa në platformë.',
        viewAllTo: '/dashboard/admin/requests',
      }}
      activityLoading={loading}
      reminder={reminder}
      reminderLoading={loading}
      nextStep={loading || error ? null : nextStep}
      error={error}
      onRetry={reload}
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
