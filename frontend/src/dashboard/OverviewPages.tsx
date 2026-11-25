import { collectionSummary, collectionTotal } from '../api/pagination'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, Chip, buttonVariants } from '@heroui/react'
import { ArrowRight, FolderKanban, MessageSquarePlus, Users } from 'lucide-react'
import { fetchAdminUsersMeta, fetchPendingRoleRequests } from '../api/adminUsers'
import { fetchPlatformFeedback } from '../api/feedback'
import { fetchAllRequests, type ServiceRequestItem } from '../api/requests'
import { getErrorMessage } from '../utils/errors'
import { useAuth } from '../auth/AuthContext'
import { ROLE_HINTS, ROLE_LABELS } from './nav'
import { EmptyBlock, RowsSkeleton, SectionHead, StatsStrip, timeGreeting } from './OverviewParts'
import { formatWhen, REQUEST_STATUS } from './requestDisplay'
import './UserOverview.css'
import './DashboardSections.css'
import './AdminDashboard.css'

export { UserOverviewPage } from './UserOverviewPage'
export { ProviderOverviewPage } from './ProviderOverviewPage'
export { CompanyOverviewPage } from './CompanyOverviewPage'

type AdminOverviewData = {
  counts: Awaited<ReturnType<typeof fetchAdminUsersMeta>>['counts']
  requests: ServiceRequestItem[]
  newFeedback: number
  pendingRoles: number
}

export function AdminOverviewPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [data, setData] = useState<AdminOverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((value) => value + 1), [])

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
        setData({
          counts: meta.counts,
          requests,
          newFeedback: collectionSummary(feedback).unread ?? 0,
          pendingRoles: collectionTotal(roleRequests),
        })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(getErrorMessage(err))
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reloadKey])

  const statusCounts = collectionSummary(data?.requests).statusCounts
  const waitingRequests = (statusCounts?.open ?? 0) + (statusCounts?.pending ?? 0) + (statusCounts?.read ?? 0)
  const recent = [...(data?.requests ?? [])]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, 6)
  const queues = [
    { id: 'roles', label: t('auth.roles'), detail: t('admin.overview.awaitingReview'), count: data?.pendingRoles ?? 0, to: '/dashboard/admin/users', icon: Users },
    { id: 'feedback', label: t('dash.feedback'), detail: t('admin.overview.unread'), count: data?.newFeedback ?? 0, to: '/dashboard/admin/feedback', icon: MessageSquarePlus },
    { id: 'requests', label: t('admin.overview.requests'), detail: t('status.pending'), count: waitingRequests, to: '/dashboard/admin/requests', icon: FolderKanban },
  ]
  const totalUsers = data ? Object.values(data.counts).reduce((sum, count) => sum + count, 0) : 0
  const firstName = user?.firstName || user?.name?.split(' ')[0] || ''
  const stats = [
    { label: t('admin.overview.clients'), value: data?.counts.user ?? 0, hint: t('overview.stats.total', { count: totalUsers }), to: '/dashboard/admin/users' },
    { label: t('admin.overview.providers'), value: data?.counts.provider ?? 0, hint: t('admin.overview.experts'), to: '/dashboard/admin/users' },
    { label: t('admin.overview.companies'), value: data?.counts.company ?? 0, hint: t('admin.overview.businesses'), to: '/dashboard/admin/users' },
    { label: t('status.pending'), value: waitingRequests, hint: waitingRequests ? t('overview.stats.activeRequests') : t('admin.overview.none'), to: '/dashboard/admin/requests', highlight: waitingRequests > 0 },
  ]

  return (
    <section className="uo ds ad">
      <header className="uo-head">
        <div className="uo-head-copy">
          <Chip size="sm" variant="soft" color="accent" className="uo-role"><Chip.Label>{t(ROLE_LABELS.admin)}</Chip.Label></Chip>
          <h1>{timeGreeting(new Date().getHours())}{firstName ? `, ${firstName}` : ''}</h1>
          <p>{t(ROLE_HINTS.admin)}</p>
        </div>
        <Link to="/dashboard/admin/users" className={`${buttonVariants({ variant: 'primary' })} uo-primary`}><Users size={16} aria-hidden />{t('dash.users')}</Link>
      </header>

      {error ? (
        <Alert status="danger" className="uo-alert">
          <Alert.Indicator />
          <Alert.Content><Alert.Title>{t('overview.loadError')}</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content>
          <Button size="sm" variant="outline" onPress={reload}>{t('page.retry')}</Button>
        </Alert>
      ) : (
        <>
        <StatsStrip stats={stats} loading={loading} />

        <div className="uo-grid ad-overview-grid">
          <Card className="uo-card">
            <SectionHead title={t('admin.overview.recentRequests')} action={<Link to="/dashboard/admin/requests" className="uo-link">{t('req.all')} <ArrowRight size={14} aria-hidden /></Link>} />
            {loading ? <Card.Content className="uo-card-body"><RowsSkeleton rows={4} /></Card.Content> : recent.length ? (
              <Card.Content className="uo-card-body ad-recent-body">
                <ul className="ad-recent-list" aria-label={t('admin.overview.recentRequests')}>
                  {recent.map((item) => {
                    const date = item.updatedAt || item.createdAt
                    const status = REQUEST_STATUS[item.status] ?? { label: item.status, color: 'default' as const }
                    return <li key={item.id} className="ad-recent-row">
                      <div className="ad-recent-main">
                        <Link to="/dashboard/admin/requests" className="ad-recent-title">{item.serviceTitle || item.need || t('req.request')}</Link>
                        <p className="ad-recent-people">{item.seekerName || t('admin.overview.seeker')} <span aria-hidden>→</span> {item.providerName || t('req.provider')}</p>
                      </div>
                      <div className="ad-recent-end">
                        <Chip size="sm" variant="soft" color={status.color}><Chip.Label>{t(status.label)}</Chip.Label></Chip>
                        <time dateTime={date}>{formatWhen(date)}</time>
                      </div>
                    </li>
                  })}
                </ul>
              </Card.Content>
            ) : <EmptyBlock title={t('req.emptyIn')} text={t('admin.overview.emptyText')} />}
          </Card>

          <aside className="uo-side">
            <Card className="uo-card">
              <SectionHead title={t('admin.overview.toReview')} />
              {loading ? <Card.Content className="uo-card-body"><RowsSkeleton rows={3} /></Card.Content> : (
                <ul className="ad-queues" aria-label={t('admin.overview.toReview')}>
                  {queues.map((item) => {
                    const Icon = item.icon
                    return (
                      <li key={item.id}>
                        <Link to={item.to} className="ad-queue">
                          <span className="ad-queue-icon"><Icon size={16} aria-hidden /></span>
                          <span className="ad-queue-copy">
                            <strong>{item.label}</strong>
                            <span>{item.detail}</span>
                          </span>
                          <span className={`ad-queue-count${item.count > 0 ? ' is-hot' : ''}`}>{item.count}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </aside>
        </div>
        </>
      )}
    </section>
  )
}
