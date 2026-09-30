import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, buttonVariants, Card, Chip, Skeleton, toast, Tooltip } from '@heroui/react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  ExternalLink,
  Globe,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Share2,
  Star,
  Users,
  Video,
} from 'lucide-react'
import { mediaUrl } from '../api/media'
import {
  fetchProviderSchedule,
  type AvailabilitySlot,
} from '../api/availability'
import {
  fetchProviderProfile,
  type PublicExpert,
  type PublicProvider,
  type PublicProviderProfile,
} from '../api/providers'
import type { MonthYear } from '../api/providerProfiles'
import type { ServiceItem } from '../api/services'
import type { MatchIntake } from '../api/match'
import { SOCIAL_LINK_KEYS, SOCIAL_LINK_LABELS } from '../api/socialLinks'
import BackButton from '../components/BackButton'
import ProfileAvatar from '../components/ProfileAvatar'
import ProviderReviews from '../components/ProviderReviews'
import SendRequestButton from '../components/SendRequestButton'
import ServiceMediaPlaceholder from '../components/ServiceMediaPlaceholder'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import SocialIcon from '../components/SocialIcon'
import StartChatButton from '../components/StartChatButton'
import { isProviderVerified } from '../components/providerCardUtils'
import { humanLabels } from '../utils/displayLabels'
import { getErrorMessage } from '../utils/errors'
import { idFromPublicParam, providerPath, servicePath } from '../utils/publicPaths'
import { formatServicePrice } from '../utils/serviceDiscovery'
import { marketplaceLink } from '../utils/siteNavMenu'
import './PublicProfile.css'

const MODE_LABELS: Record<'online' | 'on_site', string> = {
  online: 'Online',
  on_site: 'Në vend',
}

function externalHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function displayUrl(url: string) {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '')
}

function formatMonthYear(value?: MonthYear) {
  if (!value?.year) return ''
  return new Date(value.year, Math.max(0, (value.month || 1) - 1), 1)
    .toLocaleDateString('sq-AL', { month: 'short', year: 'numeric' })
}

function formatPeriod(from?: MonthYear, to?: MonthYear, current?: boolean) {
  const start = formatMonthYear(from)
  const end = current ? 'Tani' : formatMonthYear(to)
  return [start, end].filter(Boolean).join(' – ')
}

function yearsLabel(years: number) {
  return years === 1 ? '1 vit përvojë' : `${years} vite përvojë`
}

function Section({
  title,
  meta,
  id,
  className,
  children,
}: {
  title: string
  meta?: ReactNode
  id?: string
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={`pp-card${className ? ` ${className}` : ''}`} id={id}>
      <Card.Header className="pp-card-head">
        <h2 className="pp-card-title">{title}</h2>
        {meta}
      </Card.Header>
      <Card.Content className="pp-card-body">{children}</Card.Content>
    </Card>
  )
}

