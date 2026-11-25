import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal, toast } from '@heroui/react'
import { useAuth } from '../auth/AuthContext'
import PasswordInput from '../components/PasswordInput'
import { getErrorMessage } from '../utils/errors'

export default function ChangePasswordModal({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleOpenChange(open: boolean) {
    if (!open) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setError('')
    }
    onOpenChange(open)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError(t('settings.passwordShort'))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t('settings.passwordMismatch'))
      return
    }

    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      toast.success(t('settings.passwordChanged'))
      handleOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Backdrop isDismissable={!submitting}>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className="st-modal">
            <Modal.CloseTrigger />
            <Modal.Header className="st-modal-head">
              <Modal.Heading>{t('settings.changePassword')}</Modal.Heading>
              <p>{t('settings.passwordLead')}</p>
            </Modal.Header>
            <form onSubmit={onSubmit} className="st-form">
              <Modal.Body className="st-form-body">
                <label className="st-field">
                  <span>{t('settings.currentPassword')}</span>
                  <PasswordInput
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </label>
                <label className="st-field">
                  <span>{t('settings.newPassword')}</span>
                  <PasswordInput
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </label>
                <label className="st-field">
                  <span>{t('settings.confirmPassword')}</span>
                  <PasswordInput
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </label>
                {error ? (
                  <p className="st-form-error" role="alert">
                    {error}
                  </p>
                ) : null}
              </Modal.Body>
              <Modal.Footer className="st-modal-foot">
                <Button variant="ghost" isDisabled={submitting} onPress={() => handleOpenChange(false)}>
                  {t('notifications.cancel')}
                </Button>
                <Button type="submit" variant="primary" isDisabled={submitting}>
                  {submitting ? t('settings.changing') : t('settings.savePassword')}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
