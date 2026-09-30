import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button, Modal } from '@heroui/react'
import {
  BadgeCheck,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Languages,
  Mail,
  MapPin,
  Star,
} from 'lucide-react'
import { mediaUrl } from '../api/media'
import {
  fetchProviderSchedule,
  type AvailabilitySlot,
} from '../api/availability'
import type { MatchIntake } from '../api/match'
import { fetchService, type ServiceItem } from '../api/services'
import BackButton from '../components/BackButton'
import ProfileAvatar from '../components/ProfileAvatar'
import SendRequestButton from '../components/SendRequestButton'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import StartChatButton from '../components/StartChatButton'
import { getErrorMessage } from '../utils/errors'
import { idFromPublicParam, providerPath as publicProviderPath, servicePath } from '../utils/publicPaths'
import { formatServicePrice, isVerified } from '../utils/serviceDiscovery'
import { marketplaceLink } from '../utils/siteNavMenu'
import './ServiceDetailPage.css'

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

const AVAILABILITY_LABELS: Record<string, string> = {
  request: 'Me kërkesë — ofruesi të përgjigjet kur është i lirë',
  by_arrangement: 'Me marrëveshje — koha caktohet pas kontaktit',
  slots: 'Me orar — zgjidh një orë të lirë',
}

const AVAILABILITY_SHORT: Record<string, string> = {
  request: 'Me kërkesë',
  by_arrangement: 'Me marrëveshje',
  slots: 'Me orar',
}

function ofertatPath(filters: { categoryId?: string; subcategoryId?: string } = {}) {
  const params = new URLSearchParams()
  const categoryId = filters.categoryId?.trim()
  const subcategoryId = filters.subcategoryId?.trim()
  if (categoryId) params.set('categoryId', categoryId)
  if (subcategoryId) params.set('subcategoryId', subcategoryId)
  const query = params.toString()
  return query ? `/ofertat?${query}` : '/ofertat'
}

function money(amount: number, currency?: string) {
  return !currency || currency === 'EUR' ? `€${amount}` : `${amount} ${currency}`
}

function priceSummary(service: ServiceItem): { value: string; note: string } {
  const pricing = service.pricing
  const to = pricing?.amountTo ?? service.details?.priceTo
  if (pricing?.model === 'free') return { value: 'Falas', note: 'Pa kosto për klientin' }
  if (pricing?.model === 'quote' || (!pricing && service.priceFrom == null && to == null)) {
    return { value: 'Sipas ofertës', note: 'Çmimi caktohet pasi ofruesi sheh kërkesën tënde' }
  }
  const from = pricing?.amountFrom ?? service.priceFrom
  if (pricing?.model === 'hourly' && from != null) {
    return { value: `${money(from, pricing.currency)} / orë`, note: 'Çmim për orë' }
  }
  if (pricing?.model === 'fixed' && from != null) {
    return { value: money(from, pricing.currency), note: 'Çmim fiks' }
  }
  if (from != null && to != null && to !== from) {
    return { value: `${money(from, pricing?.currency)} – ${money(to, pricing?.currency)}`, note: 'Diapazoni i çmimit' }
  }
  if (from != null) return { value: `nga ${money(from, pricing?.currency)}`, note: 'Çmimi fillestar' }
  return { value: formatServicePrice(service) || 'Sipas ofertës', note: 'Çmimi përfundimtar konfirmohet nga ofruesi' }
}

