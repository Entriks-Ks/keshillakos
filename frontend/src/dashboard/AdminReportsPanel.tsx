import { useEffect, useState } from 'react'
import { Alert, Button, Chip } from '@heroui/react'
import { fetchUserReports, type ReportSummary, type UserReportItem } from '../api/feedback'
import { usePagination } from '../hooks/usePagination'
import KeshillaPagination from '../components/KeshillaPagination'
import ProfileAvatar from '../components/ProfileAvatar'
import { getErrorMessage } from '../utils/errors'
import { REPORT_LABELS, reportListDate, reportRequestStatus } from './reportDisplay'
import ReportReviewModal from './ReportReviewModal'
import './UserOverview.css'
import './AdminReports.css'

export default function AdminReportsPanel() {
  const [items, setItems] = useState<UserReportItem[]>([])
  const [summary, setSummary] = useState<ReportSummary>({ total: 0, reviewing: 0, resolved: 0, rejected: 0 })
  const [filter, setFilter] = useState('reviewing')
  const [sort, setSort] = useState('newest')
  const { page, setPage, pagination, receivePagination } = usePagination(`${filter}:${sort}`)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchUserReports({ page, limit: 20, status: filter, sort }).then(result => {
      if (!cancelled) { setItems(result); setSummary(result.reportSummary); receivePagination(result.pagination); setError('') }
    }).catch(error => { if (!cancelled) setError(getErrorMessage(error)) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, filter, sort, revision])
  return <section className="uo moderation">
    <header className="uo-head"><div className="uo-head-copy"><h1>Raportimet</h1><p>Shqyrto dhe menaxho raportimet e përdoruesve.</p></div><span className="moderation-pending">{summary.reviewing} në shqyrtim</span></header>
    <div className="moderation-summary" aria-label="Filtro raportimet sipas statusit">{[
      { key: 'all', label: 'Të gjitha', count: summary.total }, { key: 'reviewing', label: 'Në shqyrtim', count: summary.reviewing },
      { key: 'resolved', label: 'Të zgjidhura', count: summary.resolved }, { key: 'rejected', label: 'Të refuzuara', count: summary.rejected },
    ].map(item => <Button key={item.key} variant="ghost" aria-pressed={filter === item.key} className={filter === item.key ? 'is-selected' : ''} onPress={() => setFilter(item.key)}>{item.label}<span>{item.count}</span></Button>)}</div>
    <div className="moderation-toolbar"><span>{pagination.total} raportime</span><label>Renditja<select value={sort} onChange={event => setSort(event.target.value)}><option value="priority">Në shqyrtim së pari</option><option value="newest">Më të rejat</option><option value="oldest">Më të vjetrat</option></select></label></div>
    {error && <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Title>Raportimet nuk u ngarkuan</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
    <div className="moderation-inbox">
      <div className="moderation-columns" aria-hidden="true"><span>Përdoruesi</span><span>Raporti</span><span>Konteksti</span><span>Data</span><span>Statusi</span><span /></div>
      {loading ? <p className="moderation-empty" role="status">Duke ngarkuar raportimet…</p> : !error && !items.length ? <div className="moderation-empty"><strong>Nuk ka raportime</strong><p>Aktualisht nuk ka raportime për këtë kategori.</p></div> : null}
      {!loading && <ul className="moderation-rows">{items.map(item => <li key={item.id} className="moderation-row" onClick={() => setSelected(item.id)}>
        <div className="moderation-person"><ProfileAvatar src={item.reported.profilePhoto} seed={item.reported.uid || item.reported.name} size={36} alt="" /><div><strong>{item.reported.name}</strong><span>{item.reported.role}</span></div></div>
        <div className="moderation-reason"><strong title={item.reason}>{item.reason}</strong><span>Raportuar nga {item.reporter.name}</span><time className="moderation-mobile-date" dateTime={item.createdAt}>{reportListDate(item.createdAt)}</time></div>
        <div className="moderation-context"><span>{item.serviceTitle || item.requestContext?.title || 'Pa kërkesë'}</span>{item.requestContext && <small>{reportRequestStatus(item.requestContext.status)}</small>}</div>
        <time className="moderation-date" dateTime={item.createdAt}>{reportListDate(item.createdAt)}</time>
        <div className="moderation-status"><Chip size="sm" variant="soft" color={item.status === 'reviewing' ? 'warning' : item.status === 'resolved' ? 'success' : 'default'}><Chip.Label>{REPORT_LABELS[item.status]}</Chip.Label></Chip></div>
        <Button size="sm" variant="ghost" onPress={() => setSelected(item.id)}>Shqyrto →</Button>
      </li>)}</ul>}
    </div>
    {!loading && !error && <KeshillaPagination pagination={pagination} onPageChange={setPage} />}
    <ReportReviewModal id={selected} onClose={() => setSelected(null)} onChanged={() => setRevision(value => value + 1)} />
  </section>
}
