import { usePagination } from '../hooks/usePagination'
import KeshillaPagination from '../components/KeshillaPagination'
import { emptyPagination, type PaginationMeta } from '../api/pagination'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import i18n, { uiText } from '../i18n'
import { Button, buttonVariants, Card, Chip, Skeleton, toast, Tooltip } from '@heroui/react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  ExternalLink,
  Globe,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Scale,
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
import { AiTrustBadge } from '../components/ai/AiTrustBadge'
import { AiTrustRecommendationsCard } from '../components/ai/AiTrustRecommendationsCard'
import { useAuth } from '../auth/AuthContext'
import { useCompareLawyers } from '../hooks/useCompareLawyers'
import './PublicProfile.css'

function dateLocale() {
  const language = (i18n.language || 'sq').toLowerCase()
  if (language.startsWith('de')) return 'de-DE'
  if (language.startsWith('en')) return 'en-GB'
  return 'sq-AL'
}

function modeLabel(mode: 'online' | 'on_site') {
  if (mode === 'on_site') return uiText('Në vend', 'On site', 'Vor Ort')
  return 'Online'
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
    .toLocaleDateString(dateLocale(), { month: 'short', year: 'numeric' })
}

function formatPeriod(from?: MonthYear, to?: MonthYear, current?: boolean) {
  const start = formatMonthYear(from)
  const end = current ? uiText('Tani', 'Now', 'Jetzt') : formatMonthYear(to)
  return [start, end].filter(Boolean).join(' – ')
}

function yearsLabel(years: number) {
  return years === 1
    ? uiText('1 vit përvojë', '1 year of experience', '1 Jahr Erfahrung')
    : uiText(`${years} vite përvojë`, `${years} years of experience`, `${years} Jahre Erfahrung`)
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
  const { i18n: ui } = useTranslation()
  void ui.language
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
            {uiText('Shiko shërbimin', 'View service', 'Dienst ansehen')}
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </li>
  )
}

