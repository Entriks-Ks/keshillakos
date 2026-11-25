import { useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AlertDialog, Button, Modal, toast } from '@heroui/react'
import { submitPlatformFeedback } from '../api/feedback'
import type { AuthUser } from '../api/auth'
import { getErrorMessage } from '../utils/errors'

export type AccountRequestKind = 'deletion' | 'export'

/** `subject` is sent to the admin team as-is; everything else is a translation key. */
const COPY: Record<
  AccountRequestKind,
  { title: string; intro: string; subject: string; confirm?: string; submit: string; done: string }
> = {
  deletion: {
    title: 'settings.deletion.title',
    intro: 'settings.deletion.intro',
    subject: 'Kërkesë për fshirjen e llogarisë',
    confirm: 'settings.deletion.confirm',
    submit: 'settings.deletion.submit',
    done: 'settings.deletion.done',
  },
  export: {
    title: 'settings.export.title',
    intro: 'settings.export.intro',
    subject: 'Kërkesë për kopjen e të dhënave personale',
    submit: 'settings.export.submit',
    done: 'settings.export.done',
  },
}

const REASON_MAX = 600

export default function AccountRequestModal({
  kind,
  user,
  onClose,
}: {
 
  /** `null` keeps the modal closed. */
  kind: AccountRequestKind | null
  user: AuthUser
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [shownKind, setShownKind] = useState(kind)
  if (kind && kind !== shownKind) setShownKind(kind)
  const copy = shownKind ? COPY[shownKind] : null

  function handleOpenChange(open: boolean) {
    if (open || sending) return
    setReason('')
    setConfirmed(false)
    setError('')
    setSent(false)
    onClose()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!copy || (copy.confirm && !confirmed)) return
    if (sending || sent) return
    setSending(true)
    setError('')
    try {
      await submitPlatformFeedback({
        message: [copy.subject, `Email: ${user.email}`, `UID: ${user.uid}`, `Arsyeja: ${reason.trim() || '—'}`].join('\n'),
        name: user.name,
        email: user.email,
      })
      setSent(true)
      toast.success(t('settings.requestSent'))
    } catch (err) {
      setError(getErrorMessage(err))
      toast.danger(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const Dialog = shownKind === 'deletion' ? AlertDialog : Modal

  return (
    <Dialog isOpen={Boolean(kind)} onOpenChange={handleOpenChange}>
      <Dialog.Backdrop isDismissable={!sending} isKeyboardDismissDisabled={sending}>
        <Dialog.Container size="sm" placement="center">
          <Dialog.Dialog className={`st-modal${shownKind === 'deletion' ? ' is-danger' : ''}`}>
            <Dialog.Header className="st-modal-head">
              <Dialog.Heading>{copy ? t(copy.title) : null}</Dialog.Heading>
              {!sent && copy ? <p>{t(copy.intro)}</p> : null}
            </Dialog.Header>
            {sent ? (
              <>
                <Dialog.Body>
                  <p className="st-modal-done" role="status">
                    {copy ? <Trans i18nKey={copy.done} values={{ email: user.email }} components={{ strong: <strong /> }} /> : null}
                  </p>
                </Dialog.Body>
                <Dialog.Footer className="st-modal-foot">
                  <Button variant="primary" onPress={() => handleOpenChange(false)}>
                    {t('feedback.close')}
                  </Button>
                </Dialog.Footer>
              </>
            ) : (
              <form onSubmit={onSubmit} className="st-form">
                <Dialog.Body className="st-form-body">
                  <label className="st-field">
                    <span>
                      {t('settings.reason')} <em>{t('settings.optional')}</em>
                    </span>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      maxLength={REASON_MAX}
                    />
                  </label>
                  {copy?.confirm ? (
                    <label className="st-check">
                      <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                      <span>{t(copy.confirm)}</span>
                    </label>
                  ) : null}
                  {error ? (
                    <p className="st-form-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                </Dialog.Body>
                <Dialog.Footer className="st-modal-foot">
                  <Button variant="ghost" isDisabled={sending} onPress={() => handleOpenChange(false)}>
                    {t('notifications.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    variant={shownKind === 'deletion' ? 'danger' : 'primary'}
                    isDisabled={sending || Boolean(copy?.confirm && !confirmed)}
                  >
                    {sending ? t('feedback.sending') : copy ? t(copy.submit) : null}
                  </Button>
                </Dialog.Footer>
              </form>
            )}
          </Dialog.Dialog>
        </Dialog.Container>
      </Dialog.Backdrop>
    </Dialog>
  )
}
