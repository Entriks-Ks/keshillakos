import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { toast } from '@heroui/react'
import { Link } from 'react-router-dom'
import { CalendarDays, X } from 'lucide-react'
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
  ctaLabel = 'Dërgo kërkesë',
  guestLabel = 'Hyr për të dërguar kërkesë',
}: Props) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [contactMethod, setContactMethod] = useState<ContactMethod>(intake.contact)
  const [contactPhone, setContactPhone] = useState(user?.phone ?? '')
  const [contactEmail, setContactEmail] = useState(user?.email ?? '')
  const [slotId, setSlotId] = useState('')
  const [freeCount, setFreeCount] = useState(0)
  const [scheduleKey, setScheduleKey] = useState(0)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, submitting])

  if (!user) {
    return (
      <Link to="/login" className="primary-btn send-request-login-btn">
        {guestLabel}
      </Link>
    )
  }

  if (user.uid === providerUid) {
    return null
  }

  function close() {
    if (submitting) return
    setOpen(false)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!slotId) {
      setError(
        freeCount > 0
          ? 'Zgjidh një orë të lirë. Termini është i detyrueshëm.'
          : 'Ofruesi nuk ka orare të lira. Nuk mund të dërgosh kërkesë pa termin.',
      )
      return
    }
    if (!contactPhone.replace(/[\s()-]/g, '')) {
      setError('Shkruaj numrin e telefonit.')
      return
    }
    if (contactMethod === 'email' && !contactEmail.trim()) {
      setError('Shkruaj email-in.')
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
        contactPhone: contactPhone.trim(),
        contactEmail: contactMethod === 'email' ? contactEmail.trim() : undefined,
        slotId,
      })
      toast.success('Kërkesa u dërgua. Ora pret konfirmimin e ofruesit.')
      setMessage('')
      setSlotId('')
      setScheduleKey((k) => k + 1)
      setOpen(false)
    } catch (err) {
      toast.danger(getErrorMessage(err))
      setScheduleKey((k) => k + 1)
      setSlotId('')
    } finally {
      setSubmitting(false)
    }
  }

  const modal = open
    ? createPortal(
        <div className="booking-modal-backdrop" onClick={close} role="presentation">
          <div
            className="booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="booking-modal-head">
              <div>
                <p className="booking-modal-kicker">Rezervim</p>
                <h2 id="booking-modal-title">Zgjidh orën me {providerName}</h2>
                <p className="muted">Zgjidh ditën në kalendar, pastaj orën e lirë.</p>
              </div>
              <button
                type="button"
                className="ghost booking-modal-close"
                onClick={close}
                disabled={submitting}
                aria-label="Mbyll"
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={onSubmit} className="booking-modal-body">
              <div className="booking-modal-cal">
                <SlotPicker
                  providerUid={providerUid}
                  selectedId={slotId}
                  onSelect={setSlotId}
                  refreshKey={scheduleKey}
                  required
                  onLoaded={({ freeCount: next }) => setFreeCount(next)}
                />
              </div>

              <div className="booking-modal-form">
                <label>
                  Çfarë të duhet?
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={compact ? 3 : 5}
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

                <label>
                  Numri i telefonit
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="p.sh. 044 123 456"
                    required
                  />
                </label>

                {contactMethod === 'email' ? (
                  <label>
                    Email-i
                    <input
                      type="email"
                      autoComplete="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="p.sh. emri@email.com"
                      required
                    />
                  </label>
                ) : null}

                {slotId ? (
                  <p className="success booking-modal-picked">Ora u zgjodh. Dërgo kërkesën për ta rezervuar.</p>
                ) : (
                  <p className="muted booking-modal-picked">Zgjidh një orë të lirë në kalendar.</p>
                )}

                {error ? <p className="error">{error}</p> : null}

                <div className="send-request-actions">
                  <button type="submit" className="primary-btn" disabled={submitting || !slotId || !contactPhone.trim()}>
                    {submitting ? 'Duke dërguar…' : ctaLabel}
                  </button>
                  <button type="button" className="ghost" onClick={close} disabled={submitting}>
                    Anulo
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div className={`send-request${compact ? ' is-compact' : ''}`}>
      <button
        type="button"
        className={compact ? 'primary-btn send-request-cta' : 'primary-btn'}
        onClick={() => {
          setError('')
          setOpen(true)
        }}
      >
        <CalendarDays size={16} aria-hidden />
        {ctaLabel}
      </button>
      <p className="muted send-request-hint">Zgjidh orën dhe dërgo kërkesën në një hap.</p>
      {modal}
    </div>
  )
}
