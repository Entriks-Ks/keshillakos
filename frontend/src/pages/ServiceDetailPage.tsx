import KeshillaPagination from '../components/KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { uiText } from '../i18n'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Breadcrumbs, Button, buttonVariants, Card, Chip, Modal, Separator, Skeleton } from '@heroui/react'
import {
  BadgeCheck,
  Briefcase,
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
import { AiTrustBadge } from '../components/ai/AiTrustBadge'
import './ServiceDetailPage.css'

function deliveryLabel(mode: string) {
  if (mode === 'physical') return uiText('Fizikisht', 'In person', 'Vor Ort')
  if (mode === 'group') return uiText('Grup', 'Group', 'Gruppe')
  if (mode === 'online') return 'Online'
  return mode
}

function audienceLabel(audience: string) {
  if (audience === 'b2c') return uiText('Individë', 'Individuals', 'Privatpersonen')
  if (audience === 'b2b') return uiText('Kompani', 'Companies', 'Unternehmen')
  if (audience === 'both') return uiText('Individë & kompani', 'Individuals & companies', 'Privatpersonen & Unternehmen')
  return audience
}

function offerLabel(offer: string) {
  if (offer === 'package') return uiText('Paketë', 'Package', 'Paket')
  if (offer === 'project') return uiText('Projekt', 'Project', 'Projekt')
  if (offer === 'service') return uiText('Shërbim', 'Service', 'Dienst')
  return offer
}

function availabilityLabel(mode: string) {
  if (mode === 'request') return uiText('Me kërkesë — ofruesi të përgjigjet kur është i lirë', 'On request — the provider replies when free', 'Auf Anfrage — der Anbieter antwortet, wenn er Zeit hat')
  if (mode === 'by_arrangement') return uiText('Me marrëveshje — koha caktohet pas kontaktit', 'By agreement — the time is set after contact', 'Nach Vereinbarung — die Zeit wird nach dem Kontakt festgelegt')
  if (mode === 'slots') return uiText('Me orar — zgjidh një orë të lirë', 'By schedule — pick a free hour', 'Nach Termin — wähle eine freie Stunde')
  return mode
}

function availabilityShort(mode: string) {
  if (mode === 'request') return uiText('Me kërkesë', 'On request', 'Auf Anfrage')
  if (mode === 'by_arrangement') return uiText('Me marrëveshje', 'By agreement', 'Nach Vereinbarung')
  if (mode === 'slots') return uiText('Me orar', 'By schedule', 'Nach Termin')
  return mode
}

const GALLERY_VISIBLE = 5

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
  if (pricing?.model === 'free') return { value: uiText('Falas', 'Free', 'Kostenlos'), note: uiText('Pa kosto për klientin', 'No cost for the client', 'Keine Kosten für den Kunden') }
  if (pricing?.model === 'quote' || (!pricing && service.priceFrom == null && to == null)) {
    return { value: uiText('Sipas ofertës', 'On quote', 'Nach Angebot'), note: uiText('Çmimi caktohet pasi ofruesi sheh kërkesën tënde', 'The price is set after the provider sees your request', 'Der Preis wird festgelegt, nachdem der Anbieter deine Anfrage sieht') }
  }
  const from = pricing?.amountFrom ?? service.priceFrom
  if (pricing?.model === 'hourly' && from != null) {
    return { value: `${money(from, pricing.currency)} / ${uiText('orë', 'hour', 'Stunde')}`, note: uiText('Çmim për orë', 'Price per hour', 'Preis pro Stunde') }
  }
  if (pricing?.model === 'fixed' && from != null) {
    return { value: money(from, pricing.currency), note: uiText('Çmim fiks', 'Fixed price', 'Festpreis') }
  }
  if (from != null && to != null && to !== from) {
    return { value: `${money(from, pricing?.currency)} – ${money(to, pricing?.currency)}`, note: uiText('Diapazoni i çmimit', 'Price range', 'Preisspanne') }
  }
  if (from != null) return { value: `${uiText('nga', 'from', 'ab')} ${money(from, pricing?.currency)}`, note: uiText('Çmimi fillestar', 'Starting price', 'Startpreis') }
  return { value: formatServicePrice(service) || uiText('Sipas ofertës', 'On quote', 'Nach Angebot'), note: uiText('Çmimi përfundimtar konfirmohet nga ofruesi', 'The final price is confirmed by the provider', 'Der Endpreis wird vom Anbieter bestätigt') }
}

