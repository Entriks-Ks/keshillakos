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
  openByDefault?: boolean
  ctaLabel?: string
  guestLabel?: string
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
  openByDefault = false,
  ctaLabel = 'Dërgo kërkesë',
  guestLabel = 'Hyr për të dërguar kërkesë',
}: Props) {
  const { user } = useAuth()
  const [open, setOpen] = useState(openByDefault)
  const [message, setMessage] = useState('')
  const [contactMethod, setContactMethod] = useState<ContactMethod>(intake.contact)
  const [slotId, setSlotId] = useState('')
  const [freeCount, setFreeCount] = useState(0)
  const [scheduleKey, setScheduleKey] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!user) {
    return (
      <Link to="/login" className="primary-btn send-request-login-btn">
        {guestLabel}
      </Link>
    )
  }

  const roles = user.roles ?? [user.role]
  if (!roles.includes('user') && !roles.includes('admin')) {
    return null
  }

  if (user.uid === providerUid) {
    return null
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!slotId) {
      setError(
        freeCount > 0
          ? 'Zgjidh një orë të lirë. Termini është i detyrueshëm.'
          : 'Ofruesi nuk ka orare të lira. Nuk mund të dërgosh kërkesë pa termin.',
      )
      return
    }
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
        slotId,
      })
      setSuccess('Kërkesa u dërgua. Ora pret konfirmimin e ofruesit.')
      setMessage('')
      setSlotId('')
      setScheduleKey((k) => k + 1)
      setOpen(openByDefault)
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
          {ctaLabel}
        </button>
      ) : (
        <form onSubmit={onSubmit} className="send-request-form">
          {openByDefault ? (
            <p className="send-request-title">{ctaLabel}</p>
          ) : null}
          <label>
            Çfarë të duhet?
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={compact ? 2 : 4}
              placeholder="Shkruaj shkurt: çfarë të duhet, kur dhe si preferon të flisni."
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
              <option value="chat">Chat në platformë</option>
              <option value="phone">Telefon</option>
              <option value="email">Email</option>
            </select>
          </label>

          <fieldset className="slot-fieldset">
            <legend>Zgjidh orën (e detyrueshme)</legend>
            <p className="muted slot-hint">E gjelbra = e lirë, mund ta zgjedhësh. E kuqja = e zënë.</p>
            <SlotPicker
              providerUid={providerUid}
              selectedId={slotId}
              onSelect={setSlotId}
              refreshKey={scheduleKey}
              required
              onLoaded={({ freeCount: next }) => setFreeCount(next)}
            />
          </fieldset>

          <div className="send-request-actions">
            <button type="submit" className="primary-btn" disabled={submitting || !slotId}>
              {submitting ? 'Duke dërguar…' : ctaLabel}
            </button>
            {!openByDefault ? (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setOpen(false)
                  setSlotId('')
                }}
                disabled={submitting}
              >
                Anulo
              </button>
            ) : null}
          </div>
        </form>
      )}
      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="success">{success}</p> : null}
    </div>
  )
}
