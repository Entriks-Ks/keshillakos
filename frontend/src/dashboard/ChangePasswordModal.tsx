import { useState, type FormEvent } from 'react'
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
      setError('Fjalëkalimi i ri duhet të ketë të paktën 6 karaktere')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Fjalëkalimi i ri dhe konfirmimi nuk përputhen')
      return
    }

    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      toast.success('Fjalëkalimi u ndryshua me sukses.')
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
              <Modal.Heading>Ndrysho fjalëkalimin</Modal.Heading>
              <p>Vendos fjalëkalimin aktual dhe zgjidh një të ri me të paktën 6 karaktere.</p>
            </Modal.Header>
            <form onSubmit={onSubmit} className="st-form">
              <Modal.Body className="st-form-body">
                <label className="st-field">
                  <span>Fjalëkalimi aktual</span>
                  <PasswordInput
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </label>
                <label className="st-field">
                  <span>Fjalëkalimi i ri</span>
                  <PasswordInput
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </label>
                <label className="st-field">
                  <span>Konfirmo fjalëkalimin e ri</span>
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
                  Anulo
                </Button>
                <Button type="submit" variant="primary" isDisabled={submitting}>
                  {submitting ? 'Duke ndryshuar…' : 'Ruaj fjalëkalimin'}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
