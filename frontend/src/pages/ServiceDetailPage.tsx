import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  Clock,
  Globe,
  Languages,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { mediaUrl } from '../api/media'
import {
  fetchProviderSchedule,
  type AvailabilitySlot,
} from '../api/availability'
import type { MatchIntake } from '../api/match'
import { fetchService, type ServiceItem } from '../api/services'
import ProviderReviews from '../components/ProviderReviews'
import SendRequestButton from '../components/SendRequestButton'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import StartChatButton from '../components/StartChatButton'
import { catalogImageForLabels } from '../data/catalogImages'
import { getErrorMessage } from '../utils/errors'

const DELIVERY_LABELS: Record<string, string> = {
  online: 'Online',
  physical: 'Fizikisht',
  group: 'Grup',
}

const AUDIENCE_LABELS: Record<string, string> = {
  b2c: 'Individë',
  b2b: 'Kompani',
  both: 'Individë & kompani',
}

const OFFER_LABELS: Record<string, string> = {
  package: 'Paketë',
  project: 'Projekt',
  service: 'Shërbim',
}

function formatPrice(service: ServiceItem) {
  const from = service.priceFrom
  const to = service.details?.priceTo
  if (from == null && to == null) return null
  if (from != null && to != null) return `€${from} – €${to}`
  if (from != null) return `nga €${from}`
  return `deri €${to}`
}

function ratingWord(average: number, count: number) {
  if (count <= 0) return 'Ende pa vlerësime'
  if (average >= 4.8) return 'Shkëlqyeshëm'
  if (average >= 4) return 'Shumë mirë'
  if (average >= 3) return 'Mirë'
  return 'Në përmirësim'
}

