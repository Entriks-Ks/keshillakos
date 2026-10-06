import { useEffect, useState } from 'react'
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
import { REPORT_LABELS, reportDate, reportRequestStatus } from './reportDisplay'

const ACCOUNT_LABELS: Record<string, string> = { active: 'Aktive', suspended: 'E kufizuar', closed: 'E çaktivizuar', unavailable: 'E padisponueshme' }
export default function ReportReviewModal({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
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
    try { const value = await updateUserReportStatus(report.id, decision, note); setReport(current => ({ ...value, requestContext: current?.requestContext ?? value.requestContext })); setDecisionOpen(false); onChanged(); toast.success('Vendimi u ruajt në historikun e raportimit') }
    catch (error) { toast.danger(getErrorMessage(error)) }
    finally { setPending(false) }
  }
  async function moderate() {
    if (!report?.reported.uid || !moderation) return
    setPending(true)
    try {
      await updateAdminUser(report.reported.uid, { accountStatus: moderation })
      setReport(await fetchUserReport(report.id)); setModeration(null); onChanged(); toast.success('Statusi i llogarisë u përditësua')
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
        <Drawer.Content placement="right"><Drawer.Dialog aria-label="Raportimi" className="report-review">
          <Drawer.Header className="report-review-head"><Button variant="ghost" size="sm" isIconOnly aria-label="Kthehu te raportimet" isDisabled={pending} onPress={onClose}><ArrowLeft size={19} /></Button><Drawer.Heading>Raportimi</Drawer.Heading><div className="report-header-actions">{canModerate && <Dropdown><Dropdown.Trigger><Button variant="ghost" size="sm" isIconOnly aria-label="Veprimet mbi llogarinë" isDisabled={pending}><MoreHorizontal size={20} /></Button></Dropdown.Trigger><Dropdown.Popover placement="bottom end"><Dropdown.Menu aria-label="Moderimi i llogarisë" onAction={key => setModeration(key as 'suspended' | 'closed')}>
                  {report.reported.accountStatus === 'active' && <Dropdown.Item id="suspended" textValue="Kufizo përdoruesin"><Label>Kufizo përdoruesin</Label></Dropdown.Item>}
                  <Dropdown.Item id="closed" textValue="Çaktivizo llogarinë"><Label>Çaktivizo llogarinë</Label></Dropdown.Item>
                </Dropdown.Menu></Dropdown.Popover></Dropdown>}</div></Drawer.Header>
          <Drawer.Body className="report-review-body">
            {loading && <p role="status">Duke ngarkuar raportimin…</p>}
            {error && <Alert status="danger"><Alert.Content><Alert.Title>Raportimi nuk u ngarkua</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
            {report && <>
              <section className="report-section"><div className="report-section-title"><h2>Arsyeja</h2><Chip size="sm" variant="soft" color={report.status === 'reviewing' ? 'warning' : report.status === 'resolved' ? 'success' : 'default'}><Chip.Label>{REPORT_LABELS[report.status]}</Chip.Label></Chip></div><p className="report-main-reason">{report.reason}</p><time dateTime={report.createdAt}>{reportDate(report.createdAt)}</time></section>
              <div className="report-people">
                <section className="report-section"><div className="report-section-title"><h2>Përdoruesi i raportuar</h2></div>
                  <div className="moderation-person"><ProfileAvatar src={report.reported.profilePhoto} seed={report.reported.uid || report.reported.name} size={40} alt="" /><div><strong>{report.reported.name}</strong><span>{report.reported.role} · {ACCOUNT_LABELS[report.reported.accountStatus] || 'E padisponueshme'}</span></div></div>
                  {report.reported.headline && <p>{report.reported.headline}</p>}{report.reported.bio && <p>{report.reported.bio}</p>}
                  {report.reported.uid && <Link className="uo-link" to={report.reported.publicProfile ? providerPath({ uid: report.reported.uid, name: report.reported.name }) : `/dashboard/admin/users?q=${encodeURIComponent(report.reported.email || report.reported.name)}`}>Shiko profilin</Link>}
                </section>
                <section className="report-section"><h2>Raportuar nga</h2><div className="moderation-person"><ProfileAvatar src={report.reporter.profilePhoto} seed={report.reporter.name} size={36} alt="" /><div><strong>{report.reporter.name}</strong><span>{report.reporter.role}</span></div></div></section>
              </div>
              <section className="report-section"><h2>Konteksti</h2>
                {report.serviceTitle && <p><strong>Shërbimi:</strong> {report.serviceTitle}</p>}
                {report.requestContext ? <p><strong>Kërkesa:</strong> {report.requestContext.title !== report.serviceTitle && `${report.requestContext.title} · `}{reportRequestStatus(report.requestContext.status)}</p> : <p>Nuk ka kërkesë të lidhur.</p>}
                <div className="report-context-actions">{report.hasConversation && <Button size="sm" variant="outline" isDisabled={pending} onPress={() => void investigate('conversation')}>Shiko bisedën</Button>}{report.requestContext && <Button size="sm" variant="outline" isDisabled={pending} onPress={() => void investigate('request')}>Shiko kërkesën</Button>}</div>
                {messages && <div className="report-evidence"><div className="report-section-title"><h3>Biseda · vetëm për shqyrtim</h3>{hasOlder && <Button size="sm" variant="ghost" isDisabled={pending} onPress={() => void investigate('conversation', true)}>Mesazhe më të hershme</Button>}</div>{!messages.length && <p>Biseda nuk ka mesazhe.</p>}<ol>{messages.map(message => <li key={message.id}><div><strong>{message.author}</strong><time dateTime={message.createdAt}>{reportDate(message.createdAt)}</time></div><p>{message.body}</p></li>)}</ol></div>}
                {request && <div className="report-evidence"><h3>{request.title}</h3><span>{reportRequestStatus(request.status)}</span><p>{request.details}</p></div>}
              </section>
              {report.resolution && <section className="report-section report-resolution"><h2>Historiku i vendimit</h2><dl><div><dt>Vendimi</dt><dd>{REPORT_LABELS[report.status]}</dd></div><div><dt>Administratori</dt><dd>{report.resolution.admin}</dd></div><div><dt>Data</dt><dd>{report.resolution.at ? reportDate(report.resolution.at) : 'Nuk është regjistruar për këtë raportim të mëparshëm'}</dd></div><div><dt>Shënimi administrativ</dt><dd>{report.resolution.note || 'Nuk është regjistruar'}</dd></div></dl></section>}
            </>}
          </Drawer.Body>
          <Drawer.Footer className="report-review-foot">{report?.status === 'reviewing' && <Button variant="primary" isDisabled={pending} onPress={() => setDecisionOpen(true)}>Merr vendim</Button>}</Drawer.Footer>
        </Drawer.Dialog></Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
    <AlertDialog isOpen={decisionOpen} onOpenChange={open => { if (!open && !pending) setDecisionOpen(false) }}><AlertDialog.Backdrop isDismissable={false} isKeyboardDismissDisabled><AlertDialog.Container size="sm" placement="center"><AlertDialog.Dialog className="report-decision-dialog">
      <AlertDialog.Header><AlertDialog.Heading>Çfarë dëshiron të bësh?</AlertDialog.Heading></AlertDialog.Header>
      <AlertDialog.Body><div className="report-decisions"><Button variant="outline" aria-pressed={decision === 'resolved'} onPress={() => setDecision('resolved')} isDisabled={pending}>Zgjidh raportimin</Button><Button variant="outline" aria-pressed={decision === 'rejected'} onPress={() => setDecision('rejected')} isDisabled={pending}>Refuzo raportimin</Button></div><p>{decision === 'resolved' ? 'Konfirmo se raportimi është i vlefshëm dhe veprimi i përshtatshëm është kryer.' : 'Konfirmo se raportimi nuk është i mbështetur ose nuk shkel rregullat e platformës.'}</p><label className="report-note-label">Shënim i brendshëm (i detyrueshëm)<TextArea aria-label="Shënim administrativ" value={note} onChange={event => setNote(event.target.value)} maxLength={1000} disabled={pending} /></label></AlertDialog.Body>
      <AlertDialog.Footer><Button variant="ghost" isDisabled={pending} onPress={() => setDecisionOpen(false)}>Anulo</Button><Button variant="primary" isPending={pending} isDisabled={pending || note.trim().length < 5} onPress={() => void decide()}>Konfirmo vendimin</Button></AlertDialog.Footer>
    </AlertDialog.Dialog></AlertDialog.Container></AlertDialog.Backdrop></AlertDialog>
    <ConfirmActionDialog isOpen={!!moderation} pending={pending} title={moderation === 'suspended' ? 'Kufizo përdoruesin?' : 'Çaktivizo llogarinë?'} description={`Llogaria e ${report?.reported.name || 'përdoruesit'} do të ${moderation === 'suspended' ? 'kufizohet' : 'çaktivizohet'} dhe lidhjet aktive do të ndërpriten. Vendimi për raportimin regjistrohet veçmas.`} confirmLabel={moderation === 'suspended' ? 'Kufizo' : 'Çaktivizo'} onClose={() => setModeration(null)} onConfirm={() => void moderate()} />
  </>
}
