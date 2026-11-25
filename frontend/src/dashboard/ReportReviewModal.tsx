import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Alert, AlertDialog, Button, Chip, Dropdown, Label, Drawer, TextArea, toast } from '@heroui/react'
import { ArrowLeft, MoreHorizontal } from 'lucide-react'
import { fetchUserReport, fetchReportConversation, fetchReportRequest, updateUserReportStatus, type ReportEvidenceMessage, type UserReportItem } from '../api/feedback'
import { updateAdminUser } from '../api/adminUsers'
import { useAuth } from '../auth/AuthContext'
import ProfileAvatar from '../components/ProfileAvatar'
import ConfirmActionDialog from '../components/ConfirmActionDialog'
import { providerPath } from '../utils/publicPaths'
import { getErrorMessage } from '../utils/errors'
import { REPORT_LABELS, reportDate, reportRequestStatus, reportRoleLabel } from './reportDisplay'

const ACCOUNT_LABELS: Record<string, string> = { active: 'status.active', suspended: 'admin.reports.account.suspended', closed: 'admin.reports.account.closed', unavailable: 'admin.reports.account.unavailable' }
export default function ReportReviewModal({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [report, setReport] = useState<UserReportItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [decisionOpen, setDecisionOpen] = useState(false)
  const [decision, setDecision] = useState<'resolved' | 'rejected'>('resolved')
  const [note, setNote] = useState('')
  const [moderation, setModeration] = useState<'suspended' | 'closed' | null>(null)
  const [messages, setMessages] = useState<ReportEvidenceMessage[] | null>(null)
  const [hasOlder, setHasOlder] = useState(false)
  const [request, setRequest] = useState<{ title: string; status: string; details: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    setReport(null); setError(''); setMessages(null); setRequest(null); setDecisionOpen(false); setModeration(null); setNote('')
    if (!id) return
    setLoading(true)
    void fetchUserReport(id).then(value => { if (!cancelled) setReport(value) }).catch(error => { if (!cancelled) setError(getErrorMessage(error)) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])
  async function decide() {
    if (!report) return
    setPending(true)
    try { const value = await updateUserReportStatus(report.id, decision, note); setReport(current => ({ ...value, requestContext: current?.requestContext ?? value.requestContext })); setDecisionOpen(false); onChanged(); toast.success(t('admin.reports.decisionSaved')) }
    catch (error) { toast.danger(getErrorMessage(error)) }
    finally { setPending(false) }
  }
  async function moderate() {
    if (!report?.reported.uid || !moderation) return
    setPending(true)
    try {
      await updateAdminUser(report.reported.uid, { accountStatus: moderation })
      setReport(await fetchUserReport(report.id)); setModeration(null); onChanged(); toast.success(t('admin.reports.accountUpdated'))
    } catch (error) { toast.danger(getErrorMessage(error)) }
    finally { setPending(false) }
  }
  async function investigate(kind: 'conversation' | 'request', older = false) {
    if (!report) return
    setPending(true)
    try {
      if (kind === 'request') setRequest(await fetchReportRequest(report.id))
      else {
        const result = await fetchReportConversation(report.id, older ? messages?.[0]?.createdAt : undefined, older ? messages?.[0]?.id : undefined)
        setMessages(current => older && current ? [...result.messages.filter(message => !current.some(old => old.id === message.id)), ...current] : result.messages)
        setHasOlder(result.pagination.total > result.messages.length)
      }
    } catch (error) { toast.danger(getErrorMessage(error)) }
    finally { setPending(false) }
  }
  const canModerate = report?.status === 'reviewing' && report.reported.uid && report.reported.uid !== user?.uid && !report.reported.isAdmin && ['active', 'suspended'].includes(report.reported.accountStatus)
  return <>
    <Drawer isOpen={!!id} onOpenChange={open => { if (!open && !pending) onClose() }}>
      <Drawer.Backdrop isDismissable={!pending} isKeyboardDismissDisabled={pending}>
        <Drawer.Content placement="right"><Drawer.Dialog aria-label={t('admin.reports.heading')} className="report-review">
          <Drawer.Header className="report-review-head"><Button variant="ghost" size="sm" isIconOnly aria-label={t('admin.reports.back')} isDisabled={pending} onPress={onClose}><ArrowLeft size={19} /></Button><Drawer.Heading>{t('admin.reports.heading')}</Drawer.Heading><div className="report-header-actions">{canModerate && <Dropdown><Dropdown.Trigger><Button variant="ghost" size="sm" isIconOnly aria-label={t('admin.reports.accountActions')} isDisabled={pending}><MoreHorizontal size={20} /></Button></Dropdown.Trigger><Dropdown.Popover placement="bottom end"><Dropdown.Menu aria-label={t('admin.reports.moderationMenu')} onAction={key => setModeration(key as 'suspended' | 'closed')}>
                  {report.reported.accountStatus === 'active' && <Dropdown.Item id="suspended" textValue={t('admin.reports.suspendUser')}><Label>{t('admin.reports.suspendUser')}</Label></Dropdown.Item>}
                  <Dropdown.Item id="closed" textValue={t('admin.reports.closeAccount')}><Label>{t('admin.reports.closeAccount')}</Label></Dropdown.Item>
                </Dropdown.Menu></Dropdown.Popover></Dropdown>}</div></Drawer.Header>
          <Drawer.Body className="report-review-body">
            {loading && <p role="status">{t('admin.reports.loadingOne')}</p>}
            {error && <Alert status="danger"><Alert.Content><Alert.Title>{t('admin.reports.loadErrorOne')}</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
            {report && <>
              <section className="report-section"><div className="report-section-title"><h2>{t('admin.reports.reason')}</h2><Chip size="sm" variant="soft" color={report.status === 'reviewing' ? 'warning' : report.status === 'resolved' ? 'success' : 'default'}><Chip.Label>{t(REPORT_LABELS[report.status])}</Chip.Label></Chip></div><p className="report-main-reason">{report.reason}</p><time dateTime={report.createdAt}>{reportDate(report.createdAt)}</time></section>
              <div className="report-people">
                <section className="report-section"><div className="report-section-title"><h2>{t('admin.reports.reportedUser')}</h2></div>
                  <div className="moderation-person"><ProfileAvatar src={report.reported.profilePhoto} seed={report.reported.uid || report.reported.name} size={40} alt="" /><div><strong>{report.reported.name}</strong><span>{reportRoleLabel(report.reported.role)} · {t(ACCOUNT_LABELS[report.reported.accountStatus] || ACCOUNT_LABELS.unavailable)}</span></div></div>
                  {report.reported.headline && <p>{report.reported.headline}</p>}{report.reported.bio && <p>{report.reported.bio}</p>}
                  {report.reported.uid && <Link className="uo-link" to={report.reported.publicProfile ? providerPath({ uid: report.reported.uid, name: report.reported.name }) : `/dashboard/admin/users?q=${encodeURIComponent(report.reported.email || report.reported.name)}`}>{t('admin.reports.viewProfile')}</Link>}
                </section>
                <section className="report-section"><h2>{t('admin.reports.reportedByTitle')}</h2><div className="moderation-person"><ProfileAvatar src={report.reporter.profilePhoto} seed={report.reporter.name} size={36} alt="" /><div><strong>{report.reporter.name}</strong><span>{reportRoleLabel(report.reporter.role)}</span></div></div></section>
              </div>
              <section className="report-section"><h2>{t('dash.context')}</h2>
                {report.serviceTitle && <p><strong>{t('admin.reports.serviceLabel')}</strong> {report.serviceTitle}</p>}
                {report.requestContext ? <p><strong>{t('admin.reports.requestLabel')}</strong> {report.requestContext.title !== report.serviceTitle && `${report.requestContext.title} · `}{reportRequestStatus(report.requestContext.status)}</p> : <p>{t('admin.reports.noLinkedRequest')}</p>}
                <div className="report-context-actions">{report.hasConversation && <Button size="sm" variant="outline" isDisabled={pending} onPress={() => void investigate('conversation')}>{t('admin.reports.viewConversation')}</Button>}{report.requestContext && <Button size="sm" variant="outline" isDisabled={pending} onPress={() => void investigate('request')}>{t('admin.reports.viewRequest')}</Button>}</div>
                {messages && <div className="report-evidence"><div className="report-section-title"><h3>{t('admin.reports.conversationReview')}</h3>{hasOlder && <Button size="sm" variant="ghost" isDisabled={pending} onPress={() => void investigate('conversation', true)}>{t('admin.reports.olderMessages')}</Button>}</div>{!messages.length && <p>{t('admin.reports.noMessages')}</p>}<ol>{messages.map(message => <li key={message.id}><div><strong>{message.author}</strong><time dateTime={message.createdAt}>{reportDate(message.createdAt)}</time></div><p>{message.body}</p></li>)}</ol></div>}
                {request && <div className="report-evidence"><h3>{request.title}</h3><span>{reportRequestStatus(request.status)}</span><p>{request.details}</p></div>}
              </section>
              {report.resolution && <section className="report-section report-resolution"><h2>{t('admin.reports.decisionHistory')}</h2><dl><div><dt>{t('admin.reports.decision')}</dt><dd>{t(REPORT_LABELS[report.status])}</dd></div><div><dt>{t('admin.reports.administrator')}</dt><dd>{report.resolution.admin}</dd></div><div><dt>{t('admin.reports.columns.date')}</dt><dd>{report.resolution.at ? reportDate(report.resolution.at) : t('admin.reports.notRecordedLegacy')}</dd></div><div><dt>{t('admin.reports.adminNote')}</dt><dd>{report.resolution.note || t('admin.reports.notRecorded')}</dd></div></dl></section>}
            </>}
          </Drawer.Body>
          <Drawer.Footer className="report-review-foot">{report?.status === 'reviewing' && <Button variant="primary" isDisabled={pending} onPress={() => setDecisionOpen(true)}>{t('admin.reports.decide')}</Button>}</Drawer.Footer>
        </Drawer.Dialog></Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
    <AlertDialog isOpen={decisionOpen} onOpenChange={open => { if (!open && !pending) setDecisionOpen(false) }}><AlertDialog.Backdrop isDismissable={false} isKeyboardDismissDisabled><AlertDialog.Container size="sm" placement="center"><AlertDialog.Dialog className="report-decision-dialog">
      <AlertDialog.Header><AlertDialog.Heading>{t('admin.reports.decisionQuestion')}</AlertDialog.Heading></AlertDialog.Header>
      <AlertDialog.Body><div className="report-decisions"><Button variant="outline" aria-pressed={decision === 'resolved'} onPress={() => setDecision('resolved')} isDisabled={pending}>{t('admin.reports.resolve')}</Button><Button variant="outline" aria-pressed={decision === 'rejected'} onPress={() => setDecision('rejected')} isDisabled={pending}>{t('admin.reports.reject')}</Button></div><p>{decision === 'resolved' ? t('admin.reports.resolveHint') : t('admin.reports.rejectHint')}</p><label className="report-note-label">{t('admin.reports.internalNote')}<TextArea aria-label={t('admin.reports.adminNote')} value={note} onChange={event => setNote(event.target.value)} maxLength={1000} disabled={pending} /></label></AlertDialog.Body>
      <AlertDialog.Footer><Button variant="ghost" isDisabled={pending} onPress={() => setDecisionOpen(false)}>{t('notifications.cancel')}</Button><Button variant="primary" isPending={pending} isDisabled={pending || note.trim().length < 5} onPress={() => void decide()}>{t('admin.reports.confirmDecision')}</Button></AlertDialog.Footer>
    </AlertDialog.Dialog></AlertDialog.Container></AlertDialog.Backdrop></AlertDialog>
    <ConfirmActionDialog isOpen={!!moderation} pending={pending} title={moderation === 'suspended' ? t('admin.reports.suspendTitle') : t('admin.reports.closeTitle')} description={t(moderation === 'suspended' ? 'admin.reports.suspendDescription' : 'admin.reports.closeDescription', { name: report?.reported.name || t('admin.reports.userFallback') })} confirmLabel={moderation === 'suspended' ? t('admin.reports.suspendConfirm') : t('admin.reports.closeConfirm')} onClose={() => setModeration(null)} onConfirm={() => void moderate()} />
  </>
}
