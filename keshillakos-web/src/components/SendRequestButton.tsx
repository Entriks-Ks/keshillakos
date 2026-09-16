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
  providerName: string
  serviceId?: string
  serviceTitle?: string
  intake: Pick<MatchIntake, 'need' | 'location' | 'language' | 'urgency' | 'contact'>
}

export default function SendRequestButton({
  providerUid,
  providerName,
  serviceId,
  serviceTitle,
  intake,
}: Props) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [contactMethod, setContactMethod] = useState<ContactMethod>(intake.contact)
  const [slotId, setSlotId] = useState('')
  const [scheduleKey, setScheduleKey] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!user) {
    return (
      <p className="muted">
        <Link to="/login">Hyr</Link> si përdorues për të dërguar kërkesë.
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
        providerName,
        serviceId,
        serviceTitle,
        need: intake.need,
        message: message.trim() || `Përshëndetje, kam nevojë për ndihmë: ${intake.need}`,
        location: intake.location,
        language: intake.language,
        urgency: intake.urgency,
        contactMethod,
        slotId: slotId || undefined,
      })
      setSuccess(
        slotId
          ? 'Kërkesa u dërgua dhe ora u rezervua. Të tjerët nuk mund ta zgjedhin më.'
          : 'Kërkesa u dërgua te ofruesi.',
      )
      setMessage('')
      setSlotId('')
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
    <div className="send-request">
      {!open ? (
        <button type="button" className="primary-btn" onClick={() => setOpen(true)}>
          Dërgo kërkesë / rezervim
        </button>
      ) : (
        <form onSubmit={onSubmit} className="send-request-form">
          <fieldset className="slot-fieldset">
            <legend>Zgjidh orën</legend>
            <p className="muted slot-hint">
              Orët e gjelbra janë të lira. Orët gri janë të zëna — nuk mund të rezervohen.
            </p>
            <SlotPicker
              providerUid={providerUid}
              selectedId={slotId}
              onSelect={setSlotId}
              refreshKey={scheduleKey}
            />
          </fieldset>

          <label>
            Mesazhi për ofruesin
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Shkruaj shkurt çfarë të duhet dhe si të të kontaktojnë..."
              required
              minLength={8}
            />
          </label>
          <label>
            Kontakti i preferuar
            <select
              value={contactMethod}
              onChange={(e) => setContactMethod(e.target.value as ContactMethod)}
            >
              <option value="chat">Chat</option>
              <option value="phone">Telefon</option>
              <option value="email">Email</option>
            </select>
          </label>
          <div className="send-request-actions">
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting
                ? 'Duke dërguar...'
                : slotId
                  ? 'Rezervo orën dhe dërgo'
                  : 'Dërgo pa termin'}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setOpen(false)}
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
