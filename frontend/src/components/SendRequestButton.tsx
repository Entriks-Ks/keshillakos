import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { MatchIntake } from '../api/match'
import {
  sendServiceRequest,
  type ContactMethod,
} from '../api/requests'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'
import SlotPicker from './SlotPicker'

type Props = {
  providerUid: string
  providerId?: string
  providerName: string
  categoryId?: string
  serviceId?: string
  serviceTitle?: string
  intake: Pick<MatchIntake, 'need' | 'location' | 'language' | 'urgency' | 'contact'>
  compact?: boolean
}

export default function SendRequestButton({
  providerUid,
  providerId,
  providerName,
  categoryId,
  serviceId,
  serviceTitle,
  intake,
  compact = false,
}: Props) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [contactMethod, setContactMethod] = useState<ContactMethod>(intake.contact)
  const [wantSlot, setWantSlot] = useState(false)
  const [slotId, setSlotId] = useState('')
  const [scheduleKey, setScheduleKey] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!user) {
    return (
      <p className={`muted${compact ? ' send-request-login' : ''}`}>
        <Link to="/login">Hyr</Link> për të dërguar kërkesë.
      </p>
    )
  }

  if (user.role !== 'user' && user.role !== 'admin') {
    return null
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      await sendServiceRequest({
        providerUid,
        providerId,
        providerName,
        categoryId,
        serviceId,
        serviceTitle,
        need: intake.need,
        message: message.trim() || `Përshëndetje, kam nevojë për ndihmë: ${intake.need}`,
        location: intake.location,
        language: intake.language,
        urgency: intake.urgency,
        contactMethod,
        slotId: wantSlot && slotId ? slotId : undefined,
      })
      setSuccess(
        wantSlot && slotId
          ? 'Kërkesa u dërgua. Ora pret konfirmimin e ofruesit.'
          : 'Kërkesa u dërgua te ofruesi.',
      )
      setMessage('')
      setSlotId('')
      setWantSlot(false)
      setScheduleKey((k) => k + 1)
      setOpen(false)
    } catch (err) {
      setError(getErrorMessage(err))
      setScheduleKey((k) => k + 1)
      setSlotId('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`send-request${compact ? ' is-compact' : ''}`}>
      {!open ? (
        <button
          type="button"
          className={compact ? 'primary-btn send-request-cta' : 'primary-btn'}
          onClick={() => setOpen(true)}
        >
          Dërgo kërkesë
        </button>
      ) : (
        <form onSubmit={onSubmit} className="send-request-form">
          <label>
            Çfarë të duhet?
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={compact ? 2 : 3}
              placeholder="Shkruaj shkurt nevojën tënde…"
              required
              minLength={8}
            />
          </label>

          <label>
            Si të të kontaktojnë
            <select
              value={contactMethod}
              onChange={(e) => setContactMethod(e.target.value as ContactMethod)}
            >
              <option value="chat">Chat</option>
              <option value="phone">Telefon</option>
              <option value="email">Email</option>
            </select>
          </label>

          {!wantSlot ? (
            <button
              type="button"
              className="ghost send-request-slot-toggle"
              onClick={() => setWantSlot(true)}
            >
              + Shto termin (opsionale)
            </button>
          ) : (
            <fieldset className="slot-fieldset">
              <legend>Zgjidh orën</legend>
              <p className="muted slot-hint">E gjelbra = e lirë. Gri = e zënë.</p>
              <SlotPicker
                providerUid={providerUid}
                selectedId={slotId}
                onSelect={setSlotId}
                refreshKey={scheduleKey}
              />
              <button
                type="button"
                className="ghost send-request-slot-toggle"
                onClick={() => {
                  setWantSlot(false)
                  setSlotId('')
                }}
              >
                Hiq termin
              </button>
            </fieldset>
          )}

          <div className="send-request-actions">
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? 'Duke dërguar…' : 'Dërgo'}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setOpen(false)
                setWantSlot(false)
                setSlotId('')
              }}
              disabled={submitting}
            >
              Anulo
            </button>
          </div>
        </form>
      )}
      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="success">{success}</p> : null}
    </div>
  )
}
