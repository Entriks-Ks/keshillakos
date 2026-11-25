import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Chip } from '@heroui/react'
import { fetchUserReports, type ReportSummary, type UserReportItem } from '../api/feedback'
import { usePagination } from '../hooks/usePagination'
import KeshillaPagination from '../components/KeshillaPagination'
import ProfileAvatar from '../components/ProfileAvatar'
import { getErrorMessage } from '../utils/errors'
import { REPORT_LABELS, reportListDate, reportRequestStatus, reportRoleLabel } from './reportDisplay'
import ReportReviewModal from './ReportReviewModal'
import './UserOverview.css'
import './AdminReports.css'

export default function AdminReportsPanel() {
  const { t } = useTranslation()
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
    <header className="uo-head"><div className="uo-head-copy"><h1>{t('admin.reports.title')}</h1><p>{t('admin.reports.lead')}</p></div><span className="moderation-pending">{t('admin.reports.reviewingCount', { count: summary.reviewing })}</span></header>
    <div className="moderation-summary" aria-label={t('admin.reports.filterAria')}>{[
      { key: 'all', label: t('req.all'), count: summary.total }, { key: 'reviewing', label: t('admin.reports.filters.reviewing'), count: summary.reviewing },
      { key: 'resolved', label: t('admin.reports.filters.resolved'), count: summary.resolved }, { key: 'rejected', label: t('admin.reports.filters.rejected'), count: summary.rejected },
    ].map(item => <Button key={item.key} variant="ghost" aria-pressed={filter === item.key} className={filter === item.key ? 'is-selected' : ''} onPress={() => setFilter(item.key)}>{item.label}<span>{item.count}</span></Button>)}</div>
    <div className="moderation-toolbar"><span>{t('admin.reports.count', { count: pagination.total })}</span><label>{t('admin.reports.sort')}<select value={sort} onChange={event => setSort(event.target.value)}><option value="priority">{t('admin.reports.sortPriority')}</option><option value="newest">{t('admin.reports.sortNewest')}</option><option value="oldest">{t('admin.reports.sortOldest')}</option></select></label></div>
    {error && <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Title>{t('admin.reports.loadError')}</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
    <div className="moderation-inbox">
      <div className="moderation-columns" aria-hidden="true"><span>{t('admin.reports.columns.user')}</span><span>{t('admin.reports.columns.report')}</span><span>{t('dash.context')}</span><span>{t('admin.reports.columns.date')}</span><span>{t('req.statusLine')}</span><span /></div>
      {loading ? <p className="moderation-empty" role="status">{t('admin.reports.loading')}</p> : !error && !items.length ? <div className="moderation-empty"><strong>{t('admin.reports.emptyTitle')}</strong><p>{t('admin.reports.emptyText')}</p></div> : null}
      {!loading && <ul className="moderation-rows">{items.map(item => <li key={item.id} className="moderation-row" onClick={() => setSelected(item.id)}>
        <div className="moderation-person"><ProfileAvatar src={item.reported.profilePhoto} seed={item.reported.uid || item.reported.name} size={36} alt="" /><div><strong>{item.reported.name}</strong><span>{reportRoleLabel(item.reported.role)}</span></div></div>
        <div className="moderation-reason"><strong title={item.reason}>{item.reason}</strong><span>{t('admin.reports.reportedBy', { name: item.reporter.name })}</span><time className="moderation-mobile-date" dateTime={item.createdAt}>{reportListDate(item.createdAt)}</time></div>
        <div className="moderation-context"><span>{item.serviceTitle || item.requestContext?.title || t('admin.reports.noRequest')}</span>{item.requestContext && <small>{reportRequestStatus(item.requestContext.status)}</small>}</div>
        <time className="moderation-date" dateTime={item.createdAt}>{reportListDate(item.createdAt)}</time>
        <div className="moderation-status"><Chip size="sm" variant="soft" color={item.status === 'reviewing' ? 'warning' : item.status === 'resolved' ? 'success' : 'default'}><Chip.Label>{t(REPORT_LABELS[item.status])}</Chip.Label></Chip></div>
        <Button size="sm" variant="ghost" onPress={() => setSelected(item.id)}>{t('admin.reports.review')}</Button>
      </li>)}</ul>}
    </div>
    {!loading && !error && <KeshillaPagination pagination={pagination} onPageChange={setPage} />}
    <ReportReviewModal id={selected} onClose={() => setSelected(null)} onChanged={() => setRevision(value => value + 1)} />
  </section>
}
