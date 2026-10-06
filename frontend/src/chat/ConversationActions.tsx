import { useEffect, useRef, useState } from 'react'
import { AlertDialog, Button, Dropdown, Label, TextArea, toast } from '@heroui/react'
import { MoreHorizontal } from 'lucide-react'
import { blockChatUser, fetchChatDetails, reportChatUser, type ChatAvailability, type ChatDetails } from '../api/chat'
import ConfirmActionDialog from '../components/ConfirmActionDialog'
import { getErrorMessage } from '../utils/errors'

type Props = {
  conversationId: string
  onAvailability: (handler: (event: ChatAvailability & { conversationId: string }) => void) => () => void
  onDetails: (details: (ChatDetails & { conversationId: string }) | null) => void
}

export default function ConversationActions({ conversationId, onAvailability, onDetails }: Props) {
  const [details, setDetails] = useState<ChatDetails | null>(null)
  const [action, setAction] = useState<'block' | 'report' | null>(null)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [detailsError, setDetailsError] = useState(false)
  const [retry, setRetry] = useState(0)
  const detailsRef = useRef<ChatDetails | null>(null)
  const currentId = useRef(conversationId)
  currentId.current = conversationId

  useEffect(() => {
    const controller = new AbortController()
    detailsRef.current = null
    setDetails(null); onDetails(null); setAction(null); setReason(''); setDetailsError(false)
    void fetchChatDetails(conversationId, controller.signal).then(value => {
      if (controller.signal.aborted) return
      const next = detailsRef.current ? { ...value, blockedByMe: detailsRef.current.blockedByMe, messagingBlocked: detailsRef.current.messagingBlocked } : value
      detailsRef.current = next
      setDetails(next); onDetails({ ...next, conversationId })
    }).catch(() => { if (!controller.signal.aborted) setDetailsError(true) })
    const off = onAvailability(event => {
      if (event.conversationId !== conversationId) return
      const value = { ...event, requestContext: detailsRef.current?.requestContext ?? null }
      detailsRef.current = value
      setDetails(value); onDetails(value)
    })
    return () => { controller.abort(); off() }
  }, [conversationId, onAvailability, onDetails, retry])

  async function confirm() {
    const id = conversationId
    setPending(true)
    try {
      if (action === 'report') {
        await reportChatUser(id, reason)
        toast.success('Raportimi u dërgua për shqyrtim')
      } else {
        const value = await blockChatUser(id, !details?.blockedByMe)
        if (currentId.current === id) {
          const next = { ...value, requestContext: details?.requestContext ?? null }
          detailsRef.current = next
          setDetails(next); onDetails({ ...next, conversationId: id })
        }
      }
      if (currentId.current === id) { setAction(null); setReason('') }
    } catch (error) { toast.danger(getErrorMessage(error)) }
    finally { setPending(false) }
  }

  return <>
    <Dropdown>
      <Dropdown.Trigger aria-label="Opsionet e bisedës" className="msg-actions-trigger" isDisabled={pending}>
        <MoreHorizontal size={20} aria-hidden />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label="Opsionet e bisedës" onAction={key => { if (key === 'retry') setRetry(value => value + 1); else setAction(key as 'block' | 'report') }}>
          <Dropdown.Item id="report" textValue="Raporto përdoruesin"><Label>Raporto përdoruesin</Label></Dropdown.Item>
          <Dropdown.Item id="block" isDisabled={!details} textValue={details?.blockedByMe ? 'Zhblloko përdoruesin' : 'Blloko përdoruesin'}><Label>{details?.blockedByMe ? 'Zhblloko përdoruesin' : 'Blloko përdoruesin'}</Label></Dropdown.Item>
          {detailsError && <Dropdown.Item id="retry" textValue="Ringarko opsionet"><Label>Ringarko opsionet</Label></Dropdown.Item>}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
    <ConfirmActionDialog isOpen={action === 'block'} pending={pending} onClose={() => setAction(null)} onConfirm={() => void confirm()}
      title={details?.blockedByMe ? 'Zhblloko përdoruesin?' : 'Blloko përdoruesin?'}
      description="Kjo ndryshon vetëm dërgimin e mesazheve. Kërkesat, terminet dhe historiku i bisedës ruhen."
      confirmLabel={details?.blockedByMe ? 'Zhblloko' : 'Blloko'} />
    <AlertDialog isOpen={action === 'report'} onOpenChange={open => { if (!open && !pending) setAction(null) }}>
      <AlertDialog.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <AlertDialog.Container size="sm" placement="center"><AlertDialog.Dialog>
          <AlertDialog.Header><AlertDialog.Heading>Raporto përdoruesin</AlertDialog.Heading></AlertDialog.Header>
          <AlertDialog.Body>
            <p>Shpjego arsyen. Raportimi shqyrtohet nga administratori.</p>
            <TextArea aria-label="Arsyeja e raportimit" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} disabled={pending} />
          </AlertDialog.Body>
          <AlertDialog.Footer><Button variant="outline" isDisabled={pending} onPress={() => setAction(null)}>Anulo</Button><Button variant="primary" isPending={pending} isDisabled={pending || reason.trim().length < 5} onPress={() => void confirm()}>Dërgo raportimin</Button></AlertDialog.Footer>
        </AlertDialog.Dialog></AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  </>
}