export default function ProviderProfilePage() {
  const { user } = useAuth()
  const { i18n: ui } = useTranslation()
  void ui.language
  const { uid: param } = useParams<{ uid: string }>()
  const uid = idFromPublicParam(param)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const parsePage = (value: string | null) => { const number = Number(value || 1); return Number.isSafeInteger(number) && number > 0 ? number : 1 }
  const page = parsePage(searchParams.get('page'))
  const expertsPage = parsePage(searchParams.get('expertsPage'))
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination)
  const [expertsPagination, setExpertsPagination] = useState<PaginationMeta>(emptyPagination)
  function changePage(key: string, value: number) {
    setSearchParams((current) => { const next = new URLSearchParams(current); if (value > 1) next.set(key, String(value)); else next.delete(key); return next })
  }
  const [provider, setProvider] = useState<PublicProvider | null>(null)
  const [profile, setProfile] = useState<PublicProviderProfile | null>(null)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [experts, setExperts] = useState<PublicExpert[]>([])
  const schedulePaging = usePagination(uid)
  const [schedule, setSchedule] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { isLawyerSelected, toggleLawyer } = useCompareLawyers()
  const compared = uid ? isLawyerSelected(uid) : false

  useEffect(() => {
    if (!uid) {
      setError('Profili nuk u gjet')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    fetchProviderProfile(uid, { page, expertsPage, limit: 12 })
      .then((data) => {
        if (cancelled) return
        setProvider(data.provider)
        setProfile(data.profile)
        setServices(data.services)
        setPagination(data.pagination)
        setExpertsPagination(data.expertsPagination)
        if (data.pagination.page !== page || data.expertsPagination.page !== expertsPage) {
          setSearchParams((current) => {
            const next = new URLSearchParams(current)
            for (const [key, value] of [['page', data.pagination.page], ['expertsPage', data.expertsPagination.page]] as const) {
              if (value > 1) next.set(key, String(value)); else next.delete(key)
            }
            return next
          }, { replace: true })
        }
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
  }, [uid, page, expertsPage])

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
    fetchProviderSchedule(provider.uid, { page: schedulePaging.page, limit: 50 })
      .then((data) => {
        if (!cancelled) { setSchedule(data.slots); schedulePaging.receivePagination(data.pagination) }
      })
      .catch(() => {
        if (!cancelled) setSchedule([])
      })

    return () => {
      cancelled = true
    }
  }, [provider?.uid, schedulePaging.page])

  const isCompany = provider?.role === 'company'
  const displayLocation = profile?.location || provider?.location || ''
  const intakeDefaults: Pick<
    MatchIntake,
    'need' | 'location' | 'language' | 'urgency' | 'contact'
  > = {
    need: provider?.headline || uiText(`Këshillim me ${provider?.name || 'ofruesin'}`, `Advice with ${provider?.name || 'the provider'}`, `Beratung mit ${provider?.name || 'dem Anbieter'}`),
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
          weekday: date.toLocaleDateString(dateLocale(), { weekday: 'short' }),
          day: date.getDate(),
          month: date.toLocaleDateString(dateLocale(), { month: 'short' }),
          count: slots.length,
        }
      })
  }, [schedule, ui.language])

  const backFallback = provider
    ? marketplaceLink(provider.role === 'company' ? 'companies' : 'experts').to
    : '/ofertat'

  async function shareProfile() {
    const url = window.location.href
    const title = provider?.name || uiText('Profili', 'Profile', 'Profil')
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
    } catch {
      return
    }
    await navigator.clipboard.writeText(url)
    toast.success(uiText('Linku i profilit u kopjua.', 'Profile link copied.', 'Profillink kopiert.'))
  }

  const specialties = profile
    ? humanLabels([...profile.specializations, ...profile.categoryLabels], profile.categories)
    : provider?.skills ?? []
  const name = profile?.name || provider?.name || ''
  const photo = profile?.photoUrl || provider?.profilePhoto
  const title = isCompany
    ? specialties[0] || provider?.headline || uiText('Kompani', 'Company', 'Unternehmen')
    : profile?.title?.trim() || provider?.headline || specialties[0] || uiText('Ekspert', 'Expert', 'Experte')
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
    <div className="tt-shell pp-page">
      <SiteNav />
      <main className="pp">
        <div className="pp-inner">
          <BackButton fallback={backFallback} />

          {loading ? <ProfileSkeleton /> : null}

          {!loading && error ? (
            <Card className="pp-card pp-missing">
              <Card.Content className="pp-card-body">
                <h1>{uiText('Profili nuk u gjet', 'Profile not found', 'Profil nicht gefunden')}</h1>
                <p>{error}</p>
                <Link className={buttonVariants({ variant: 'primary' })} to="/ofertat">
                  {uiText('Shiko ofertat', 'View offers', 'Angebote ansehen')}
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
                      {provider.plan === 'pro' ? (
                        <Chip size="sm" variant="soft" color="accent">
                          <Chip.Label>Pro</Chip.Label>
                        </Chip>
                      ) : null}
                      {verified ? (
                        <Chip size="sm" variant="soft" color="success">
                          <BadgeCheck size={14} aria-hidden />
                          <Chip.Label>{uiText('I verifikuar', 'Verified', 'Verifiziert')}</Chip.Label>
                        </Chip>
                      ) : null}
                    </div>
                    <p className="pp-title">{title}</p>
                    <ul className="pp-meta">
                      <li>
                        {isCompany ? <Building2 size={15} aria-hidden /> : <Briefcase size={15} aria-hidden />}
                        {isCompany ? uiText('Kompani', 'Company', 'Unternehmen') : uiText('Ekspert', 'Expert', 'Experte')}
                      </li>
                      {displayLocation ? <li><MapPin size={15} aria-hidden />{displayLocation}</li> : null}
                      {profile?.yearsOfExperience != null ? (
                        <li><Award size={15} aria-hidden />{yearsLabel(profile.yearsOfExperience)}</li>
                      ) : null}
                      {profile?.modes.length ? (
                        <li><Video size={15} aria-hidden />{profile.modes.map((mode) => modeLabel(mode)).join(' · ')}</li>
                      ) : null}
                      {isCompany && profile?.expertCount ? (
                        <li><Users size={15} aria-hidden />{profile.expertCount === 1 ? uiText('1 ekspert', '1 expert', '1 Experte') : uiText(`${profile.expertCount} ekspertë`, `${profile.expertCount} experts`, `${profile.expertCount} Experten`)}</li>
                      ) : null}
                      {!isCompany && profile?.companyName ? (
                        <li><Building2 size={15} aria-hidden />{profile.companyName}</li>
                      ) : null}
                      <li>
                        <a href="#vleresimet" className="pp-rating">
                          <Star size={15} aria-hidden className={provider.ratingCount > 0 ? 'is-filled' : undefined} />
                          {provider.ratingCount > 0
                            ? `${provider.ratingAverage.toFixed(1)} (${provider.ratingCount} ${provider.ratingCount === 1 ? uiText('vlerësim', 'rating', 'Bewertung') : uiText('vlerësime', 'ratings', 'Bewertungen')})`
                            : uiText('Ende pa vlerësime', 'No ratings yet', 'Noch keine Bewertungen')}
                        </a>
                      </li>
                      <li>
                        <AiTrustBadge providerUid={provider.uid} providerName={name} compact />
                      </li>
                    </ul>
                  </div>
                  <div className="pp-hero-actions">
                    <SendRequestButton
                      providerUid={provider.uid}
                      providerName={provider.name}
                      intake={intakeDefaults}
                      compact
                      ctaLabel={uiText('Cakto takim', 'Book a meeting', 'Termin buchen')}
                      guestLabel={uiText('Hyr për takim', 'Log in to book', 'Anmelden zum Buchen')}
                    />
                    <StartChatButton
                      providerUid={provider.uid}
                      providerName={provider.name}
                      hideGuestHint
                      label={uiText('Dërgo mesazh', 'Send a message', 'Nachricht senden')}
                      className="pp-chat-btn"
                    />
                    <Tooltip delay={300}>
                      <Button
                        variant={compared ? 'primary' : 'outline'}
                        className="pp-compare-btn"
                        aria-label={compared ? uiText('Hiq nga krahasimi', 'Remove from compare', 'Aus Vergleich entfernen') : uiText('Krahaso këtë avokat', 'Compare this lawyer', 'Diesen Anwalt vergleichen')}
                        onPress={() => {
                          if (provider) {
                            toggleLawyer(provider.uid, {
                              name,
                              photoUrl: photo,
                              title,
                            })
                          }
                        }}
                      >
                        {compared ? <Check size={16} aria-hidden /> : <Scale size={16} aria-hidden />}
                        <span>{compared ? uiText('Në krahasim', 'In comparison', 'Im Vergleich') : uiText('Krahaso', 'Compare', 'Vergleichen')}</span>
                      </Button>
                      <Tooltip.Content placement="bottom">
                        {compared ? uiText('Hiq nga krahasimi', 'Remove from compare', 'Aus Vergleich entfernen') : uiText('Krahaso këtë avokat me të tjerë', 'Compare with other lawyers', 'Mit anderen Anwälten vergleichen')}
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={300}>
                      <Button isIconOnly variant="outline" aria-label={uiText('Ndaj profilin', 'Share profile', 'Profil teilen')} onPress={() => void shareProfile()}>
                        <Share2 size={17} />
                      </Button>
                      <Tooltip.Content placement="bottom">{uiText('Ndaj profilin', 'Share profile', 'Profil teilen')}</Tooltip.Content>
                    </Tooltip>
                  </div>
                </div>
              </Card>

              <AiTrustBadge
                providerUid={provider.uid}
                providerName={name}
                className="pp-ai-trust-banner"
              />

              {user?.uid && provider?.uid && user.uid === provider.uid ? (
                <AiTrustRecommendationsCard
                  providerUid={provider.uid}
                  isCompany={isCompany}
                  className="pp-ai-recs-owner"
                />
              ) : null}

              <div className="pp-grid">
                <div className="pp-main">
                  <Section title={isCompany ? uiText('Rreth nesh', 'About us', 'Über uns') : uiText('Rreth meje', 'About me', 'Über mich')}>
                    {about ? (
                      <p className="pp-about">{about}</p>
                    ) : (
                      <p className="pp-muted">{uiText('Ofruesi nuk ka shtuar ende një përshkrim.', 'The provider has not added a description yet.', 'Der Anbieter hat noch keine Beschreibung hinzugefügt.')}</p>
                    )}
                    {specialties.length ? (
                      <div className="pp-subsection">
                        <h3>{isCompany ? uiText('Fushat e shërbimit', 'Service areas', 'Leistungsbereiche') : uiText('Specializimet', 'Specialties', 'Spezialgebiete')}</h3>
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
                    title={uiText('Shërbimet', 'Services', 'Dienste')}
                    id="sherbimet"
                    meta={services.length ? <span className="pp-card-meta">{pagination.total}</span> : null}
                  >
                    {services.length ? (
                      <ul className="pp-services">
                        {services.map((service) => <ServiceRow key={service.id} service={service} />)}
                      </ul>
                    ) : (
                      <p className="pp-muted">{uiText('Ky ofrues nuk ka ende shërbime të publikuara.', 'This provider has no published services yet.', 'Dieser Anbieter hat noch keine veröffentlichten Dienste.')}</p>
                    )}
                  <KeshillaPagination pagination={pagination} onPageChange={(value) => changePage("page", value)} />
                  </Section>

                  {workExperience.length ? (
                    <Section title={uiText('Përvoja e punës', 'Work experience', 'Berufserfahrung')}>
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
                    <Section title={uiText('Arsimimi', 'Education', 'Ausbildung')}>
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
                    <Section title={uiText('Certifikimet', 'Certifications', 'Zertifikate')}>
                      <ul className="pp-timeline">
                        {certifications.map((entry, index) => (
                          <li key={`${entry.name}-${index}`}>
                            <span className="pp-timeline-icon"><Award size={16} aria-hidden /></span>
                            <div>
                              <strong>{entry.name}</strong>
                              <span>{[entry.issuer, entry.year].filter(Boolean).join(' · ')}</span>
                              {entry.credentialUrl ? (
                                <a href={externalHref(entry.credentialUrl)} target="_blank" rel="noopener noreferrer" className="pp-text-link">
                                  {uiText('Shiko certifikatën', 'View certificate', 'Zertifikat ansehen')}
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
                    <Section title={uiText('Ekspertët', 'Experts', 'Experten')} meta={<span className="pp-card-meta">{expertsPagination.total}</span>}>
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
                              <StartChatButton providerUid={expert.uid} providerName={expert.name} compact hideGuestHint label={uiText('Shkruaj', 'Message', 'Schreiben')} className="pp-chat-btn is-sm" />
                              <SendRequestButton
                                providerUid={expert.uid}
                                providerName={expert.name}
                                intake={{
                                  need: expert.headline || uiText(`Takim me ${expert.name}`, `Meeting with ${expert.name}`, `Termin mit ${expert.name}`),
                                  location: displayLocation || 'Online',
                                  language: 'Albanian',
                                  urgency: 'flexible',
                                  contact: 'chat',
                                }}
                                compact
                                ctaLabel={uiText('Cakto takim', 'Book a meeting', 'Termin buchen')}
                                guestLabel={uiText('Hyr për takim', 'Log in to book', 'Anmelden zum Buchen')}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                        <KeshillaPagination pagination={expertsPagination} onPageChange={(value) => changePage("expertsPage", value)} />
                    </Section>
                  ) : null}

                  {gallery.length > 0 ? (
                    <Section title={uiText('Galeria', 'Gallery', 'Galerie')}>
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
                    <Section title={uiText('Kontakt', 'Contact', 'Kontakt')}>
                      <ul className="pp-contact">
                        {phone ? (
                          <li>
                            <a href={`tel:${phone.replace(/\s+/g, '')}`}>
                              <span className="pp-contact-icon"><Phone size={16} aria-hidden /></span>
                              <span><small>{uiText('Thirr', 'Call', 'Anrufen')}</small>{phone}</span>
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

                  <Section title={uiText('Disponueshmëria', 'Availability', 'Verfügbarkeit')}>
                    {openDays.length === 0 ? (
                      <p className="pp-muted">{uiText('Nuk ka orë të hapura për momentin.', 'No open hours right now.', 'Gerade keine freien Stunden.')}</p>
                    ) : (
                      <>
                        <div className="pp-days">
                          {openDays.map((day) => (
                            <div key={day.key} className="pp-day">
                              <span>{day.weekday}</span>
                              <strong>{day.day}</strong>
                              <span>{day.month}</span>
                              <small>{day.count} {uiText('orë', 'hours', 'Std.')}</small>
                            </div>
                          ))}
                        </div>
                        {openDays.length > 6 ? (
                          <p className="pp-muted pp-days-more">
                            <CalendarDays size={14} aria-hidden />
                            {uiText(`+${openDays.length - 6} ditë të tjera me orë të lira`, `+${openDays.length - 6} more days with free hours`, `+${openDays.length - 6} weitere Tage mit freien Stunden`)}
                          </p>
                        ) : null}
                      </>
                    )}
                  </Section>

                  {languages.length ? (
                    <Section title={uiText('Gjuhët', 'Languages', 'Sprachen')}>
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
                    <Section title={uiText('Rrjetet sociale', 'Social networks', 'Soziale Netzwerke')}>
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
                        <KeshillaPagination pagination={schedulePaging.pagination} onPageChange={schedulePaging.setPage} />
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
