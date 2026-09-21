import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, Clock, Languages, MapPin, MessageCircle } from 'lucide-react'
import { mediaUrl } from '../api/auth'
import {
  fetchProviderSchedule,
  type AvailabilitySlot,
} from '../api/availability'
import { fetchProviderProfile, type PublicProvider } from '../api/providers'
import type { ServiceItem } from '../api/services'
import type { MatchIntake } from '../api/match'
import ProviderReviews from '../components/ProviderReviews'
import ScheduleCalendar from '../components/ScheduleCalendar'
import SendRequestButton from '../components/SendRequestButton'
import ServiceCard from '../components/ServiceCard'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import StartChatButton from '../components/StartChatButton'
import { catalogImageForLabels } from '../data/catalogImages'
import { getErrorMessage } from '../utils/errors'

function ratingWord(average: number, count: number) {
  if (count <= 0) return 'Ende pa vlerësime'
  if (average >= 4.8) return 'Shkëlqyeshëm'
  if (average >= 4) return 'Shumë mirë'
  if (average >= 3) return 'Mirë'
  return 'Në përmirësim'
}

export default function ProviderProfilePage() {
  const { uid } = useParams<{ uid: string }>()
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
        if (!cancelled) setSchedule(data.slots)
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
  const firstService = services[0]
  const cover = firstService
    ? catalogImageForLabels(firstService.subcategory, firstService.categoryLabel || firstService.category)
    : catalogImageForLabels(provider?.roleLabel)
  const gallery = (() => {
    const uploaded = services.flatMap((item) => (item.details?.photos || []).map((url) => mediaUrl(url))).filter(Boolean)
    if (uploaded.length) return uploaded.slice(0, 8)
    return [cover, photo].filter(Boolean)
  })()

  return (
    <div className="tt-shell">
      <SiteNav />
      <main>
        <section className="tt-section tt-pro-page">
          <div className="tt-section-inner">
            {loading ? <p className="muted">Duke u ngarkuar…</p> : null}

            {!loading && error ? (
              <div className="tt-detail-empty">
                <h1>Profili nuk u gjet</h1>
                <p className="error">{error}</p>
                <Link className="primary-btn" to="/ofertat">
                  Shiko ofertat
                </Link>
              </div>
            ) : null}

            {!loading && provider ? (
              <>
                <nav className="tt-pro-crumbs" aria-label="Breadcrumb">
                  <Link to="/ofertat">Ofertat</Link>
                  <span>{provider.roleLabel}</span>
                  <span>{provider.name}</span>
                </nav>
                <Link to="/ofertat" className="tt-detail-back">
                  <ArrowLeft size={16} aria-hidden />
                  Shiko më shumë ofrues
                </Link>

                <div className="tt-pro-layout">
                    <header className="tt-pro-hero">
                      <div className="tt-pro-avatar" aria-hidden>
                        {photo ? <img src={photo} alt="" /> : <span>{provider.name.slice(0, 1)}</span>}
                      </div>
                      <div className="tt-pro-hero-copy">
                        <h1>{provider.name}</h1>
                        <p className="tt-pro-rating">
                          <strong>{ratingWord(provider.ratingAverage, provider.ratingCount)}</strong>
                          {provider.ratingCount > 0 ? (
                            <>
                              <span className="tt-pro-rating-score">{provider.ratingAverage.toFixed(1)}</span>
                              <span className="tt-pro-stars" aria-hidden>
                                {'★'.repeat(Math.max(1, Math.round(provider.ratingAverage)))}
                                {'☆'.repeat(Math.max(0, 5 - Math.round(provider.ratingAverage)))}
                              </span>
                              <a href="#vleresimet">({provider.ratingCount})</a>
                            </>
                          ) : null}
                        </p>
                        <p className="tt-pro-kicker">
                          {provider.roleLabel}
                          {provider.location ? ` · ${provider.location}` : ''}
                        </p>
                      </div>
                    </header>

                  <div className="tt-pro-main">

                    <nav className="tt-pro-tabs" aria-label="Seksionet e profilit">
                      <a href="#rreth">Rreth</a>
                      <a href="#sherbimi">Shërbimet</a>
                      <a href="#foto">Foto</a>
                      <a href="#vleresimet">Vlerësimet</a>
                    </nav>

                    <div className="tt-pro-why">
                      <p>
                        <MessageCircle size={16} aria-hidden />
                        <strong>Pse ky ofrues?</strong>
                      </p>
                      <p>
                        {provider.headline ||
                          `${provider.name} ofron shërbime ${provider.roleLabel.toLowerCase()}${
                            provider.location ? ` në ${provider.location}` : ''
                          }. Dërgo kërkesë për të marrë një ofertë.`}
                      </p>
                    </div>

                    <section className="tt-pro-section" id="rreth">
                      <h2>Rreth</h2>
                      {provider.bio ? <p className="tt-detail-desc">{provider.bio}</p> : <p className="muted">Ofruesi nuk ka shtuar ende një përshkrim.</p>}
                      <ul className="tt-pro-facts">
                        {provider.location ? (
                          <li>
                            <MapPin size={18} aria-hidden />
                            <span>{provider.location}</span>
                          </li>
                        ) : null}
                        {provider.roleLabel ? (
                          <li>
                            <BadgeCheck size={18} aria-hidden />
                            <span>{provider.roleLabel}</span>
                          </li>
                        ) : null}
                        {provider.languages && provider.languages.length > 0 ? (
                          <li>
                            <Languages size={18} aria-hidden />
                            <span>{provider.languages.join(', ')}</span>
                          </li>
                        ) : null}
                        {schedule.some((slot) => slot.status === 'open') ? (
                          <li>
                            <Clock size={18} aria-hidden />
                            <span>{schedule.filter((slot) => slot.status === 'open').length} orë të lira</span>
                          </li>
                        ) : null}
                      </ul>
                    </section>

                    {provider.skills && provider.skills.length > 0 ? (
                      <section className="tt-pro-section">
                        <h2>Aftësitë</h2>
                        <ul className="service-card-chips">
                          {provider.skills.map((skill) => (
                            <li key={skill}>{skill}</li>
                          ))}
                        </ul>
                      </section>
                    ) : null}

                    <section className="tt-pro-section" id="foto">
                      <h2>Projekte dhe foto</h2>
                      {gallery.length > 0 ? (
                        <div className="tt-pro-gallery">
                          {gallery.map((src, index) => (
                            <img key={`${src}-${index}`} src={src} alt="" />
                          ))}
                        </div>
                      ) : (
                        <p className="muted">Ofruesi nuk ka ngarkuar ende foto të punës.</p>
                      )}
                    </section>

                    <section className="tt-pro-section" id="sherbimi">
                      <h2>Shërbimet</h2>
                      {services.length === 0 ? (
                        <p className="muted">Ky ofrues nuk ka ende shërbime të publikuara.</p>
                      ) : (
                        <div className="tt-offers-grid">
                          {services.map((service) => (
                            <ServiceCard key={service.id} service={service} mode="compact" />
                          ))}
                        </div>
                      )}
                    </section>

                    {schedule.length > 0 ? (
                      <section className="tt-pro-section" id="oraret">
                        <h2>Oraret</h2>
                        <p className="muted">E gjelbra = e lirë. E kuqja = e zënë.</p>
                        <ScheduleCalendar slots={schedule} />
                      </section>
                    ) : null}

                    <div className="tt-pro-contact-row">
                      <StartChatButton providerUid={provider.uid} providerName={provider.name} hideGuestHint />
                    </div>

                    <ProviderReviews
                      providerUid={provider.uid}
                      providerName={provider.name}
                      initialAverage={provider.ratingAverage}
                      initialCount={provider.ratingCount}
                    />
                  </div>

                  <aside className="tt-pro-quote">
                    <p className="tt-pro-quote-kicker">{provider.name}</p>
                    {provider.location ? <p className="muted">{provider.location}</p> : null}
                    <SendRequestButton
                      providerUid={provider.uid}
                      providerName={provider.name}
                      intake={intakeDefaults}
                      openByDefault
                      ctaLabel="Kërko ofertë"
                      guestLabel="Hyr për të kërkuar ofertë"
                    />
                    <p className="tt-pro-responds">
                      <Clock size={15} aria-hidden />
                      Zakonisht përgjigjet shpejt
                    </p>
                  </aside>
                </div>
              </>
            ) : null}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