function durationLabel(minutes?: number) {
  if (!minutes) return null
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} ${uiText('orë', 'h', 'Std.')} ${rest} min` : `${hours} ${uiText('orë', 'h', 'Std.')}`
}

function includedRows(service: ServiceItem) {
  const details = service.details || {}
  const rows: Array<{ label: string; value: string }> = []
  if (details.serviceTypeDetail) rows.push({ label: uiText('Lloji', 'Type', 'Art'), value: details.serviceTypeDetail })
  if (details.offerType) rows.push({ label: uiText('Oferta', 'Offer', 'Angebot'), value: offerLabel(details.offerType) })
  if (details.audience) rows.push({ label: uiText('Për kë', 'For whom', 'Für wen'), value: audienceLabel(details.audience) })
  if (details.languageFrom && details.languageTo) {
    rows.push({
      label: uiText('Përkthimi', 'Translation', 'Übersetzung'),
      value: `${details.languageFrom} → ${details.languageTo}${details.certifiedTranslation ? ` · ${uiText('i certifikuar', 'certified', 'zertifiziert')}` : ''}`,
    })
  }
  if (details.documentsNote) rows.push({ label: uiText('Dokumente', 'Documents', 'Dokumente'), value: details.documentsNote })
  if (details.deadlineNote) rows.push({ label: uiText('Afatet', 'Deadlines', 'Fristen'), value: details.deadlineNote })
  if (details.licenseVerified) rows.push({ label: uiText('Licenca', 'License', 'Lizenz'), value: uiText('E verifikuar', 'Verified', 'Verifiziert') })
  if (details.portfolioUrl) rows.push({ label: 'Portfolio', value: details.portfolioUrl })
  if (details.references) rows.push({ label: uiText('Shembuj pune', 'Work samples', 'Arbeitsbeispiele'), value: details.references })
  return rows
}

function keyFacts(service: ServiceItem) {
  const details = service.details || {}
  const facts: Array<{ key: string; icon: typeof MapPin; label: string; value: string; hint?: string }> = []
  facts.push({ key: 'location', icon: MapPin, label: uiText('Lokacioni', 'Location', 'Ort'), value: service.location || 'Online' })
  if (details.deliveryModes?.length) {
    facts.push({
      key: 'delivery',
      icon: Globe,
      label: uiText('Si ofrohet', 'How it’s offered', 'Wie es angeboten wird'),
      value: details.deliveryModes.map((mode) => deliveryLabel(mode)).join(', '),
    })
  }
  const duration = durationLabel(service.durationMinutes)
  if (duration) facts.push({ key: 'duration', icon: Clock, label: uiText('Kohëzgjatja', 'Duration', 'Dauer'), value: duration })
  if (details.supportLanguages?.length) {
    facts.push({ key: 'languages', icon: Languages, label: uiText('Gjuhët', 'Languages', 'Sprachen'), value: details.supportLanguages.join(', ') })
  }
  if (details.availabilityMode) {
    facts.push({
      key: 'availability',
      icon: CalendarClock,
      label: uiText('Rezervimi', 'Booking', 'Buchung'),
      value: availabilityShort(details.availabilityMode),
      hint: availabilityLabel(details.availabilityMode),
    })
  }
  return facts
}

function ProviderRatingLine({ average, count }: { average: number; count: number }) {
  if (count <= 0) return <span className="sd-rating is-empty">{uiText('Ende pa vlerësime', 'No ratings yet', 'Noch keine Bewertungen')}</span>
  return (
    <span className="sd-rating">
      <Star size={13} aria-hidden />
      <strong>{average.toFixed(1)}</strong>
      <span>({count} {count === 1 ? uiText('vlerësim', 'rating', 'Bewertung') : uiText('vlerësime', 'ratings', 'Bewertungen')})</span>
    </span>
  )
}

function Section({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <Card className="sd-card" id={id}>
      <Card.Header className="sd-card-head">
        <h2 className="sd-card-title" id={id ? `${id}-title` : undefined}>{title}</h2>
      </Card.Header>
      <Card.Content className="sd-card-body">{children}</Card.Content>
    </Card>
  )
}

function Gallery({ photos, title, onOpen }: { photos: string[]; title: string; onOpen: (index: number) => void }) {
  const visible = photos.slice(0, GALLERY_VISIBLE)
  const hidden = photos.length - visible.length
  return (
    <ul className={`sd-gallery is-${visible.length}`}>
      {visible.map((src, index) => {
        const isLast = index === visible.length - 1
        return (
          <li key={`${src}-${index}`}>
            <button
              type="button"
              onClick={() => onOpen(index)}
              aria-label={hidden > 0 && isLast
                ? uiText(`Shiko të gjitha ${photos.length} fotot`, `View all ${photos.length} photos`, `Alle ${photos.length} Fotos ansehen`)
                : uiText(`Hap foton ${index + 1}`, `Open photo ${index + 1}`, `Foto ${index + 1} öffnen`)}
            >
              <img src={src} alt={`${title} — ${uiText('foto', 'photo', 'Foto')} ${index + 1}`} loading="lazy" />
              {hidden > 0 && isLast ? <span className="sd-gallery-more">+{hidden}</span> : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function DetailSkeleton() {
  return (
    <div className="sd-layout" aria-hidden>
      <Card className="sd-card sd-hero">
        <Card.Content className="sd-hero-body sd-skel">
          <Skeleton className="sd-skel-line is-short" />
          <Skeleton className="sd-skel-line is-title" />
          <Skeleton className="sd-skel-line is-mid" />
          <Skeleton className="sd-skel-line is-wide" />
        </Card.Content>
      </Card>
      <div className="sd-body">
        <Card className="sd-card">
          <Card.Content className="sd-card-body sd-skel">
            <Skeleton className="sd-skel-line is-short" />
            <Skeleton className="sd-skel-line is-wide" />
            <Skeleton className="sd-skel-line is-mid" />
          </Card.Content>
        </Card>
      </div>
      <div className="sd-aside">
        <Card className="sd-card">
          <Card.Content className="sd-card-body sd-skel">
            <Skeleton className="sd-skel-line is-short" />
            <Skeleton className="sd-skel-line is-title" />
            <Skeleton className="sd-skel-button" />
            <Skeleton className="sd-skel-button" />
          </Card.Content>
        </Card>
      </div>
    </div>
  )
}

export default function ServiceDetailPage() {
  const { i18n } = useTranslation()
  void i18n.language
  const { id: param } = useParams<{ id: string }>()
  const id = idFromPublicParam(param)
  const navigate = useNavigate()
  const location = useLocation()
  const teamPaging = usePagination(id)
  const [service, setService] = useState<ServiceItem | null>(null)
  const [schedule, setSchedule] = useState<AvailabilitySlot[]>([])
  const [activePhoto, setActivePhoto] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) {
      setError(uiText('Shërbimi nuk u gjet', 'Service not found', 'Dienst nicht gefunden'))
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    setActivePhoto(0)
    setViewerOpen(false)
    fetchService(id, { page: teamPaging.page, limit: 12 })
      .then((item) => {
        if (!cancelled) { setService(item); if (item.expertsPagination) teamPaging.receivePagination(item.expertsPagination) }
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
  }, [id, teamPaging.page])

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
  const providerHeadline = provider?.headline?.trim() || ''
  const providerLocation = provider?.location?.trim() || ''
  const providerBio = provider?.bio?.trim() || ''
  const providerYears = provider?.yearsOfExperience && provider.yearsOfExperience > 0 ? provider.yearsOfExperience : 0
  const kindLabel = companyOwned ? uiText('Kompani', 'Company', 'Unternehmen') : uiText('Ekspert', 'Expert', 'Experte')
  const availabilityNote = details.availabilityMode ? availabilityLabel(details.availabilityMode) : undefined
  const hasIncluded = rows.length > 0 || Boolean(details.regulatoryNotice) || Boolean(details.coachingDisclaimerAccepted)

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
      <main className="sd">
        <div className="sd-inner">
          <div className="sd-topbar">
            <BackButton fallback={marketplaceLink('services').to} />
          </div>

          {loading ? <DetailSkeleton /> : null}

          {!loading && error ? (
            <Card className="sd-card sd-missing">
              <Card.Content className="sd-card-body">
                <h1>{uiText('Shërbimi nuk u gjet', 'Service not found', 'Dienst nicht gefunden')}</h1>
                <p>{error}</p>
                <Link className={buttonVariants({ variant: 'primary', size: 'md' })} to="/ofertat">
                  {uiText('Shiko shërbimet', 'View services', 'Dienste ansehen')}
                </Link>
              </Card.Content>
            </Card>
          ) : null}

          {!loading && service && intake && price ? (
            <div className="sd-layout">
              <Card className="sd-card sd-hero">
                <Card.Content className="sd-hero-body">
                  <Breadcrumbs className="sd-crumbs">
                    <Breadcrumbs.Item href={marketplaceLink('services').to}>{uiText('Shërbimet', 'Services', 'Dienste')}</Breadcrumbs.Item>
                    {categoryLabel ? (
                      <Breadcrumbs.Item href={categoryHref}>{categoryLabel}</Breadcrumbs.Item>
                    ) : null}
                    {subcategoryLabel ? (
                      <Breadcrumbs.Item href={subcategoryHref}>{subcategoryLabel}</Breadcrumbs.Item>
                    ) : null}
                    <Breadcrumbs.Item>{service.title}</Breadcrumbs.Item>
                  </Breadcrumbs>

                  <h1 className="sd-title">{service.title}</h1>

                  <div className="sd-byline">
                    <Link
                      to={providerPath}
                      className={`sd-byline-avatar${companyOwned ? ' is-company' : ''}`}
                      aria-label={uiText(`Shiko profilin e ${providerName}`, `View ${providerName}'s profile`, `Profil von ${providerName} ansehen`)}
                    >
                      <ProfileAvatar
                        src={provider?.profilePhoto}
                        seed={providerUid}
                        size="fill"
                        fit={companyOwned ? 'contain' : 'cover'}
                      />
                    </Link>
                    <div className="sd-byline-copy">
                      <p className="sd-byline-text">
                        <Link to={providerPath} className="sd-byline-name">{providerName}</Link>
                        {verified ? <BadgeCheck size={15} className="sd-verified" aria-label={uiText('I verifikuar', 'Verified', 'Verifiziert')} /> : null}
                        {responsibleExpert ? (
                          <span className="sd-byline-expert">
                            {uiText('me', 'with', 'mit')} <Link to={publicProviderPath(responsibleExpert)}>{responsibleExpert.name}</Link>
                          </span>
                        ) : null}
                      </p>
                      <p className="sd-byline-meta">
                        <span>{kindLabel}</span>
                        <ProviderRatingLine average={provider?.ratingAverage ?? 0} count={provider?.ratingCount ?? 0} />
                        {providerUid ? (
                          <AiTrustBadge providerUid={providerUid} providerName={providerName} compact />
                        ) : null}
                      </p>
                    </div>
                  </div>

                  {facts.length > 0 ? (
                    <>
                      <Separator className="sd-hero-sep" />
                      <dl className="sd-facts">
                        {facts.map(({ key, icon: Icon, label, value, hint }) => (
                          <div key={key} title={hint}>
                            <dt>
                              <Icon size={14} aria-hidden />
                              {label}
                            </dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  ) : null}
                </Card.Content>
              </Card>

              <aside className="sd-aside" aria-label={uiText('Kërko shërbimin', 'Request the service', 'Dienst anfragen')}>
                <Card className="sd-card sd-book">
                  <Card.Content className="sd-book-body">
                    <div className="sd-price">
                      <span className="sd-label">{uiText('Çmimi', 'Price', 'Preis')}</span>
                      <strong>{price.value}</strong>
                      <small>{price.note}</small>
                    </div>

                    <ul className="sd-book-facts">
                      {duration ? (
                        <li>
                          <Clock size={15} aria-hidden />
                          {duration}
                        </li>
                      ) : null}
                      {openSlots > 0 ? (
                        <li>
                          <CalendarClock size={15} aria-hidden />
                          {openSlots === 1
                            ? uiText('1 orë e lirë', '1 free hour', '1 freie Stunde')
                            : uiText(`${openSlots} orë të lira`, `${openSlots} free hours`, `${openSlots} freie Stunden`)}
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
                        ctaLabel={uiText('Kërko shërbimin', 'Request the service', 'Dienst anfragen')}
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

                    {availabilityNote ? <p className="sd-book-note">{availabilityNote}</p> : null}

                    {providerUid ? (
                      <AiTrustBadge
                        providerUid={providerUid}
                        providerName={providerName}
                        className="sd-ai-trust-badge"
                      />
                    ) : null}

                    <Separator />

                    <div className="sd-book-provider">
                      <Link
                        to={providerPath}
                        className={`sd-book-avatar${companyOwned ? ' is-company' : ''}`}
                        aria-label={uiText(`Shiko profilin e ${providerName}`, `View ${providerName}'s profile`, `Profil von ${providerName} ansehen`)}
                      >
                        <ProfileAvatar
                          src={provider?.profilePhoto}
                          seed={providerUid}
                          size="fill"
                          fit={companyOwned ? 'contain' : 'cover'}
                        />
                      </Link>
                      <div className="sd-book-provider-copy">
                        <span className="sd-label">{kindLabel}</span>
                        <Link to={providerPath}>{providerName}</Link>
                      </div>
                    </div>
                    {providerEmail ? (
                      <a className="sd-book-contact" href={`mailto:${providerEmail}`}>
                        <Mail size={15} aria-hidden />
                        {providerEmail}
                      </a>
                    ) : null}
                  </Card.Content>
                </Card>
              </aside>

              <div className="sd-body">
                <Section title={uiText('Përshkrimi', 'Description', 'Beschreibung')}>
                  {service.description ? (
                    <p className="sd-description">{service.description}</p>
                  ) : (
                    <p className="sd-muted">{uiText('Ofruesi nuk ka shtuar ende një përshkrim.', 'The provider has not added a description yet.', 'Der Anbieter hat noch keine Beschreibung hinzugefügt.')}</p>
                  )}
                </Section>

                {hasIncluded ? (
                  <Section title={uiText('Çfarë përfshin', 'What’s included', 'Was enthalten ist')}>
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
                      <p className="sd-notice">{uiText('Coaching nuk është terapi ose trajtim mjekësor.', 'Coaching is not therapy or medical treatment.', 'Coaching ist keine Therapie und keine medizinische Behandlung.')}</p>
                    ) : null}
                  </Section>
                ) : null}

                {gallery.length > 0 ? (
                  <Section title={uiText('Fotot', 'Photos', 'Fotos')} id="sd-photos">
                    <Gallery photos={gallery} title={service.title} onOpen={openPhoto} />
                  </Section>
                ) : null}

                <Section title={uiText('Kush e ofron këtë shërbim', 'Who offers this service', 'Wer diesen Dienst anbietet')} id="ofruesi">
                  <div className="sd-provider">
                    <Link
                      to={providerPath}
                      className={`sd-provider-avatar${companyOwned ? ' is-company' : ''}`}
                      aria-label={uiText(`Shiko profilin e ${providerName}`, `View ${providerName}'s profile`, `Profil von ${providerName} ansehen`)}
                    >
                      <ProfileAvatar
                        src={provider?.profilePhoto}
                        seed={providerUid}
                        size="fill"
                        fit={companyOwned ? 'contain' : 'cover'}
                      />
                    </Link>
                    <div className="sd-provider-copy">
                      <div className="sd-provider-name">
                        <h3>
                          <Link to={providerPath}>{providerName}</Link>
                        </h3>
                        {verified ? (
                          <Chip size="sm" variant="soft" color="success">
                            <BadgeCheck size={12} aria-hidden />
                            <Chip.Label>{uiText('I verifikuar', 'Verified', 'Verifiziert')}</Chip.Label>
                          </Chip>
                        ) : null}
                      </div>
                      <p className="sd-provider-title">{providerHeadline || kindLabel}</p>
                      <ul className="sd-provider-meta">
                        {providerHeadline ? <li>{kindLabel}</li> : null}
                        {providerLocation ? (
                          <li>
                            <MapPin size={14} aria-hidden />
                            {providerLocation}
                          </li>
                        ) : null}
                        {providerYears ? (
                          <li>
                            <Briefcase size={14} aria-hidden />
                            {providerYears === 1
                              ? uiText('1 vit përvojë', '1 year of experience', '1 Jahr Erfahrung')
                              : uiText(`${providerYears} vite përvojë`, `${providerYears} years of experience`, `${providerYears} Jahre Erfahrung`)}
                          </li>
                        ) : null}
                        <li>
                          <ProviderRatingLine average={provider?.ratingAverage ?? 0} count={provider?.ratingCount ?? 0} />
                        </li>
                      </ul>
                    </div>
                    <Link
                      to={providerPath}
                      className={`${buttonVariants({ variant: 'outline', size: 'sm' })} sd-provider-link`}
                    >
                      {companyOwned
                        ? uiText('Profili i kompanisë', 'Company profile', 'Unternehmensprofil')
                        : uiText('Profili i ekspertit', 'Expert profile', 'Expertenprofil')}
                      <ChevronRight size={15} aria-hidden />
                    </Link>
                  </div>

                  {providerBio ? <p className="sd-provider-bio">{providerBio}</p> : null}

                  {responsibleExpert || teamExperts.length > 0 ? <Separator className="sd-provider-sep" /> : null}

                  {responsibleExpert ? (
                    <div className="sd-people">
                      <h4 className="sd-label">{uiText('Eksperti përgjegjës', 'Responsible expert', 'Verantwortlicher Experte')}</h4>
                      <div className="sd-person">
                        <Link to={publicProviderPath(responsibleExpert)} className="sd-person-link">
                          <span className="sd-person-photo" aria-hidden>
                            <ProfileAvatar src={responsibleExpert.photoUrl} seed={responsibleExpert.uid} size="fill" />
                          </span>
                          <span className="sd-person-copy">
                            <strong>{responsibleExpert.name}</strong>
                            {responsibleExpert.headline ? <small>{responsibleExpert.headline}</small> : null}
                          </span>
                        </Link>
                        <Link to={publicProviderPath(responsibleExpert)} className="sd-text-link">
                          {uiText('Profili', 'Profile', 'Profil')}
                          <ChevronRight size={15} aria-hidden />
                        </Link>
                      </div>
                    </div>
                  ) : null}

                  {teamExperts.length > 0 ? (
                    <div className="sd-people">
                      <h4 className="sd-label">{uiText('Ekspertët e kompanisë', 'Company experts', 'Experten des Unternehmens')}</h4>
                      <ul>
                        {teamExperts.map((expert) => (
                          <li key={expert.uid} className="sd-person">
                            <Link to={publicProviderPath(expert)} className="sd-person-link">
                              <span className="sd-person-photo" aria-hidden>
                                <ProfileAvatar src={expert.photoUrl} seed={expert.uid} size="fill" />
                              </span>
                              <span className="sd-person-copy">
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
                              ctaLabel={uiText('Cakto takim', 'Book a meeting', 'Termin buchen')}
                            />
                          </li>
                        ))}
                      </ul>
                      <KeshillaPagination pagination={teamPaging.pagination} onPageChange={teamPaging.setPage} />
                    </div>
                  ) : null}
                </Section>
              </div>

              {viewerPhoto ? (
                <Modal isOpen={viewerOpen} onOpenChange={setViewerOpen}>
                  <Modal.Backdrop>
                    <Modal.Container size="lg" placement="center">
                      <Modal.Dialog className="sd-viewer" aria-label={uiText(`Fotot e shërbimit ${service.title}`, `Photos of ${service.title}`, `Fotos von ${service.title}`)}>
                        <Modal.CloseTrigger />
                        <Modal.Body className="sd-viewer-body">
                          <img src={viewerPhoto} alt={`${service.title} — ${uiText('foto', 'photo', 'Foto')} ${activePhoto + 1}`} />
                        </Modal.Body>
                        {gallery.length > 1 ? (
                          <Modal.Footer className="sd-viewer-nav">
                            <Button variant="ghost" size="sm" isIconOnly aria-label={uiText('Foto e mëparshme', 'Previous photo', 'Vorheriges Foto')} onPress={() => stepPhoto(-1)}>
                              <ChevronLeft size={18} aria-hidden />
                            </Button>
                            <span>{activePhoto + 1} / {gallery.length}</span>
                            <Button variant="ghost" size="sm" isIconOnly aria-label={uiText('Foto tjetër', 'Next photo', 'Nächstes Foto')} onPress={() => stepPhoto(1)}>
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
      </main>
      <SiteFooter />
    </div>
  )
}
