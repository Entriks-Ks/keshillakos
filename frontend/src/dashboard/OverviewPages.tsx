import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, Chip, buttonVariants } from '@heroui/react'
import { ArrowRight, FolderKanban, MessageSquarePlus, Users } from 'lucide-react'
import { fetchAdminUsersMeta, fetchPendingRoleRequests } from '../api/adminUsers'
import { fetchPlatformFeedback } from '../api/feedback'
import { fetchAllRequests, type ServiceRequestItem } from '../api/requests'
import { getErrorMessage } from '../utils/errors'
import { ROLE_HINTS, ROLE_LABELS } from './nav'
import { EmptyBlock, RowsSkeleton, SectionHead } from './OverviewParts'
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
          newFeedback: feedback.filter((item) => item.status === 'new').length,
          pendingRoles: roleRequests.length,
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

  const pendingRequests = data?.requests.filter((item) => item.status === 'pending').length ?? 0
  const recent = [...(data?.requests ?? [])]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, 5)
  const attention = [
    { label: 'Kërkesa për role', detail: 'Presin shqyrtim', count: data?.pendingRoles ?? 0, to: '/dashboard/admin/users', icon: Users },
    { label: 'Feedback i ri', detail: 'Mesazhe të palexuara', count: data?.newFeedback ?? 0, to: '/dashboard/admin/feedback', icon: MessageSquarePlus },
    { label: 'Kërkesa në pritje', detail: 'Në platformë', count: pendingRequests, to: '/dashboard/admin/requests', icon: FolderKanban },
  ].filter((item) => item.count > 0)
  const totalUsers = data ? Object.values(data.counts).reduce((sum, count) => sum + count, 0) : 0

  return (
    <section className="uo ds ad">
      <header className="uo-head">
        <div className="uo-head-copy">
          <Chip size="sm" variant="soft" color="accent" className="uo-role"><Chip.Label>{ROLE_LABELS.admin}</Chip.Label></Chip>
          <h1>Përmbledhje</h1>
          <p>{ROLE_HINTS.admin}</p>
        </div>
        <Link to="/dashboard/admin/users" className={`${buttonVariants({ variant: 'primary' })} uo-primary`}><Users size={16} aria-hidden />Përdoruesit</Link>
      </header>

      {error ? (
        <Alert status="danger" className="uo-alert">
          <Alert.Indicator />
          <Alert.Content><Alert.Title>Nuk u ngarkuan të dhënat</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content>
          <Button size="sm" variant="outline" onPress={reload}>Provo përsëri</Button>
        </Alert>
      ) : (
        <div className="uo-grid ad-overview-grid">
          <Card className="uo-card">
            <SectionHead title="Kërkesat e fundit" action={<Link to="/dashboard/admin/requests" className="uo-link">Shiko të gjitha <ArrowRight size={14} aria-hidden /></Link>} />
            {loading ? <Card.Content className="uo-card-body"><RowsSkeleton rows={4} /></Card.Content> : recent.length ? (
              <Card.Content className="uo-card-body ad-recent-body">
                <ul className="ad-recent-list" aria-label="Kërkesat e fundit">
                  {recent.map((item) => {
                    const date = item.updatedAt || item.createdAt
                    const status = REQUEST_STATUS[item.status] ?? { label: item.status, color: 'default' as const }
                    return <li key={item.id} className="ad-recent-row">
                      <div className="ad-recent-main">
                        <Link to="/dashboard/admin/requests" className="ad-recent-title">{item.serviceTitle || item.need || 'Kërkesë'}</Link>
                        {item.serviceTitle && item.need ? <p className="ad-recent-detail">{item.need}</p> : item.location ? <p className="ad-recent-detail">{item.location}</p> : null}
                        <p className="ad-recent-people">{item.seekerName || 'Kërkuesi'} <span aria-hidden>→</span> {item.providerName || 'Ofruesi'}</p>
                      </div>
                      <div className="ad-recent-end">
                        <Chip size="sm" variant="soft" color={status.color}><Chip.Label>{status.label}</Chip.Label></Chip>
                        <time dateTime={date}>{formatWhen(date)}</time>
                      </div>
                    </li>
                  })}
                </ul>
              </Card.Content>
            ) : <EmptyBlock title="Ende nuk ka kërkesa" text="Kërkesat e platformës do të shfaqen këtu." />}
          </Card>

          <aside className="uo-side">
            <Card className="uo-card">
              <SectionHead title="Administrimi" meta={!loading && data ? <span className="uo-card-meta">{totalUsers} përdorues</span> : null} />
              <Card.Content className="uo-card-body">
                {loading ? <RowsSkeleton rows={1} /> : data ? <p className="ad-users-summary">{data.counts.user || 0} klientë · {data.counts.provider || 0} ofrues · {data.counts.company || 0} kompani · {data.counts.admin || 0} admin</p> : null}
              </Card.Content>
              {loading ? <div className="ad-attention-loading"><RowsSkeleton rows={3} /></div> : attention.length ? (
                <ul className="uo-rows ad-attention-list" aria-label="Për t’u shqyrtuar">
                  {attention.map((item) => {
                    const Icon = item.icon
                    return <li key={item.label}><Link to={item.to} className="uo-row"><span className="uo-row-icon"><Icon size={16} aria-hidden /></span><span className="uo-row-copy"><strong>{item.label}</strong><span>{item.detail}</span></span><Chip size="sm" variant="soft" color="accent"><Chip.Label>{item.count}</Chip.Label></Chip></Link></li>
                  })}
                </ul>
              ) : <p className="ad-attention-empty">Nuk ka kërkesa ose feedback të ri për shqyrtim.</p>}
              <Card.Footer className="ad-overview-actions">
                <Link to="/dashboard/admin/requests" className="uo-link">Të gjitha kërkesat <ArrowRight size={14} aria-hidden /></Link>
                <Link to="/dashboard/admin/feedback" className="uo-link">Feedback <ArrowRight size={14} aria-hidden /></Link>
              </Card.Footer>
            </Card>
          </aside>
        </div>
      )}
    </section>
  )
}
