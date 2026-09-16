import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { mediaUrl } from '../api/auth'
import {
  fetchProviderSchedule,
  formatSlotDay,
  formatSlotTime,
  type AvailabilitySlot,
} from '../api/availability'
import { fetchProviderProfile, type PublicProvider } from '../api/providers'
import type { ServiceItem } from '../api/services'
import RateProvider from '../components/RateProvider'
import SendRequestButton from '../components/SendRequestButton'
import ServiceCard from '../components/ServiceCard'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../utils/dashboardPath'
import { getErrorMessage } from '../utils/errors'
import type { MatchIntake } from '../api/match'

export default function ProviderProfilePage() {
  const { uid } = useParams<{ uid: string }>()
  const { user } = useAuth()
  const [provider, setProvider] = useState<PublicProvider | null>(null)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [schedule, setSchedule] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!uid) {
      setError('Profili nuk u gjet')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    fetchProviderProfile(uid)
      .then((data) => {
        if (cancelled) return
        setProvider(data.provider)
        setServices(data.services)
      })
      .catch((err) => {
        if (cancelled) return
        setProvider(null)
        setServices([])
        setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [uid])

  useEffect(() => {
    if (!provider?.uid) {
      setSchedule([])
      return
    }

    let cancelled = false
    fetchProviderSchedule(provider.uid)
      .then((data) => {
        if (!cancelled) setSchedule(data.slots.slice(0, 12))
      })
      .catch(() => {
        if (!cancelled) setSchedule([])
      })

    return () => {
      cancelled = true
    }
  }, [provider?.uid])

  const photo = mediaUrl(provider?.profilePhoto)
  const intakeDefaults: Pick<
    MatchIntake,
    'need' | 'location' | 'language' | 'urgency' | 'contact'
  > = {
    need: provider?.headline || `Këshillim me ${provider?.name || 'ofruesin'}`,
    location: provider?.location || 'Online',
    language: 'Albanian',
    urgency: 'flexible',
    contact: 'chat',
  }

  return (
    <div className="home-shell">
      <header className="home-header">
        <Link to="/" className="brand brand-link">
          KëshillaKos
        </Link>
        {user ? (
          <Link className="ghost link-btn" to={getDashboardPath(user.role)}>
            Dashboard
          </Link>
        ) : (
          <Link className="ghost link-btn" to="/login">
            Hyr
          </Link>
        )}
      </header>

      <main className="provider-profile-main">
        <Link to="/" className="ghost link-btn service-detail-back">
          ← Kthehu te shërbimet
        </Link>

        {loading ? <p className="muted">Duke u ngarkuar...</p> : null}

        {!loading && error ? (
          <div className="service-detail-empty">
            <h1>Profili nuk u gjet</h1>
            <p className="error">{error}</p>
            <Link className="primary-btn" to="/">
              Kthehu në fillim
            </Link>
          </div>
        ) : null}

        {!loading && provider ? (
          <>
            <section className="provider-profile-card" aria-labelledby="provider-profile-heading">
              <div className="provider-profile-head">
                <div className="profile-avatar-lg" aria-hidden>
                  {photo ? <img src={photo} alt="" /> : <span>{provider.name.slice(0, 1)}</span>}
                </div>
                <div className="provider-profile-intro">
                  <p className="service-card-kicker">{provider.roleLabel}</p>
                  <h1 id="provider-profile-heading">{provider.name}</h1>
                  {provider.headline ? <p className="provider-profile-headline">{provider.headline}</p> : null}
                  <p className="muted">
                    ★{' '}
                    {provider.ratingCount > 0
                      ? `${provider.ratingAverage.toFixed(1)} (${provider.ratingCount} vlerësime)`
                      : 'pa vlerësime'}
                    {provider.location ? ` · ${provider.location}` : ''}
                  </p>
                </div>
              </div>

              {provider.bio ? <p className="provider-profile-bio">{provider.bio}</p> : null}

              {provider.skills && provider.skills.length > 0 ? (
                <div>
                  <p className="provider-details-label">Aftësitë</p>
                  <ul className="service-card-chips">
                    {provider.skills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {provider.languages && provider.languages.length > 0 ? (
                <div>
                  <p className="provider-details-label">Gjuhët</p>
                  <ul className="service-card-chips">
                    {provider.languages.map((lang) => (
                      <li key={lang}>{lang}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {schedule.length > 0 ? (
                <div className="service-card-slots">
                  <p className="provider-details-label">Oraret e ofruesit</p>
                  <div className="slot-time-grid slot-time-grid-compact">
                    {schedule.map((slot) => {
                      const free = slot.status === 'open'
                      return (
                        <span
                          key={slot.id}
                          className={`slot-time-chip${free ? ' is-free' : ' is-busy'}`}
                          title={`${formatSlotDay(slot.startAt)} ${formatSlotTime(slot.startAt)}`}
                        >
                          <strong>{formatSlotTime(slot.startAt)}</strong>
                          <em>{free ? 'I lirë' : 'I zënë'}</em>
                        </span>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              <div className="service-card-actions">
                <RateProvider
                  providerUid={provider.uid}
                  providerName={provider.name}
                  initialAverage={provider.ratingAverage}
                  initialCount={provider.ratingCount}
                  compact
                />
                {user?.role === 'user' || user?.role === 'admin' || !user ? (
                  <SendRequestButton
                    providerUid={provider.uid}
                    providerName={provider.name}
                    intake={intakeDefaults}
                  />
                ) : null}
              </div>
            </section>

            <section aria-labelledby="provider-services-heading">
              <h2 id="provider-services-heading" className="service-detail-title">
                Shërbimet e ofruara
              </h2>
              {services.length === 0 ? (
                <p className="muted">Ky ofrues nuk ka ende shërbime të publikuara.</p>
              ) : (
                <div className="home-services-list">
                  {services.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  )
}
