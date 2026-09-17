import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import PasswordInput from '../components/PasswordInput'
import { getErrorMessage } from '../utils/errors'
import DashPageHeader from './DashPageHeader'

export default function ChangePasswordPanel() {
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

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
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Fjalëkalimi u ndryshua me sukses.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="provider-section">
      <DashPageHeader
        title="Ndrysho fjalëkalimin"
        description="Vendos fjalëkalimin aktual dhe zgjidh një të ri."
      />

      <form onSubmit={onSubmit} className="service-form">
        <label>
          Fjalëkalimi aktual
          <PasswordInput
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Fjalëkalimi i ri
          <PasswordInput
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>
        <label className="full">
          Konfirmo fjalëkalimin e ri
          <PasswordInput
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        {error ? <p className="error full">{error}</p> : null}
        {success ? <p className="success full">{success}</p> : null}

        <button type="submit" className="full" disabled={submitting}>
          {submitting ? 'Duke ndryshuar...' : 'Ndrysho fjalëkalimin'}
        </button>
      </form>
    </section>
  )
}
