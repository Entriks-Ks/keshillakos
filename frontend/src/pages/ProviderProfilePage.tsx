import { useEffect, useMemo, useState } from 'react'
import { toast } from '@heroui/react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Share2 } from 'lucide-react'
import { mediaUrl } from '../api/media'
import {
  fetchProviderSchedule,
  type AvailabilitySlot,
} from '../api/availability'
import { fetchProviderProfile, type PublicExpert, type PublicProvider } from '../api/providers'
import type { ServiceItem } from '../api/services'
import type { MatchIntake } from '../api/match'
import ProviderReviews from '../components/ProviderReviews'
import SendRequestButton from '../components/SendRequestButton'
import ServiceCard from '../components/ServiceCard'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import StartChatButton from '../components/StartChatButton'
import { catalogImageForLabels } from '../data/catalogImages'
import { getErrorMessage } from '../utils/errors'
import './ProviderProfilePage.css'

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
  const [experts, setExperts] = useState<PublicExpert[]>([])
  const [schedule, setSchedule] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'availability' | 'services' | 'reviews' | 'more'>('overview')

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
        setExperts(data.experts ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setProvider(null)
        setServices([])
        setExperts([])
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
  const uploadedCover = mediaUrl(provider?.coverPhoto)
  const cover = uploadedCover || (firstService
    ? catalogImageForLabels(firstService.subcategory, firstService.categoryLabel || firstService.category)
    : catalogImageForLabels(provider?.roleLabel))
  const gallery = (() => {
    const uploaded = services.flatMap((item) => (item.details?.photos || []).map((url) => mediaUrl(url))).filter(Boolean)
    if (uploaded.length) return uploaded.slice(0, 8)
    return [cover, photo].filter(Boolean)
  })()
  const openDays = useMemo(() => {
    const groups = new Map<string, AvailabilitySlot[]>()
    for (const slot of schedule) {
      if (slot.status !== 'open') continue
      const key = new Date(slot.startAt).toDateString()
      const list = groups.get(key) ?? []
      list.push(slot)
      groups.set(key, list)
    }
    return [...groups.entries()]
      .sort((a, b) => +new Date(a[1][0].startAt) - +new Date(b[1][0].startAt))
      .map(([, slots]) => {
        const date = new Date(slots[0].startAt)
        return {
          key: slots[0].id,
          weekday: date.toLocaleDateString('sq-AL', { weekday: 'short' }),
          day: date.getDate(),
          month: date.toLocaleDateString('sq-AL', { month: 'short' }),
          count: slots.length,
        }
      })
  }, [schedule])

  async function shareProfile() {
    const url = window.location.href
    const title = provider?.name || 'Profili'
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
    } catch {
      return
    }
    await navigator.clipboard.writeText(url)
    toast.success('Linku i profilit u kopjua.')
  }

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
              <article className="kk-profile">
                <Link to="/ofertat" className="tt-detail-back">
                  <ArrowLeft size={16} aria-hidden />
                  Shiko më shumë ofrues
                </Link>
                <div className="kk-profile-cover">
                  {cover ? <img src={cover} alt="" /> : null}
                  <button type="button" className="kk-profile-share" onClick={() => void shareProfile()}>
                    <Share2 size={16} aria-hidden />
                    Ndaj profilin
                  </button>
                </div>

                <div className="kk-profile-grid">
                  <aside className="kk-profile-card">
                    <div className="kk-profile-avatar">
                      {photo ? <img src={photo} alt="" /> : <span>{provider.name.slice(0, 1)}</span>}
                    </div>
                    <h1>{provider.name}</h1>
                    <p className="kk-profile-role">{provider.headline || provider.roleLabel}</p>
                    {provider.location ? <p className="kk-profile-location">{provider.location}</p> : null}
                    <p className="kk-profile-rating">
                      <strong>{ratingWord(provider.ratingAverage, provider.ratingCount)}</strong>
                      {provider.ratingCount > 0 ? ` · ${provider.ratingAverage.toFixed(1)} (${provider.ratingCount})` : ''}
                    </p>
                    <div className="kk-profile-actions">
                      <StartChatButton
                        providerUid={provider.uid}
                        providerName={provider.name}
                        hideGuestHint
                        label=""
                        className="kk-profile-chat"
                      />
                      <SendRequestButton
                        providerUid={provider.uid}
                        providerName={provider.name}
                        intake={intakeDefaults}
                        compact
                        ctaLabel="Cakto takim"
                        guestLabel="Hyr për takim"
                      />
                    </div>
                    {provider.skills && provider.skills.length > 0 ? (
                      <div className="kk-profile-skills">
                        <h2>Ekspert në</h2>
                        <ul className="kk-profile-chips">
                          {provider.skills.map((skill) => (
                            <li key={skill}>{skill}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </aside>

                  <div className="kk-profile-panel">
                    <div className="kk-profile-tabs" role="tablist" aria-label="Seksionet e profilit">
                      {([
                        ['overview', 'Përmbledhje'],
                        ['availability', 'Disponueshmëria'],
                        ['services', 'Shërbimet'],
                        ['reviews', 'Vlerësimet'],
                        ['more', 'Më shumë'],
                      ] as const).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          role="tab"
                          aria-selected={tab === id}
                          className={tab === id ? 'is-active' : undefined}
                          onClick={() => setTab(id)}
                        >
                          {label}
                          {id === 'reviews' && provider.ratingCount > 0 ? ` (${provider.ratingCount})` : ''}
                        </button>
                      ))}
                    </div>

                    {tab === 'overview' ? (
                      <div className="kk-profile-sections">
                        <div className="kk-profile-split">
                          <section className="kk-profile-block">
                            <h2>Si e përshkruaj veten</h2>
                            <p>{provider.bio || 'Ofruesi nuk ka shtuar ende një përshkrim.'}</p>
                          </section>
                          <section className="kk-profile-block">
                            <h2>Orët e lira</h2>
                            {openDays.length === 0 ? (
                              <p className="muted">Nuk ka orë të hapura.</p>
                            ) : (
                              <div className="kk-profile-days">
                                {openDays.slice(0, 4).map((day) => (
                                  <div key={day.key} className="kk-profile-day">
                                    <span>{day.weekday}</span>
                                    <strong>{day.day}</strong>
                                    <span>{day.month}</span>
                                    <span>{day.count} {day.count === 1 ? 'orë' : 'orë'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </section>
                        </div>
                        {provider.headline ? (
                          <section className="kk-profile-block">
                            <h2>Çfarë ofroj</h2>
                            <p>{provider.headline}</p>
                          </section>
                        ) : null}
                        {experts.length > 0 ? (
                          <section className="kk-profile-block">
                            <h2>Ekspertët ({experts.length})</h2>
                            <ul className="kk-profile-experts">
                              {experts.map((expert) => {
                                const expertPhoto = mediaUrl(expert.photoUrl)
                                return (
                                  <li key={expert.uid}>
                                    <Link to={`/providers/${expert.uid}`} className="kk-profile-person">
                                      {expertPhoto ? <img src={expertPhoto} alt="" /> : <span>{expert.name.slice(0, 1)}</span>}
                                      <span>
                                        <strong>{expert.name}</strong>
                                        {expert.headline ? <small>{expert.headline}</small> : null}
                                      </span>
                                    </Link>
                                    <div className="kk-profile-expert-actions">
                                      <StartChatButton providerUid={expert.uid} providerName={expert.name} compact hideGuestHint label="Shkruaj" />
                                      <SendRequestButton
                                        providerUid={expert.uid}
                                        providerName={expert.name}
                                        intake={{
                                          need: expert.headline || `Takim me ${expert.name}`,
                                          location: provider.location || 'Online',
                                          language: 'Albanian',
                                          urgency: 'flexible',
                                          contact: 'chat',
                                        }}
                                        compact
                                        ctaLabel="Cakto takim"
                                        guestLabel="Hyr për takim"
                                      />
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          </section>
                        ) : null}
                      </div>
                    ) : null}

                    {tab === 'availability' ? (
                      <div className="kk-profile-sections">
                        <section className="kk-profile-block">
                          <h2>Disponueshmëria</h2>
                          {openDays.length === 0 ? (
                            <p className="muted">Nuk ka orë të hapura.</p>
                          ) : (
                            <div className="kk-profile-days">
                              {openDays.map((day) => (
                                <div key={day.key} className="kk-profile-day">
                                  <span>{day.weekday}</span>
                                  <strong>{day.day}</strong>
                                  <span>{day.month}</span>
                                  <span>{day.count} orë</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      </div>
                    ) : null}

                    {tab === 'services' ? (
                      <div className="kk-profile-sections">
                        {services.length === 0 ? (
                          <p className="muted">Ky ofrues nuk ka ende shërbime të publikuara.</p>
                        ) : (
                          <div className="tt-offers-grid">
                            {services.map((service) => (
                              <ServiceCard key={service.id} service={service} mode="compact" />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {tab === 'reviews' ? (
                      <div className="kk-profile-sections">
                        <ProviderReviews
                          providerUid={provider.uid}
                          providerName={provider.name}
                          initialAverage={provider.ratingAverage}
                          initialCount={provider.ratingCount}
                          onStatsChange={(stats) => {
                            setProvider((current) =>
                              current
                                ? { ...current, ratingAverage: stats.average, ratingCount: stats.count }
                                : current,
                            )
                          }}
                        />
                      </div>
                    ) : null}

                    {tab === 'more' ? (
                      <div className="kk-profile-sections">
                        <section className="kk-profile-block">
                          <h2>Gjuhët</h2>
                          {provider.languages && provider.languages.length > 0 ? (
                            <ul className="kk-profile-chips">
                              {provider.languages.map((language) => (
                                <li key={language}>{language}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="muted">Nuk ka gjuhë të shtuara.</p>
                          )}
                        </section>
                        {gallery.length > 0 ? (
                          <section className="kk-profile-block">
                            <h2>Foto</h2>
                            <div className="tt-pro-gallery">
                              {gallery.map((src, index) => (
                                <img key={`${src}-${index}`} src={src} alt="" />
                              ))}
                            </div>
                          </section>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