function durationLabel(minutes?: number) {
  if (!minutes) return null
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} orë ${rest} min` : `${hours} orë`
}

function includedRows(service: ServiceItem) {
  const details = service.details || {}
  const rows: Array<{ label: string; value: string }> = []
  if (details.serviceTypeDetail) rows.push({ label: 'Lloji', value: details.serviceTypeDetail })
  if (details.offerType) rows.push({ label: 'Oferta', value: OFFER_LABELS[details.offerType] || details.offerType })
  if (details.audience) rows.push({ label: 'Për kë', value: AUDIENCE_LABELS[details.audience] || details.audience })
  if (details.languageFrom && details.languageTo) {
    rows.push({
      label: 'Përkthimi',
      value: `${details.languageFrom} → ${details.languageTo}${details.certifiedTranslation ? ' · i certifikuar' : ''}`,
    })
  }
  if (details.documentsNote) rows.push({ label: 'Dokumente', value: details.documentsNote })
  if (details.deadlineNote) rows.push({ label: 'Afatet', value: details.deadlineNote })
  if (details.licenseVerified) rows.push({ label: 'Licenca', value: 'E verifikuar' })
  if (details.portfolioUrl) rows.push({ label: 'Portfolio', value: details.portfolioUrl })
  if (details.references) rows.push({ label: 'Shembuj pune', value: details.references })
  return rows
}

function keyFacts(service: ServiceItem) {
  const details = service.details || {}
  const facts: Array<{ key: string; icon: typeof MapPin; label: string; value: string; hint?: string }> = []
  facts.push({ key: 'location', icon: MapPin, label: 'Lokacioni', value: service.location || 'Online' })
  if (details.deliveryModes?.length) {
    facts.push({
      key: 'delivery',
      icon: Globe,
      label: 'Si ofrohet',
      value: details.deliveryModes.map((mode) => DELIVERY_LABELS[mode] || mode).join(', '),
    })
  }
  const duration = durationLabel(service.durationMinutes)
  if (duration) facts.push({ key: 'duration', icon: Clock, label: 'Kohëzgjatja', value: duration })
  if (details.supportLanguages?.length) {
    facts.push({ key: 'languages', icon: Languages, label: 'Gjuhët', value: details.supportLanguages.join(', ') })
  }
  if (details.availabilityMode) {
    facts.push({
      key: 'availability',
      icon: CalendarClock,
      label: 'Rezervimi',
      value: AVAILABILITY_SHORT[details.availabilityMode] || details.availabilityMode,
      hint: AVAILABILITY_LABELS[details.availabilityMode],
    })
  }
  return facts
}

function ProviderRatingLine({ average, count }: { average: number; count: number }) {
  if (count <= 0) return <p className="sd-rating is-empty">Ende pa vlerësime</p>
  return (
    <p className="sd-rating">
      <span className="sd-score">
        <Star size={13} aria-hidden />
        {average.toFixed(1)}
      </span>
      <span>{count} {count === 1 ? 'vlerësim' : 'vlerësime'}</span>
    </p>
  )
}

export default function ServiceDetailPage() {
  const { id: param } = useParams<{ id: string }>()
  const id = idFromPublicParam(param)
  const navigate = useNavigate()
  const location = useLocation()
  const [service, setService] = useState<ServiceItem | null>(null)
  const [schedule, setSchedule] = useState<AvailabilitySlot[]>([])
  const [activePhoto, setActivePhoto] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
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
    setActivePhoto(0)
    setViewerOpen(false)
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
    if (!service || service.id !== id) return
    const canonical = servicePath(service)
    if (location.pathname !== canonical) {
      navigate({ pathname: canonical, search: location.search, hash: location.hash }, { replace: true })
    }
  }, [service, id, location.pathname, location.search, location.hash, navigate])

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
  const providerUid = provider?.uid || service?.providerUid || ''
  const providerName = provider?.name || service?.providerName || ''
  const providerPath = publicProviderPath({ uid: providerUid, name: providerName })
  const companyOwned = provider?.providerType === 'business' || provider?.role === 'company'
  const responsibleExpert = companyOwned && service?.responsibleExpert?.uid ? service.responsibleExpert : undefined
  const teamExperts = companyOwned
    ? (service?.experts ?? []).filter((expert) => expert.uid && expert.uid !== responsibleExpert?.uid)
    : []
  const verified = isVerified(provider)
  const categoryLabel = (service?.categoryLabel || service?.category || '').trim()
  const subcategoryLabel = service?.subcategory?.trim() || ''
  const categoryHref = service?.categoryId?.trim() ? ofertatPath({ categoryId: service.categoryId }) : undefined
  const subcategoryHref =
    service?.categoryId?.trim() && service?.subcategoryId?.trim()
      ? ofertatPath({ categoryId: service.categoryId, subcategoryId: service.subcategoryId })
      : undefined
  const gallery = (details.photos || []).map((url) => mediaUrl(url)).filter(Boolean)
  const viewerPhoto = gallery[Math.min(activePhoto, gallery.length - 1)]
  const price = service ? priceSummary(service) : null
  const rows = service ? includedRows(service) : []
  const facts = service ? keyFacts(service) : []
  const openSlots = schedule.filter((slot) => slot.status === 'open').length
  const duration = durationLabel(service?.durationMinutes)
  const providerEmail = provider?.email?.trim() || ''
  const kindLabel = companyOwned ? 'Kompani' : 'Ekspert'

  function openPhoto(index: number) {
    setActivePhoto(index)
    setViewerOpen(true)
  }

  function stepPhoto(delta: number) {
    setActivePhoto((index) => (index + delta + gallery.length) % gallery.length)
  }

  const intake: Pick<MatchIntake, 'need' | 'location' | 'language' | 'urgency' | 'contact'> | null = service
    ? {
        need: `${service.title}${service.subcategory ? ` — ${service.subcategory}` : ''}`,
        location: service.location || 'Online',
        language: 'Albanian',
        urgency: 'flexible',
        contact: 'chat',
      }
    : null

  return (
    <div className="tt-shell">
      <SiteNav />
      <main>
        <section className="tt-section tt-pro-page sd-page">
          <div className="tt-section-inner">
            <BackButton fallback={marketplaceLink('services').to} />
            {loading ? <p className="muted">Duke u ngarkuar…</p> : null}

            {!loading && error ? (
              <div className="tt-detail-empty">
                <h1>Shërbimi nuk u gjet</h1>
                <p className="error">{error}</p>
                <Link className="primary-btn" to="/ofertat">
                  Shiko shërbimet
                </Link>
              </div>
            ) : null}

            {!loading && service && intake && price ? (
              <div className="sd-layout">
                <header className="sd-head">
                  {categoryLabel || subcategoryLabel ? (
                    <ul className="sd-categories" aria-label="Kategoritë">
                      {categoryLabel ? (
                        <li>{categoryHref ? <Link to={categoryHref}>{categoryLabel}</Link> : categoryLabel}</li>
                      ) : null}
                      {subcategoryLabel ? (
                        <li>{subcategoryHref ? <Link to={subcategoryHref}>{subcategoryLabel}</Link> : subcategoryLabel}</li>
                      ) : null}
                    </ul>
                  ) : null}
                  <h1>{service.title}</h1>
                  <div className="sd-byline">
                    <Link
                      to={providerPath}
                      className={`sd-byline-avatar${companyOwned ? ' is-company' : ''}`}
                      aria-label={`Shiko profilin e ${providerName}`}
                    >
                      <ProfileAvatar
                        src={provider?.profilePhoto}
                        seed={providerUid}
                        size="fill"
                        fit={companyOwned ? 'contain' : 'cover'}
                      />
                    </Link>
                    <div className="sd-byline-copy">
                      <p className="sd-byline-name">
                        <Link to={providerPath}>{providerName}</Link>
                        {verified ? <BadgeCheck size={16} className="sd-verified" aria-label="I verifikuar" /> : null}
                        {responsibleExpert ? (
                          <span className="sd-byline-expert">
                            me <Link to={publicProviderPath(responsibleExpert)}>{responsibleExpert.name}</Link>
                          </span>
                        ) : null}
                      </p>
                      <div className="sd-byline-meta">
                        <span>{kindLabel}</span>
                        <ProviderRatingLine average={provider?.ratingAverage ?? 0} count={provider?.ratingCount ?? 0} />
                        {service.location ? (
                          <span className="sd-byline-location">
                            <MapPin size={14} aria-hidden />
                            {service.location}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </header>

                <aside className="sd-aside" aria-label="Kërko shërbimin">
                  <div className="sd-price">
                    <span>Çmimi</span>
                    <strong>{price.value}</strong>
                    <small>{price.note}</small>
                  </div>
                  <ul className="sd-aside-facts">
                    {duration ? (
                      <li>
                        <Clock size={15} aria-hidden />
                        {duration}
                      </li>
                    ) : null}
                    {openSlots > 0 ? (
                      <li>
                        <CalendarClock size={15} aria-hidden />
                        {openSlots === 1 ? '1 orë e lirë' : `${openSlots} orë të lira`}
                      </li>
                    ) : null}
                    <li>
                      <MapPin size={15} aria-hidden />
                      {service.location || 'Online'}
                    </li>
                  </ul>
                  <div className="sd-actions">
                    <SendRequestButton
                      providerUid={service.providerUid}
                      providerId={service.providerId}
                      providerName={providerName}
                      categoryId={service.categoryId}
                      serviceId={service.id}
                      serviceTitle={service.title}
                      intake={intake}
                      compact
                      ctaLabel="Kërko shërbimin"
                      ctaIcon="mail"
                    />
                    <StartChatButton
                      providerUid={service.providerUid}
                      providerName={providerName}
                      serviceId={service.id}
                      serviceTitle={service.title}
                      hideGuestHint
                      label="Live Chat"
                      className="sd-chat"
                    />
                  </div>
                  <div className="sd-aside-provider">
                    <Link
                      to={providerPath}
                      className={`sd-aside-avatar${companyOwned ? ' is-company' : ''}`}
                      aria-label={`Shiko profilin e ${providerName}`}
                    >
                      <ProfileAvatar
                        src={provider?.profilePhoto}
                        seed={providerUid}
                        size="fill"
                        fit={companyOwned ? 'contain' : 'cover'}
                      />
                    </Link>
                    <div className="sd-aside-provider-copy">
                      <span>{kindLabel}</span>
                      <Link to={providerPath}>{providerName}</Link>
                    </div>
                  </div>
                  {providerEmail ? (
                    <a className="sd-aside-contact" href={`mailto:${providerEmail}`}>
                      <Mail size={15} aria-hidden />
                      {providerEmail}
                    </a>
                  ) : null}
                  <Link to={providerPath} className="sd-provider-link">
                    {companyOwned ? 'Shiko profilin e kompanisë' : 'Shiko profilin e ekspertit'}
                    <ChevronRight size={16} aria-hidden />
                  </Link>
                </aside>

                <div className="sd-main">
                  {facts.length > 0 ? (
                    <dl className="sd-facts">
                      {facts.map(({ key, icon: Icon, label, value, hint }) => (
                        <div key={key} title={hint}>
                          <dt>
                            <Icon size={15} aria-hidden />
                            {label}
                          </dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}

                  <div className="sd-content">
                    <section className="sd-section">
                      <h2>Përshkrimi</h2>
                      {service.description ? (
                        <p className="sd-description">{service.description}</p>
                      ) : (
                        <p className="muted">Ofruesi nuk ka shtuar ende një përshkrim.</p>
                      )}
                    </section>

                    {rows.length > 0 || details.regulatoryNotice || details.coachingDisclaimerAccepted ? (
                      <section className="sd-section">
                        <h2>Çfarë përfshin</h2>
                        {rows.length > 0 ? (
                          <dl className="sd-included">
                            {rows.map((row) => (
                              <div key={row.label}>
                                <dt>{row.label}</dt>
                                <dd>
                                  {row.label === 'Portfolio' && row.value.startsWith('http') ? (
                                    <a href={row.value} target="_blank" rel="noreferrer">{row.value}</a>
                                  ) : (
                                    row.value
                                  )}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                        {details.regulatoryNotice ? <p className="sd-notice">{details.regulatoryNotice}</p> : null}
                        {details.coachingDisclaimerAccepted ? (
                          <p className="sd-notice">Coaching nuk është terapi ose trajtim mjekësor.</p>
                        ) : null}
                      </section>
                    ) : null}

                    <section className="sd-section">
                      <h2>Çmimi</h2>
                      <div className="sd-pricing">
                        <strong>{price.value}</strong>
                        <span>{price.note}</span>
                      </div>
                      {duration || details.availabilityMode ? (
                        <dl className="sd-included">
                          {duration ? (
                            <div>
                              <dt>Kohëzgjatja</dt>
                              <dd>{duration}</dd>
                            </div>
                          ) : null}
                          {details.availabilityMode ? (
                            <div>
                              <dt>Rezervimi</dt>
                              <dd>{AVAILABILITY_LABELS[details.availabilityMode] || details.availabilityMode}</dd>
                            </div>
                          ) : null}
                        </dl>
                      ) : null}
                    </section>

                    <section className="sd-section" id="ofruesi">
                      <h2>Kush e ofron këtë shërbim</h2>
                      <div className="sd-provider">
                        <Link
                          to={providerPath}
                          className={`sd-provider-avatar${companyOwned ? ' is-company' : ''}`}
                          aria-label={`Shiko profilin e ${providerName}`}
                        >
                          <ProfileAvatar
                            src={provider?.profilePhoto}
                            seed={providerUid}
                            size="fill"
                            fit={companyOwned ? 'contain' : 'cover'}
                          />
                        </Link>
                        <div className="sd-provider-copy">
                          <span className="sd-provider-kind">{kindLabel}</span>
                          <h3>
                            <Link to={providerPath}>{providerName}</Link>
                            {verified ? <BadgeCheck size={16} className="sd-verified" aria-label="I verifikuar" /> : null}
                          </h3>
                          {provider?.headline ? <p className="sd-provider-headline">{provider.headline}</p> : null}
                          <ProviderRatingLine average={provider?.ratingAverage ?? 0} count={provider?.ratingCount ?? 0} />
                        </div>
                        <Link to={providerPath} className="sd-provider-link">
                          {companyOwned ? 'Profili i kompanisë' : 'Profili i ekspertit'}
                          <ChevronRight size={16} aria-hidden />
                        </Link>
                      </div>

                      {responsibleExpert ? (
                        <div className="sd-provider is-expert">
                          <Link
                            to={publicProviderPath(responsibleExpert)}
                            className="sd-provider-avatar"
                            aria-label={`Shiko profilin e ${responsibleExpert.name}`}
                          >
                            <ProfileAvatar src={responsibleExpert.photoUrl} seed={responsibleExpert.uid} size="fill" />
                          </Link>
                          <div className="sd-provider-copy">
                            <span className="sd-provider-kind">Eksperti përgjegjës</span>
                            <h3>
                              <Link to={publicProviderPath(responsibleExpert)}>{responsibleExpert.name}</Link>
                            </h3>
                            {responsibleExpert.headline ? (
                              <p className="sd-provider-headline">{responsibleExpert.headline}</p>
                            ) : null}
                          </div>
                          <Link to={publicProviderPath(responsibleExpert)} className="sd-provider-link">
                            Profili i ekspertit
                            <ChevronRight size={16} aria-hidden />
                          </Link>
                        </div>
                      ) : null}

                      {teamExperts.length > 0 ? (
                        <div className="sd-team">
                          <h3>Ekspertët e kompanisë</h3>
                          <ul>
                            {teamExperts.map((expert) => (
                              <li key={expert.uid}>
                                <Link to={publicProviderPath(expert)} className="sd-team-person">
                                  <span className="sd-team-photo" aria-hidden>
                                    <ProfileAvatar src={expert.photoUrl} seed={expert.uid} size="fill" />
                                  </span>
                                  <span>
                                    <strong>{expert.name}</strong>
                                    {expert.headline ? <small>{expert.headline}</small> : null}
                                  </span>
                                </Link>
                                <SendRequestButton
                                  providerUid={expert.uid}
                                  providerName={expert.name}
                                  categoryId={service.categoryId}
                                  serviceId={service.id}
                                  serviceTitle={service.title}
                                  intake={intake}
                                  compact
                                  ctaLabel="Cakto takim"
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </section>

                    {gallery.length > 0 ? (
                      <section className="sd-section" aria-labelledby="sd-photos-heading">
                        <h2 id="sd-photos-heading">Fotot</h2>
                        <ul className="sd-photos">
                          {gallery.map((src, index) => (
                            <li key={`${src}-${index}`}>
                              <button type="button" onClick={() => openPhoto(index)} aria-label={`Hap foton ${index + 1}`}>
                                <img src={src} alt="" loading="lazy" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </div>
                </div>

                {viewerPhoto ? (
                  <Modal isOpen={viewerOpen} onOpenChange={setViewerOpen}>
                    <Modal.Backdrop>
                      <Modal.Container size="lg" placement="center">
                        <Modal.Dialog className="sd-viewer" aria-label={`Fotot e shërbimit ${service.title}`}>
                          <Modal.CloseTrigger />
                          <Modal.Body className="sd-viewer-body">
                            <img src={viewerPhoto} alt={`${service.title} — foto ${activePhoto + 1}`} />
                          </Modal.Body>
                          {gallery.length > 1 ? (
                            <Modal.Footer className="sd-viewer-nav">
                              <Button variant="ghost" size="sm" isIconOnly aria-label="Foto e mëparshme" onPress={() => stepPhoto(-1)}>
                                <ChevronLeft size={18} aria-hidden />
                              </Button>
                              <span>{activePhoto + 1} / {gallery.length}</span>
                              <Button variant="ghost" size="sm" isIconOnly aria-label="Foto tjetër" onPress={() => stepPhoto(1)}>
                                <ChevronRight size={18} aria-hidden />
                              </Button>
                            </Modal.Footer>
                          ) : null}
                        </Modal.Dialog>
                      </Modal.Container>
                    </Modal.Backdrop>
                  </Modal>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
