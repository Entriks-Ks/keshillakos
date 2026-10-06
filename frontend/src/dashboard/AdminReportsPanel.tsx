import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, Chip, toast } from '@heroui/react'
import { fetchUserReports, fetchUserReport, updateUserReportStatus, type UserReportItem } from '../api/feedback'
import { usePagination } from '../hooks/usePagination'
import KeshillaPagination from '../components/KeshillaPagination'
import ProfileAvatar from '../components/ProfileAvatar'
import ConfirmActionDialog from '../components/ConfirmActionDialog'
import { getErrorMessage } from '../utils/errors'
import { EmptyBlock, RowsSkeleton, SectionHead } from './OverviewParts'
import { REQUEST_STATUS } from './requestDisplay'
import './UserOverview.css'
import './DashboardSections.css'
import './AdminDashboard.css'

const STATUS = { new: 'I ri', reviewing: 'Në shqyrtim', resolved: 'I trajtuar', dismissed: 'I mbyllur pa veprim' }
export default function AdminReportsPanel() {
  const [items, setItems] = useState<UserReportItem[]>([])
  const { page, setPage, pagination, receivePagination } = usePagination()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [dismiss, setDismiss] = useState<UserReportItem | null>(null)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchUserReports({ page, limit: 20 }).then(result => {
      if (!cancelled) { setItems(result); receivePagination(result.pagination); setError('') }
    }).catch(error => { if (!cancelled) setError(getErrorMessage(error)) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page])
  function patch(report: UserReportItem) { setItems(current => current.map(item => item.id === report.id ? { ...item, ...report } : item)) }
  async function update(item: UserReportItem, status: 'reviewing' | 'resolved' | 'dismissed') {
    setBusy(item.id)
    try { patch(await updateUserReportStatus(item.id, status)); setDismiss(null); toast.success('Statusi i raportimit u përditësua') }
    catch (error) { toast.danger(getErrorMessage(error)) }
    finally { setBusy('') }
  }
  async function context(item: UserReportItem) {
    setBusy(item.id)
    try { patch(await fetchUserReport(item.id)) }
    catch (error) { toast.danger(getErrorMessage(error)) }
    finally { setBusy('') }
  }
  return <section className="uo ds ad">
    <header className="uo-head"><div className="uo-head-copy"><h1>Raportime</h1><p>Raportimet e përdoruesve për sjellje të papërshtatshme në biseda.</p></div></header>
    {error && <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Title>Raportimet nuk u ngarkuan</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
    <Card className="uo-card"><SectionHead title="Raportimet e përdoruesve" />
      {loading ? <Card.Content className="uo-card-body"><RowsSkeleton rows={4} /></Card.Content> : !error && !items.length ? <EmptyBlock title="Ende nuk ka raportime" text="Raportimet e dërguara nga bisedat shfaqen këtu." /> : null}
      {!loading && !!items.length && <ul className="ad-feedback-list">{items.map(item => <li key={item.id}>
        <ProfileAvatar src={item.reported.profilePhoto} seed={item.id} size={40} alt="" />
        <div className="ad-feedback-main">
          <div className="ad-feedback-head"><strong>{item.reported.name}</strong><Chip size="sm" variant="soft" color={item.status === 'new' ? 'accent' : 'default'}><Chip.Label>{STATUS[item.status]}</Chip.Label></Chip></div>
          <span>{item.reported.role} · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })}</time></span>
          <p><strong>Raportuar nga:</strong> {item.reporter.name}</p>
          <p><strong>Arsyeja:</strong> {item.reason}</p>
          {item.serviceTitle && <p><strong>Shërbimi:</strong> {item.serviceTitle}</p>}
          {item.requestContext && <p><strong>Kërkesa:</strong> {item.requestContext.title} · {REQUEST_STATUS[item.requestContext.status as keyof typeof REQUEST_STATUS]?.label || (item.requestContext.status === 'cancelled' ? 'Anuluar' : 'E hapur')}</p>}
          {item.requestContext === null && <p>Nuk ka kërkesë të lidhur të konfirmuar.</p>}
          {item.adminNote && <p><strong>Shënim administrativ:</strong> {item.adminNote}</p>}
          <div className="ad-feedback-actions">
            {item.requestContext === undefined && <Button size="sm" variant="outline" isDisabled={!!busy} isPending={busy === item.id} onPress={() => void context(item)}>Shiko kontekstin</Button>}
            <Link to="/dashboard/admin/users" className="uo-link">Menaxho përdoruesit</Link>
            {item.status === 'new' && <Button size="sm" variant="outline" isDisabled={!!busy} onPress={() => void update(item, 'reviewing')}>Fillo shqyrtimin</Button>}
            {(item.status === 'new' || item.status === 'reviewing') && <><Button size="sm" variant="outline" isDisabled={!!busy} onPress={() => void update(item, 'resolved')}>Shëno si të trajtuar</Button><Button size="sm" variant="ghost" isDisabled={!!busy} onPress={() => setDismiss(item)}>Mbyll pa veprim</Button></>}
          </div>
        </div>
      </li>)}</ul>}
    </Card>
    {!loading && !error && <KeshillaPagination pagination={pagination} onPageChange={setPage} />}
    <ConfirmActionDialog isOpen={!!dismiss} pending={!!busy} title="Mbyll raportimin pa veprim?" description="Raportimi ruhet në historik. Kjo nuk ndryshon llogarinë ose kërkesat e përdoruesit." confirmLabel="Mbyll raportimin" onClose={() => setDismiss(null)} onConfirm={() => { if (dismiss) void update(dismiss, 'dismissed') }} />
  </section>
}
