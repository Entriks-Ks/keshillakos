import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CalendarDays, Mail, X, type LucideIcon } from 'lucide-react'
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
  /** Override the CTA icon (defaults to calendar; use mail for Kontakto). */
  ctaIcon?: 'calendar' | 'mail' | LucideIcon
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
  ctaLabel: ctaLabelProp,
  guestLabel: guestLabelProp,
  ctaIcon = 'calendar',
}: Props) {
  const { t } = useTranslation()
  const ctaLabel = ctaLabelProp ?? t('booking.cta')
  const guestLabel = guestLabelProp ?? t('booking.guest')
  const CtaIcon = ctaIcon === 'mail' ? Mail : ctaIcon === 'calendar' ? CalendarDays : ctaIcon
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
    if (compact) {
      return (
        <Link to="/login" className="primary-btn send-request-cta" aria-label={ctaLabel}>
          <CtaIcon size={16} aria-hidden />
          <span className="tt-dir-action-text">{ctaLabel}</span>
        </Link>
      )
    }
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
          ? t('booking.slotRequired')
          : t('booking.noSlots'),
      )
      return
    }
    if (!contactPhone.replace(/[\s()-]/g, '')) {
      setError(t('booking.phoneRequired'))
      return
    }
    if (contactMethod === 'email' && !contactEmail.trim()) {
      setError(t('booking.emailRequired'))
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
        message: message.trim() || t('booking.defaultMessage', { need: intake.need }),
        location: intake.location,
        language: intake.language,
        urgency: intake.urgency,
        contactMethod,
        contactPhone: contactPhone.trim(),
        contactEmail: contactMethod === 'email' ? contactEmail.trim() : undefined,
        slotId,
      })
      toast.success(t('booking.sent'))
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
                <p className="booking-modal-kicker">{t('booking.kicker')}</p>
                <h2 id="booking-modal-title">{t('booking.title', { name: providerName })}</h2>
                <p className="muted">{t('booking.lead')}</p>
              </div>
              <button
                type="button"
                className="ghost booking-modal-close"
                onClick={close}
                disabled={submitting}
                aria-label={t('feedback.close')}
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
                  {t('home.what')}
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={compact ? 3 : 5}
                    placeholder={t('booking.needPlaceholder')}
                    required
                    minLength={8}
                  />
                </label>

                <label>
                  {t('home.contact')}
                  <select
                    value={contactMethod}
                    onChange={(e) => setContactMethod(e.target.value as ContactMethod)}
                  >
                    <option value="chat">{t('booking.chatOption')}</option>
                    <option value="phone">{t('req.phone')}</option>
                    <option value="email">{t('req.email')}</option>
                  </select>
                </label>

                <label>
                  {t('booking.phoneLabel')}
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder={t('booking.phonePlaceholder')}
                    required
                  />
                </label>

                {contactMethod === 'email' ? (
                  <label>
                    {t('req.email')}
                    <input
                      type="email"
                      autoComplete="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder={t('booking.emailPlaceholder')}
                      required
                    />
                  </label>
                ) : null}

                {slotId ? (
                  <p className="success booking-modal-picked">{t('booking.picked')}</p>
                ) : (
                  <p className="muted booking-modal-picked">{t('booking.pickInCalendar')}</p>
                )}

                {error ? <p className="error">{error}</p> : null}

                <div className="send-request-actions">
                  <button type="submit" className="primary-btn" disabled={submitting || !slotId || !contactPhone.trim()}>
                    {submitting ? t('feedback.sending') : ctaLabel}
                  </button>
                  <button type="button" className="ghost" onClick={close} disabled={submitting}>
                    {t('notifications.cancel')}
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
        <CtaIcon size={16} aria-hidden />
        <span className={compact ? 'tt-dir-action-text' : undefined}>{ctaLabel}</span>
      </button>
      <p className="muted send-request-hint">{t('booking.hint')}</p>
      {modal}
    </div>
  )
}
