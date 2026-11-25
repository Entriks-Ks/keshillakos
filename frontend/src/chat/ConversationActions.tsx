import { useEffect, useRef, useState } from 'react'
import { AlertDialog, Button, Dropdown, Label, TextArea, toast } from '@heroui/react'
import { Flag, MoreHorizontal, ShieldAlert, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { blockChatUser, fetchChatDetails, reportChatUser, type ChatAvailability, type ChatDetails } from '../api/chat'
import ConfirmActionDialog from '../components/ConfirmActionDialog'
import { getErrorMessage } from '../utils/errors'

type Props = {
  conversationId: string
  onAvailability: (handler: (event: ChatAvailability & { conversationId: string }) => void) => () => void
  onDetails: (details: (ChatDetails & { conversationId: string }) | null) => void
  onDeleteConversation?: () => void
}

export default function ConversationActions({ conversationId, onAvailability, onDetails, onDeleteConversation }: Props) {
  const { t } = useTranslation()
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
        toast.success(t('chat.actions.reportSent'))
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
      <Dropdown.Trigger aria-label={t('chat.actions.menu')} className="msg-actions-trigger" isDisabled={pending}>
        <MoreHorizontal size={20} aria-hidden />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label={t('chat.actions.menu')} onAction={key => {
          if (key === 'retry') setRetry(value => value + 1);
          else if (key === 'delete') onDeleteConversation?.();
          else setAction(key as 'block' | 'report')
        }}>
          <Dropdown.Item id="report" textValue={t('chat.actions.report')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flag size={16} />
              <Label>{t('chat.actions.report')}</Label>
            </span>
          </Dropdown.Item>
          <Dropdown.Item id="block" isDisabled={!details} textValue={details?.blockedByMe ? t('chat.actions.unblock') : t('chat.actions.block')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} />
              <Label>{details?.blockedByMe ? t('chat.actions.unblock') : t('chat.actions.block')}</Label>
            </span>
          </Dropdown.Item>
          <Dropdown.Item id="delete" className="text-danger" textValue={t('chat.actions.delete')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger, #dc2626)' }}>
              <Trash2 size={16} />
              <Label style={{ color: 'inherit' }}>{t('chat.actions.delete')}</Label>
            </span>
          </Dropdown.Item>
          {detailsError && <Dropdown.Item id="retry" textValue={t('chat.actions.retry')}><Label>{t('chat.actions.retry')}</Label></Dropdown.Item>}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
    <ConfirmActionDialog isOpen={action === 'block'} pending={pending} onClose={() => setAction(null)} onConfirm={() => void confirm()}
      title={details?.blockedByMe ? t('chat.actions.unblockTitle') : t('chat.actions.blockTitle')}
      description={t('chat.actions.blockDescription')}
      confirmLabel={details?.blockedByMe ? t('chat.actions.unblockConfirm') : t('chat.actions.blockConfirm')} />
    <AlertDialog isOpen={action === 'report'} onOpenChange={open => { if (!open && !pending) setAction(null) }}>
      <AlertDialog.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <AlertDialog.Container size="sm" placement="center"><AlertDialog.Dialog>
          <AlertDialog.Header><AlertDialog.Heading>{t('chat.actions.report')}</AlertDialog.Heading></AlertDialog.Header>
          <AlertDialog.Body>
            <p>{t('chat.actions.reportDescription')}</p>
            <TextArea aria-label={t('chat.actions.reportReason')} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} disabled={pending} />
          </AlertDialog.Body>
          <AlertDialog.Footer><Button variant="outline" isDisabled={pending} onPress={() => setAction(null)}>{t('notifications.cancel')}</Button><Button variant="primary" isPending={pending} isDisabled={pending || reason.trim().length < 5} onPress={() => void confirm()}>{t('chat.actions.sendReport')}</Button></AlertDialog.Footer>
        </AlertDialog.Dialog></AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  </>
}
