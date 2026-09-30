import { useState, type FormEvent } from 'react'
import { Button, Modal } from '@heroui/react'
import { submitPlatformFeedback } from '../api/feedback'
import type { AuthUser } from '../api/auth'
import { getErrorMessage } from '../utils/errors'

export type AccountRequestKind = 'deletion' | 'export'

const COPY: Record<
  AccountRequestKind,
  { title: string; intro: string; subject: string; confirm?: string; submit: string; done: string }
> = {
  deletion: {
    title: 'Kërko fshirjen e llogarisë',
    intro:
      'Kërkesa i dërgohet ekipit të KëshillaKos. Pasi ta verifikojmë, llogaria mbyllet dhe të dhënat e saj fshihen sipas politikës së privatësisë. Ky veprim nuk mund të kthehet.',
    subject: 'Kërkesë për fshirjen e llogarisë',
    confirm: 'Kuptoj që fshirja e llogarisë është e përhershme.',
    submit: 'Dërgo kërkesën për fshirje',
    done: 'Kërkesa për fshirje u dërgua. Ekipi do ta shqyrtojë dhe do të të kontaktojë në',
  },
  export: {
    title: 'Kërko kopjen e të dhënave',
    intro: 'Ekipi i KëshillaKos do të përgatisë një kopje të të dhënave personale që ruajmë për llogarinë tënde.',
    subject: 'Kërkesë për kopjen e të dhënave personale',
    submit: 'Dërgo kërkesën',
    done: 'Kërkesa u dërgua. Ekipi do të të kontaktojë në',
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
    setSending(true)
    setError('')
    try {
      await submitPlatformFeedback({
        message: [copy.subject, `Email: ${user.email}`, `UID: ${user.uid}`, `Arsyeja: ${reason.trim() || '—'}`].join('\n'),
        name: user.name,
        email: user.email,
      })
      setSent(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal isOpen={Boolean(kind)} onOpenChange={handleOpenChange}>
      <Modal.Backdrop isDismissable={!sending}>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className={`st-modal${shownKind === 'deletion' ? ' is-danger' : ''}`}>
            <Modal.CloseTrigger />
            <Modal.Header className="st-modal-head">
              <Modal.Heading>{copy?.title}</Modal.Heading>
              {!sent ? <p>{copy?.intro}</p> : null}
            </Modal.Header>
            {sent ? (
              <>
                <Modal.Body>
                  <p className="st-modal-done" role="status">
                    {copy?.done} <strong>{user.email}</strong>.
                  </p>
                </Modal.Body>
                <Modal.Footer className="st-modal-foot">
                  <Button variant="primary" onPress={() => handleOpenChange(false)}>
                    Mbyll
                  </Button>
                </Modal.Footer>
              </>
            ) : (
              <form onSubmit={onSubmit} className="st-form">
                <Modal.Body className="st-form-body">
                  <label className="st-field">
                    <span>
                      Arsyeja <em>(opsionale)</em>
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
                      <span>{copy.confirm}</span>
                    </label>
                  ) : null}
                  {error ? (
                    <p className="st-form-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                </Modal.Body>
                <Modal.Footer className="st-modal-foot">
                  <Button variant="ghost" isDisabled={sending} onPress={() => handleOpenChange(false)}>
                    Anulo
                  </Button>
                  <Button
                    type="submit"
                    variant={shownKind === 'deletion' ? 'danger' : 'primary'}
                    isDisabled={sending || Boolean(copy?.confirm && !confirmed)}
                  >
                    {sending ? 'Duke u dërguar…' : copy?.submit}
                  </Button>
                </Modal.Footer>
              </form>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