function detailRows(service: ServiceItem) {
  const details = service.details || {}
  const rows: Array<{ label: string; value: string }> = []
  if (details.serviceTypeDetail) rows.push({ label: 'Lloji', value: details.serviceTypeDetail })
  if (details.offerType) rows.push({ label: 'Oferta', value: OFFER_LABELS[details.offerType] || details.offerType })
  if (details.audience) rows.push({ label: 'Për kë', value: AUDIENCE_LABELS[details.audience] || details.audience })
  if (details.deliveryModes?.length) {
    rows.push({
      label: 'Si ofrohet',
      value: details.deliveryModes.map((mode) => DELIVERY_LABELS[mode] || mode).join(', '),
    })
  }
  if (details.languageFrom && details.languageTo) {
    rows.push({
      label: 'Gjuhët',
      value: `${details.languageFrom} → ${details.languageTo}${
        details.certifiedTranslation ? ' · i certifikuar' : ''
      }`,
    })
  }
  if (details.supportLanguages?.length) rows.push({ label: 'Mbështetje', value: details.supportLanguages.join(', ') })
  if (details.licenseNumber) {
    rows.push({
      label: 'Licenca',
      value: `${details.licenseNumber}${details.licenseVerified ? ' · e verifikuar' : ''}`,
    })
  }
  if (details.documentsNote) rows.push({ label: 'Dokumente', value: details.documentsNote })
  if (details.deadlineNote) rows.push({ label: 'Afatet', value: details.deadlineNote })
  if (details.portfolioUrl) rows.push({ label: 'Portfolio', value: details.portfolioUrl })
  if (details.references) rows.push({ label: 'Referenca', value: details.references })
  return rows
}

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [service, setService] = useState<ServiceItem | null>(null)
  const [schedule, setSchedule] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) {
      setError('Shërbimi nuk u gjet')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    fetchService(id)
      .then((item) => {
        if (!cancelled) setService(item)
      })
      .catch((err) => {
        if (!cancelled) {
          setService(null)
          setError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!service?.providerUid) {
      setSchedule([])
      return
    }
    let cancelled = false
    fetchProviderSchedule(service.providerUid)
      .then((data) => {
        if (!cancelled) setSchedule(data.slots)
      })
      .catch(() => {
        if (!cancelled) setSchedule([])
      })
    return () => {
      cancelled = true
    }
  }, [service?.providerUid])

  const details = service?.details || {}
  const provider = service?.provider
  const photo = mediaUrl(provider?.profilePhoto)
  const price = service ? formatPrice(service) : null
  const rows = service ? detailRows(service) : []
  const rating = provider?.ratingAverage ?? 0
  const ratingCount = provider?.ratingCount ?? 0
  const categoryLabel = service?.categoryLabel || service?.category || ''
  const cover = service ? catalogImageForLabels(service.subcategory, categoryLabel) : ''
  const uploadedPhotos = (details.photos || []).map((url) => mediaUrl(url)).filter(Boolean)
  const gallery = uploadedPhotos.length ? uploadedPhotos : [cover, photo].filter(Boolean)
  const aboutText = provider?.bio || service?.description || ''
  const chips = [
    service?.subcategory,
    ...(details.deliveryModes?.map((mode) => DELIVERY_LABELS[mode] || mode) || []),
    ...(provider?.skills?.slice(0, 6) || []),
  ].filter(Boolean) as string[]
  const intake: Pick<MatchIntake, 'need' | 'location' | 'language' | 'urgency' | 'contact'> | null = service
    ? {
        need: `${service.title}${service.subcategory ? ` — ${service.subcategory}` : ''}`,
        location: service.location || 'Online',
        language: 'Albanian',
        urgency: 'flexible',
        contact: 'chat',
      }
    : null

  const facts = service
    ? [
        service.location ? { icon: MapPin, label: service.location } : null,
        details.deliveryModes?.length
          ? { icon: Globe, label: details.deliveryModes.map((mode) => DELIVERY_LABELS[mode] || mode).join(', ') }
          : null,
        details.licenseVerified || details.licenseNumber
          ? { icon: ShieldCheck, label: details.licenseVerified ? 'Licencë e verifikuar' : `Licenca ${details.licenseNumber}` }
          : null,
        provider?.languages?.length ? { icon: Languages, label: provider.languages.join(', ') } : null,
        price ? { icon: Wallet, label: price } : null,
        provider?.roleLabel ? { icon: BadgeCheck, label: provider.roleLabel } : null,
        schedule.some((slot) => slot.status === 'open')
          ? { icon: Clock, label: `${schedule.filter((slot) => slot.status === 'open').length} orë të lira` }
          : null,
      ].filter(Boolean) as Array<{ icon: typeof MapPin; label: string }>
    : []

  const why = service
    ? `${provider?.name || service.providerName} ofron ${service.title.toLowerCase()} në ${
        service.location || 'Kosovë'
      }. ${provider?.headline || 'Dërgo kërkesë për të marrë një ofertë dhe të fillosh bashkëpunimin.'}`
    : ''

  return (
    <div className="tt-shell">
      <SiteNav />
      <main>
        <section className="tt-section tt-pro-page">
          <div className="tt-section-inner">
            {loading ? <p className="muted">Duke u ngarkuar…</p> : null}

            {!loading && error ? (
              <div className="tt-detail-empty">
                <h1>Shërbimi nuk u gjet</h1>
                <p className="error">{error}</p>
                <Link className="primary-btn" to="/ofertat">
                  Shiko ofertat
                </Link>
              </div>
            ) : null}

            {!loading && service && intake ? (
              <>
                <nav className="tt-pro-crumbs" aria-label="Breadcrumb">
                  <Link to="/ofertat">Ofertat</Link>
                  {categoryLabel ? <span>{categoryLabel}</span> : null}
                  <span>{service.title}</span>
                </nav>
                <Link to="/ofertat" className="tt-detail-back">
                  <ArrowLeft size={16} aria-hidden />
                  Shiko më shumë ofrues
                </Link>

                <div className="tt-pro-layout">
                    <header className="tt-pro-hero">
                      <div className="tt-pro-avatar" aria-hidden>
                        {photo ? <img src={photo} alt="" /> : <span>{(provider?.name || service.providerName).slice(0, 1)}</span>}
                      </div>
                      <div className="tt-pro-hero-copy">
                        <h1>{provider?.name || service.providerName}</h1>
                        <p className="tt-pro-rating">
                          <strong>{ratingWord(rating, ratingCount)}</strong>
                          {ratingCount > 0 ? (
                            <>
                              <span className="tt-pro-rating-score">{rating.toFixed(1)}</span>
                              <span className="tt-pro-stars" aria-hidden>
                                {'★'.repeat(Math.max(1, Math.round(rating)))}
                                {'☆'.repeat(Math.max(0, 5 - Math.round(rating)))}
                              </span>
                              <a href="#vleresimet">({ratingCount})</a>
                            </>
                          ) : null}
                        </p>
                        <p className="tt-pro-kicker">
                          {service.title}
                          {service.subcategory ? ` · ${service.subcategory}` : ''}
                          {service.location ? ` · ${service.location}` : ''}
                        </p>
                      </div>
                    </header>

                  <div className="tt-pro-main">

                    <nav className="tt-pro-tabs" aria-label="Seksionet e profilit">
                      <a href="#rreth">Rreth</a>
                      <a href="#sherbimi">Shërbimi</a>
                      <a href="#foto">Foto</a>
                      <a href="#vleresimet">Vlerësimet</a>
                    </nav>

                    <div className="tt-pro-why">
                      <p>
                        <MessageCircle size={16} aria-hidden />
                        <strong>Pse ky ofrues?</strong>
                      </p>
                      <p>{why}</p>
                    </div>

                    <section className="tt-pro-section" id="rreth">
                      <h2>Rreth</h2>
                      {aboutText ? <p className="tt-detail-desc">{aboutText}</p> : <p className="muted">Ofruesi nuk ka shtuar ende një përshkrim.</p>}
                    </section>

                    {facts.length > 0 ? (
                      <section className="tt-pro-section">
                        <h2>Përmbledhje</h2>
                        <ul className="tt-pro-facts">
                          {facts.map((fact) => {
                            const Icon = fact.icon
                            return (
                              <li key={fact.label}>
                                <Icon size={18} aria-hidden />
                                <span>{fact.label}</span>
                              </li>
                            )
                          })}
                        </ul>
                      </section>
                    ) : null}

                    <section className="tt-pro-section" id="sherbimi">
                      <h2>Shërbimi</h2>
                      {service.description && service.description !== aboutText ? (
                        <p className="tt-detail-desc">{service.description}</p>
                      ) : null}
                      {chips.length > 0 ? (
                        <ul className="service-card-chips">
                          {chips.map((chip) => (
                            <li key={chip}>{chip}</li>
                          ))}
                        </ul>
                      ) : null}
                      {rows.length > 0 || details.regulatoryNotice || details.coachingDisclaimerAccepted ? (
                        <div className="service-card-details">
                          {rows.length > 0 ? (
                            <dl>
                              {rows.map((row) => (
                                <div key={row.label}>
                                  <dt>{row.label}</dt>
                                  <dd>
                                    {row.label === 'Portfolio' && row.value.startsWith('http') ? (
                                      <a href={row.value} target="_blank" rel="noreferrer">
                                        {row.value}
                                      </a>
                                    ) : (
                                      row.value
                                    )}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                          {details.regulatoryNotice ? <p className="service-card-notice">{details.regulatoryNotice}</p> : null}
                          {details.coachingDisclaimerAccepted ? (
                            <p className="service-card-notice">Coaching nuk është terapi ose trajtim mjekësor.</p>
                          ) : null}
                        </div>
                      ) : null}
                    </section>

                    <section className="tt-pro-section" id="foto">
                      <h2>Projekte dhe foto</h2>
                      {gallery.length > 0 ? (
                        <div className="tt-pro-gallery">
                          {gallery.map((src, index) => (
                            <img
                              key={`${src}-${index}`}
                              src={src}
                              alt={index === 0 ? service.subcategory || service.title : `Foto ${index + 1}`}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="muted">Ofruesi nuk ka ngarkuar ende foto të punës.</p>
                      )}
                    </section>

                    <div className="tt-pro-contact-row">
                      <StartChatButton
                        providerUid={service.providerUid}
                        providerName={provider?.name || service.providerName}
                        serviceId={service.id}
                        serviceTitle={service.title}
                        hideGuestHint
                      />
                    </div>

                    <ProviderReviews
                      providerUid={service.providerUid}
                      providerName={provider?.name || service.providerName}
                      initialAverage={rating}
                      initialCount={ratingCount}
                      onStatsChange={(stats) => {
                        setService((current) =>
                          current?.provider
                            ? {
                                ...current,
                                provider: {
                                  ...current.provider,
                                  ratingAverage: stats.average,
                                  ratingCount: stats.count,
                                },
                              }
                            : current,
                        )
                      }}
                    />
                  </div>

                  <aside className="tt-pro-quote">
                    <p className="tt-pro-quote-kicker">{provider?.name || service.providerName}</p>
                    {price ? <p className="tt-detail-price">{price}</p> : null}
                    <p className="muted">{service.location || 'Online'}</p>
                    <SendRequestButton
                      providerUid={service.providerUid}
                      providerId={service.providerId}
                      providerName={provider?.name || service.providerName}
                      categoryId={service.categoryId}
                      serviceId={service.id}
                      serviceTitle={service.title}
                      intake={intake}
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