function ProfileSkeleton() {
  return (
    <div className="pp-layout" aria-hidden>
      <Card className="pp-card pp-hero">
        <div className="pp-hero-body">
          <Skeleton className="pp-avatar pp-skel-avatar" />
          <div className="pp-identity">
            <Skeleton className="pp-skel-line is-title" />
            <Skeleton className="pp-skel-line" />
            <Skeleton className="pp-skel-line is-short" />
          </div>
        </div>
      </Card>
      <div className="pp-grid">
        <div className="pp-main">
          {[0, 1].map((i) => (
            <Card key={i} className="pp-card">
              <Card.Content className="pp-card-body pp-skel-block">
                <Skeleton className="pp-skel-line is-short" />
                <Skeleton className="pp-skel-line is-wide" />
                <Skeleton className="pp-skel-line is-wide" />
                <Skeleton className="pp-skel-line" />
              </Card.Content>
            </Card>
          ))}
        </div>
        <div className="pp-side">
          <Card className="pp-card">
            <Card.Content className="pp-card-body pp-skel-block">
              <Skeleton className="pp-skel-line is-short" />
              <Skeleton className="pp-skel-line is-wide" />
              <Skeleton className="pp-skel-line" />
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ServiceRow({ service }: { service: ServiceItem }) {
  const path = servicePath(service)
  const photo = mediaUrl(service.details?.photos?.[0])
  const price = formatServicePrice(service)
  const tags = humanLabels([service.categoryLabel, service.subcategory], [service.categoryId, service.subcategoryId ?? ''])
  const description = service.description?.trim()

  return (
    <li className="pp-service">
      <Link to={path} className="pp-service-media" tabIndex={-1} aria-hidden>
        {photo ? <img src={photo} alt="" loading="lazy" /> : <ServiceMediaPlaceholder compact />}
      </Link>
      <div className="pp-service-body">
        <div className="pp-service-top">
          <Link to={path} className="pp-service-title">{service.title}</Link>
          {price ? <strong className="pp-service-price">{price}</strong> : null}
        </div>
        {tags.length ? (
          <div className="pp-chips is-tight">
            {tags.map((tag) => (
              <Chip key={tag} size="sm" variant="soft">
                <Chip.Label>{tag}</Chip.Label>
              </Chip>
            ))}
          </div>
        ) : null}
        {description ? <p className="pp-service-desc">{description}</p> : null}
        <div className="pp-service-foot">
          {service.location ? (
            <span><MapPin size={14} aria-hidden />{service.location}</span>
          ) : <span />}
          <Link to={path} className="pp-text-link">
            Shiko shërbimin
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </li>
  )
}

export default function ProviderProfilePage() {
  const { uid: param } = useParams<{ uid: string }>()
  const uid = idFromPublicParam(param)
  const navigate = useNavigate()
  const location = useLocation()
  const [provider, setProvider] = useState<PublicProvider | null>(null)
  const [profile, setProfile] = useState<PublicProviderProfile | null>(null)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [experts, setExperts] = useState<PublicExpert[]>([])
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
        setProfile(data.profile)
        setServices(data.services)
        setExperts(data.experts ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setProvider(null)
        setProfile(null)
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
    if (!provider || provider.uid !== uid) return
    const canonical = providerPath(provider)
    if (location.pathname !== canonical) {
      navigate({ pathname: canonical, search: location.search, hash: location.hash }, { replace: true })
    }
  }, [provider, uid, location.pathname, location.search, location.hash, navigate])

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

  const isCompany = provider?.role === 'company'
  const displayLocation = profile?.location || provider?.location || ''
  const intakeDefaults: Pick<
    MatchIntake,
    'need' | 'location' | 'language' | 'urgency' | 'contact'
  > = {
    need: provider?.headline || `Këshillim me ${provider?.name || 'ofruesin'}`,
    location: displayLocation || 'Online',
    language: 'Albanian',
    urgency: 'flexible',
    contact: 'chat',
  }
  const cover = mediaUrl(provider?.coverPhoto)
  const gallery = services
    .flatMap((item) => (item.details?.photos || []).map((url) => mediaUrl(url)))
    .filter(Boolean)
    .slice(0, 8)
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

  const backFallback = provider
    ? marketplaceLink(provider.role === 'company' ? 'companies' : 'experts').to
    : '/ofertat'

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

  const specialties = profile
    ? humanLabels([...profile.specializations, ...profile.categoryLabels], profile.categories)
    : provider?.skills ?? []
  const name = profile?.name || provider?.name || ''
  const photo = profile?.photoUrl || provider?.profilePhoto
  const title = isCompany
    ? specialties[0] || provider?.headline || 'Kompani'
    : profile?.title?.trim() || provider?.headline || specialties[0] || 'Ekspert'
  const about = profile?.about || provider?.bio || ''
  const languages = profile?.languages.length ? profile.languages : provider?.languages ?? []
  const verified = profile ? isProviderVerified(profile) : false
  const phone = profile?.publicPhone?.trim()
  const email = profile?.publicEmail?.trim()
  const website = profile?.website?.trim()
  const socialEntries = SOCIAL_LINK_KEYS
    .map((key) => [key, profile?.socialLinks[key]?.trim() || ''] as const)
    .filter(([, url]) => url)
  const workExperience = profile?.workExperience ?? []
  const education = profile?.education ?? []
  const certifications = profile?.certifications ?? []

  return (
    <div className="tt-shell">
      <SiteNav />
      <main className="pp">
        <div className="pp-inner">
          <BackButton fallback={backFallback} />

          {loading ? <ProfileSkeleton /> : null}

          {!loading && error ? (
            <Card className="pp-card pp-missing">
              <Card.Content className="pp-card-body">
                <h1>Profili nuk u gjet</h1>
                <p>{error}</p>
                <Link className={buttonVariants({ variant: 'primary' })} to="/ofertat">
                  Shiko ofertat
                </Link>
              </Card.Content>
            </Card>
          ) : null}

          {!loading && provider ? (
            <article className="pp-layout">
              <Card className="pp-card pp-hero">
                {cover ? (
                  <div className="pp-cover">
                    <img src={cover} alt="" />
                  </div>
                ) : null}
                <div className={`pp-hero-body${cover ? ' has-cover' : ''}`}>
                  <ProfileAvatar
                    src={photo}
                    seed={provider.uid}
                    alt={name}
                    size="fill"
                    fit={isCompany ? 'contain' : 'cover'}
                    className="pp-avatar"
                  />
                  <div className="pp-identity">
                    <div className="pp-name">
                      <h1>{name}</h1>
                      {verified ? (
                        <Chip size="sm" variant="soft" color="success">
                          <BadgeCheck size={14} aria-hidden />
                          <Chip.Label>I verifikuar</Chip.Label>
                        </Chip>
                      ) : null}
                    </div>
                    <p className="pp-title">{title}</p>
                    <ul className="pp-meta">
                      <li>
                        {isCompany ? <Building2 size={15} aria-hidden /> : <Briefcase size={15} aria-hidden />}
                        {isCompany ? 'Kompani' : 'Ekspert'}
                      </li>
                      {displayLocation ? <li><MapPin size={15} aria-hidden />{displayLocation}</li> : null}
                      {profile?.yearsOfExperience != null ? (
                        <li><Award size={15} aria-hidden />{yearsLabel(profile.yearsOfExperience)}</li>
                      ) : null}
                      {profile?.modes.length ? (
                        <li><Video size={15} aria-hidden />{profile.modes.map((mode) => MODE_LABELS[mode]).join(' · ')}</li>
                      ) : null}
                      {isCompany && profile?.expertCount ? (
                        <li><Users size={15} aria-hidden />{profile.expertCount === 1 ? '1 ekspert' : `${profile.expertCount} ekspertë`}</li>
                      ) : null}
                      {!isCompany && profile?.companyName ? (
                        <li><Building2 size={15} aria-hidden />{profile.companyName}</li>
                      ) : null}
                      <li>
                        <a href="#vleresimet" className="pp-rating">
                          <Star size={15} aria-hidden className={provider.ratingCount > 0 ? 'is-filled' : undefined} />
                          {provider.ratingCount > 0
                            ? `${provider.ratingAverage.toFixed(1)} (${provider.ratingCount} ${provider.ratingCount === 1 ? 'vlerësim' : 'vlerësime'})`
                            : 'Ende pa vlerësime'}
                        </a>
                      </li>
                    </ul>
                  </div>
                  <div className="pp-hero-actions">
                    <SendRequestButton
                      providerUid={provider.uid}
                      providerName={provider.name}
                      intake={intakeDefaults}
                      compact
                      ctaLabel="Cakto takim"
                      guestLabel="Hyr për takim"
                    />
                    <StartChatButton
                      providerUid={provider.uid}
                      providerName={provider.name}
                      hideGuestHint
                      label="Dërgo mesazh"
                      className="pp-chat-btn"
                    />
                    <Tooltip delay={300}>
                      <Button isIconOnly variant="outline" aria-label="Ndaj profilin" onPress={() => void shareProfile()}>
                        <Share2 size={17} />
                      </Button>
                      <Tooltip.Content placement="bottom">Ndaj profilin</Tooltip.Content>
                    </Tooltip>
                  </div>
                </div>
              </Card>

              <div className="pp-grid">
                <div className="pp-main">
                  <Section title={isCompany ? 'Rreth nesh' : 'Rreth meje'}>
                    {about ? (
                      <p className="pp-about">{about}</p>
                    ) : (
                      <p className="pp-muted">Ofruesi nuk ka shtuar ende një përshkrim.</p>
                    )}
                    {specialties.length ? (
                      <div className="pp-subsection">
                        <h3>{isCompany ? 'Fushat e shërbimit' : 'Specializimet'}</h3>
                        <div className="pp-chips">
                          {specialties.map((item) => (
                            <Chip key={item} variant="soft" color="accent">
                              <Chip.Label>{item}</Chip.Label>
                            </Chip>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </Section>

                  <Section
                    title="Shërbimet"
                    id="sherbimet"
                    meta={services.length ? <span className="pp-card-meta">{services.length}</span> : null}
                  >
                    {services.length ? (
                      <ul className="pp-services">
                        {services.map((service) => <ServiceRow key={service.id} service={service} />)}
                      </ul>
                    ) : (
                      <p className="pp-muted">Ky ofrues nuk ka ende shërbime të publikuara.</p>
                    )}
                  </Section>

                  {workExperience.length ? (
                    <Section title="Përvoja e punës">
                      <ul className="pp-timeline">
                        {workExperience.map((entry, index) => (
                          <li key={`${entry.position}-${entry.organization}-${index}`}>
                            <span className="pp-timeline-icon"><Briefcase size={16} aria-hidden /></span>
                            <div>
                              <strong>{entry.position}</strong>
                              <span>{entry.organization}</span>
                              <small>{formatPeriod(entry.from, entry.to, entry.current)}</small>
                              {entry.description ? <p>{entry.description}</p> : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  ) : null}

                  {education.length ? (
                    <Section title="Arsimimi">
                      <ul className="pp-timeline">
                        {education.map((entry, index) => (
                          <li key={`${entry.institution}-${entry.degree}-${index}`}>
                            <span className="pp-timeline-icon"><GraduationCap size={16} aria-hidden /></span>
                            <div>
                              <strong>{entry.institution}</strong>
                              <span>{[entry.degree, entry.fieldOfStudy].filter(Boolean).join(' · ')}</span>
                              <small>{formatPeriod(entry.from, entry.to, entry.current)}</small>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  ) : null}

                  {certifications.length ? (
                    <Section title="Certifikimet">
                      <ul className="pp-timeline">
                        {certifications.map((entry, index) => (
                          <li key={`${entry.name}-${index}`}>
                            <span className="pp-timeline-icon"><Award size={16} aria-hidden /></span>
                            <div>
                              <strong>{entry.name}</strong>
                              <span>{[entry.issuer, entry.year].filter(Boolean).join(' · ')}</span>
                              {entry.credentialUrl ? (
                                <a href={externalHref(entry.credentialUrl)} target="_blank" rel="noopener noreferrer" className="pp-text-link">
                                  Shiko certifikatën
                                  <ExternalLink size={13} aria-hidden />
                                </a>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  ) : null}

                  {experts.length > 0 ? (
                    <Section title="Ekspertët" meta={<span className="pp-card-meta">{experts.length}</span>}>
                      <ul className="pp-experts">
                        {experts.map((expert) => (
                          <li key={expert.uid}>
                            <Link to={providerPath(expert)} className="pp-person">
                              <ProfileAvatar src={expert.photoUrl} seed={expert.uid} alt="" size={44} />
                              <span>
                                <strong>{expert.name}</strong>
                                {expert.headline ? <small>{expert.headline}</small> : null}
                              </span>
                            </Link>
                            <div className="pp-person-actions">
                              <StartChatButton providerUid={expert.uid} providerName={expert.name} compact hideGuestHint label="Shkruaj" className="pp-chat-btn is-sm" />
                              <SendRequestButton
                                providerUid={expert.uid}
                                providerName={expert.name}
                                intake={{
                                  need: expert.headline || `Takim me ${expert.name}`,
                                  location: displayLocation || 'Online',
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
                        ))}
                      </ul>
                    </Section>
                  ) : null}

                  {gallery.length > 0 ? (
                    <Section title="Galeria">
                      <div className="pp-gallery">
                        {gallery.map((src, index) => (
                          <img key={`${src}-${index}`} src={src} alt="" loading="lazy" />
                        ))}
                      </div>
                    </Section>
                  ) : null}

                  <Card className="pp-card pp-reviews">
                    <Card.Content className="pp-card-body">
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
                    </Card.Content>
                  </Card>
                </div>

                <aside className="pp-side">
                  {phone || email || website ? (
                    <Section title="Kontakt">
                      <ul className="pp-contact">
                        {phone ? (
                          <li>
                            <a href={`tel:${phone.replace(/\s+/g, '')}`}>
                              <span className="pp-contact-icon"><Phone size={16} aria-hidden /></span>
                              <span><small>Thirr</small>{phone}</span>
                            </a>
                          </li>
                        ) : null}
                        {email ? (
                          <li>
                            <a href={`mailto:${email}`}>
                              <span className="pp-contact-icon"><Mail size={16} aria-hidden /></span>
                              <span><small>Email</small>{email}</span>
                            </a>
                          </li>
                        ) : null}
                        {website ? (
                          <li>
                            <a href={externalHref(website)} target="_blank" rel="noopener noreferrer">
                              <span className="pp-contact-icon"><Globe size={16} aria-hidden /></span>
                              <span><small>Website</small>{displayUrl(website)}</span>
                            </a>
                          </li>
                        ) : null}
                      </ul>
                    </Section>
                  ) : null}

                  <Section title="Disponueshmëria">
                    {openDays.length === 0 ? (
                      <p className="pp-muted">Nuk ka orë të hapura për momentin.</p>
                    ) : (
                      <>
                        <div className="pp-days">
                          {openDays.slice(0, 6).map((day) => (
                            <div key={day.key} className="pp-day">
                              <span>{day.weekday}</span>
                              <strong>{day.day}</strong>
                              <span>{day.month}</span>
                              <small>{day.count} orë</small>
                            </div>
                          ))}
                        </div>
                        {openDays.length > 6 ? (
                          <p className="pp-muted pp-days-more">
                            <CalendarDays size={14} aria-hidden />
                            +{openDays.length - 6} ditë të tjera me orë të lira
                          </p>
                        ) : null}
                      </>
                    )}
                  </Section>

                  {languages.length ? (
                    <Section title="Gjuhët">
                      <div className="pp-chips">
                        {languages.map((language) => (
                          <Chip key={language} variant="soft">
                            <Chip.Label>{language}</Chip.Label>
                          </Chip>
                        ))}
                      </div>
                    </Section>
                  ) : null}

                  {socialEntries.length ? (
                    <Section title="Rrjetet sociale">
                      <ul className="pp-social">
                        {socialEntries.map(([key, url]) => (
                          <li key={key}>
                            <a href={externalHref(url)} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LINK_LABELS[key]}>
                              <SocialIcon name={key} size={17} />
                              <span>{SOCIAL_LINK_LABELS[key]}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  ) : null}
                </aside>
              </div>
            </article>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
