import type { ReactNode } from 'react'
import { Button, Tooltip } from '@heroui/react'
import { AlertCircle, Check, Clock3, Copy, Pencil, Phone, PhoneMissed, RotateCw, Trash2, Video, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../i18n'
import { formatClock, isEmojiOnly, linkify } from './messageFormat'

export type DeliveryState = 'sending' | 'failed' | 'sent'

function formatFull(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(dateLocale(), { dateStyle: 'full', timeStyle: 'short' })
}

type CallInfo = { title: string; missed: boolean; video: boolean }

type Props = {
  id: string
  body: string
  createdAt: string
  mine: boolean
  deleted?: boolean
  edited?: boolean
  groupStart: boolean
  groupEnd: boolean
  avatar?: ReactNode
  call?: CallInfo | null
  delivery?: DeliveryState
  selected?: boolean
  onSelect?: () => void
  canEdit?: boolean
  canDelete?: boolean
  onCopy?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onRetry?: () => void
  onDiscard?: () => void
  /** Inline editor rendered in place of the text while editing. */
  editor?: ReactNode
}

function ActionButton({ label, danger, onPress, children }: { label: string; danger?: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Tooltip delay={500} closeDelay={0}>
      <Button isIconOnly size="sm" variant="ghost" className={`msg-action${danger ? ' is-danger' : ''}`} aria-label={label} onPress={onPress}>
        {children}
      </Button>
      <Tooltip.Content placement="top">{label}</Tooltip.Content>
    </Tooltip>
  )
}

export default function MessageBubble({
  id, body, createdAt, mine, deleted, edited, groupStart, groupEnd, avatar, call, delivery = 'sent', selected,
  onSelect, canEdit, canDelete, onCopy, onEdit, onDelete, onRetry, onDiscard, editor,
}: Props) {
  const { t } = useTranslation()
  const editing = Boolean(editor)
  const emoji = !deleted && !call && !editing && isEmojiOnly(body)
  const showActions = !editing && delivery === 'sent' && (onCopy || canEdit || canDelete)
  const deliveryLabel = delivery === 'sending' ? t('inbox.sending') : delivery === 'failed' ? t('inbox.failed') : t('inbox.sent')

  const rowClass = [
    'msg-row',
    mine ? 'is-mine' : 'is-peer',
    groupStart ? 'is-group-start' : '',
    groupEnd ? 'is-group-end' : '',
    selected ? 'is-selected' : '',
    delivery !== 'sent' ? `is-${delivery}` : '',
  ].filter(Boolean).join(' ')

  const bubbleClass = [
    'msg-bubble',
    deleted ? 'is-deleted' : '',
    editing ? 'is-editing' : '',
    emoji ? 'is-emoji' : '',
    call ? 'is-call' : '',
  ].filter(Boolean).join(' ')

  const meta = (
    <span className="msg-meta">
      {edited && !deleted ? <span className="msg-edited">{t('inbox.edited')}</span> : null}
      <time dateTime={createdAt} title={formatFull(createdAt)}>{formatClock(createdAt)}</time>
      {mine && !deleted ? (
        <span className={`msg-delivery is-${delivery}`} role="img" aria-label={deliveryLabel} title={deliveryLabel}>
          {delivery === 'sending' ? <Clock3 size={12} aria-hidden /> : delivery === 'failed' ? <AlertCircle size={12} aria-hidden /> : <Check size={13} aria-hidden />}
        </span>
      ) : null}
    </span>
  )

  let content: ReactNode
  if (deleted) {
    content = (
      <p className="msg-text msg-deleted-text">
        <Trash2 size={13} aria-hidden className="msg-deleted-icon" />
        {mine ? t('inbox.deletedMine') : t('inbox.deletedPeer')}
        {meta}
      </p>
    )
  } else if (editor) {
    content = editor
  } else if (call) {
    content = (
      <div className={`msg-call${call.missed ? ' is-missed' : ''}`}>
        <span className="msg-call-icon" aria-hidden>
          {call.missed ? <PhoneMissed size={16} /> : call.video ? <Video size={16} /> : <Phone size={16} />}
        </span>
        <span className="msg-call-info">
          <span className="msg-call-title">{call.title}</span>
          <span className="msg-call-subtitle">{call.video ? t('inbox.videoCall') : t('inbox.voiceCall')}</span>
        </span>
        {meta}
      </div>
    )
  } else {
    content = <p className="msg-text">{linkify(body)}{meta}</p>
  }

  return (
    <div className={rowClass} data-mid={id}>
      {!mine ? <div className="msg-row-avatar" aria-hidden>{groupEnd ? avatar : null}</div> : null}
      <div className="msg-row-main">
        <div
          className={bubbleClass}
          onClick={(event) => {
            if (!onSelect || editing || (event.target as HTMLElement).closest('a, button, textarea')) return
            onSelect()
          }}
        >
          {content}
        </div>
        {delivery === 'failed' ? (
          <div className="msg-failed" role="alert">
            <span>{t('inbox.failed')}</span>
            {onRetry ? (
              <button type="button" onClick={onRetry}><RotateCw size={12} aria-hidden />{t('inbox.retry')}</button>
            ) : null}
            {onDiscard ? (
              <button type="button" onClick={onDiscard} aria-label={t('inbox.discard')}><X size={12} aria-hidden />{t('inbox.discard')}</button>
            ) : null}
          </div>
        ) : null}
      </div>
      {showActions ? (
        <div className="msg-row-actions" role="toolbar" aria-label={t('inbox.messageActions')}>
          {onCopy ? <ActionButton label={t('inbox.copy')} onPress={onCopy}><Copy size={14} /></ActionButton> : null}
          {canEdit && onEdit ? <ActionButton label={t('inbox.editMessage')} onPress={onEdit}><Pencil size={14} /></ActionButton> : null}
          {canDelete && onDelete ? <ActionButton label={t('inbox.deleteMessage')} danger onPress={onDelete}><Trash2 size={14} /></ActionButton> : null}
        </div>
      ) : null}
    </div>
  )
}
