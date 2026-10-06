import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, buttonVariants, Card, Chip, ProgressBar, Separator, Skeleton, toast } from '@heroui/react'
import ConfirmActionDialog from '../components/ConfirmActionDialog'
import {
  Award,
  BriefcaseBusiness,
  Camera,
  ChevronDown,
  Clock,
  ExternalLink,
  GraduationCap,
  ImageIcon,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { fetchDomains } from '../api/domains'
import { fetchSubcategories, type CatalogSubcategory } from '../api/catalog'
import { IMAGE_ACCEPT, IMAGE_ACCEPT_HINT, mediaUrl, validateImageFile } from '../api/media'
import { locationLabel, resolveProviderLocations, type LocationSelection } from '../api/locations'
import {
  emptyCertification,
  emptyEducation,
  emptyWorkExperience,
  fetchMyProviderProfiles,
  updateMyProviderProfile,
  uploadProviderCover,
  uploadProviderPhoto,
  type CertificationEntry,
  type EducationEntry,
  type ManagedProviderProfile,
  type MonthYear,
  type WorkExperienceEntry,
} from '../api/providerProfiles'
import type { ProfileCompletion } from '../api/profileCompletion'
import {
  SOCIAL_LINK_KEYS,
  SOCIAL_LINK_LABELS,
  SOCIAL_LINK_PLACEHOLDERS,
  socialLinksFrom,
  type SocialLinks,
} from '../api/socialLinks'
import { useAuth } from '../auth/AuthContext'
import ProfileAvatar from '../components/ProfileAvatar'
import ProviderLocationFields from '../components/ProviderLocationFields'
import SocialIcon from '../components/SocialIcon'
import type { DomainDefinition } from '../data/domains'
import { domainRequires } from '../data/domains'
import { getErrorMessage } from '../utils/errors'
import ExpertInvitationsPanel from './ExpertInvitationsPanel'
import { EmptyBlock, RowsSkeleton, SectionHead } from './OverviewParts'
import { EmptyNote, filledSocialLinks, SocialLinksList } from './UserProfilePage'
import './UserProfile.css'
import './DashboardSections.css'
import './Settings.css'
import './ExpertProfile.css'

type EditSection = 'professional' | 'location' | 'experience' | 'education' | 'certifications' | 'social'

const SECTION_COPY: Record<EditSection, { title: string; description: string }> = {
  professional: {
    title: 'Informacioni profesional',
    description: 'Titulli, kategoria, bio dhe specializimet shfaqen te profili yt publik.',
  },
  location: {
    title: 'Lokacioni',
    description: 'Qyteti ku bazohesh dhe zonat ku ofron shërbime.',
  },
  experience: {
    title: 'Përvoja e punës',
    description: 'Pozitat e mëparshme ose aktuale. Opsionale.',
  },
  education: {
    title: 'Arsimi',
    description: 'Diplomat dhe programet e studimit. Opsionale.',
  },
  certifications: {
    title: 'Certifikimet',
    description: 'Certifikimet dhe licencat profesionale. Opsionale.',
  },
  social: {
    title: 'Rrjetet sociale',
    description: 'Lidhjet shfaqen te profili publik. Të gjitha janë opsionale.',
  },
}

function parseSkills(raw: string) {
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function formatMonthYear(value?: MonthYear) {
  if (!value?.year) return ''
  try {
    return new Date(value.year, Math.max(0, (value.month || 1) - 1)).toLocaleDateString('sq-AL', { month: 'short', year: 'numeric' })
  } catch {
    return `${value.month}/${value.year}`
  }
}

function formatPeriod(from: MonthYear, to: MonthYear | undefined, current: boolean, currentLabel: string) {
  return `${formatMonthYear(from)} – ${current ? currentLabel : formatMonthYear(to || from)}`
}

function Optional() {
  return <span className="ep-optional">Opsionale</span>
}

function EditButton({ onPress, label = 'Ndrysho' }: { onPress: () => void; label?: string }) {
  return (
    <Button size="sm" variant="ghost" className="uo-link-btn" onPress={onPress}>
      {label === 'Ndrysho' ? <Pencil size={14} aria-hidden /> : <Plus size={15} aria-hidden />}
      {label}
    </Button>
  )
}

function MonthYearFields({
  value,
  onChange,
  disabled,
  label,
}: {
  value: MonthYear
  onChange: (next: MonthYear) => void
  disabled?: boolean
  label: string
}) {
  const years = Array.from({ length: 76 }, (_, i) => new Date().getFullYear() - i)
  return (
    <div className="ds-field">
      <span className="ds-label">{label}</span>
      <div className="ep-month-year">
        <span className="ds-select">
          <select
            value={value.month}
            onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
            disabled={disabled}
            aria-label={`${label} muaji`}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <option key={month} value={month}>{String(month).padStart(2, '0')}</option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden />
        </span>
        <span className="ds-select">
          <select
            value={value.year}
            onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
            disabled={disabled}
            aria-label={`${label} viti`}
          >
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden />
        </span>
      </div>
    </div>
  )
}

function RepeatItem({ title, onRemove, disabled, children }: { title: string; onRemove: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <div className="ep-repeat-item">
      <div className="ep-repeat-head">
        <strong>{title}</strong>
        <Button size="sm" variant="ghost" className="ds-danger-btn" onPress={onRemove} isDisabled={disabled}>
          <Trash2 size={14} aria-hidden />
          Hiq
        </Button>
      </div>
      <div className="ep-fields">{children}</div>
    </div>
  )
}

export default function ExpertProfilePage({ onSaved, completion }: { onSaved: () => Promise<void>; completion: ProfileCompletion | null }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const route = useLocation()
  const editing = route.pathname.endsWith('/profile/edit')
  const photoInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const [domains, setDomains] = useState<DomainDefinition[]>([])
  const [profile, setProfile] = useState<ManagedProviderProfile | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [coverPreview, setCoverPreview] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [subcategories, setSubcategories] = useState<CatalogSubcategory[]>([])
  const [bio, setBio] = useState('')
  const [skillsText, setSkillsText] = useState('')
  const [yearsOfExperience, setYearsOfExperience] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(socialLinksFrom())
  const [workExperience, setWorkExperience] = useState<WorkExperienceEntry[]>([])
  const [education, setEducation] = useState<EducationEntry[]>([])
  const [certifications, setCertifications] = useState<CertificationEntry[]>([])
  const [location, setLocation] = useState<LocationSelection | null>(null)
  const [serviceAreas, setServiceAreas] = useState<LocationSelection[]>([])
  const [savedPlaces, setSavedPlaces] = useState<{ location: LocationSelection | null; serviceAreas: LocationSelection[] }>({
    location: null,
    serviceAreas: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [uploading, setUploading] = useState<'photo' | 'cover' | null>(null)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [section, setSection] = useState<EditSection>(() => {
    const requested = (route.state as { section?: EditSection } | null)?.section
    return requested && requested in SECTION_COPY ? requested : 'professional'
  })

  const selectedDomain = useMemo(() => domains.find((domain) => domain.id === category) ?? null, [domains, category])
  const needsLicense = domainRequires(selectedDomain, 'license_verification')

  function hydrate(individual: ManagedProviderProfile, domainList: DomainDefinition[]) {
    setTitle(individual.publicProfile.title || '')
    setCategory(individual.categories[0] || domainList[0]?.id || '')
    setSubcategoryId(individual.subcategoryIds?.[0] || '')
    setBio(individual.publicProfile.description || '')
    setYearsOfExperience(typeof individual.yearsOfExperience === 'number' ? String(individual.yearsOfExperience) : '')
    setLicenseNumber(individual.qualificationClaims?.[0]?.referenceNumber || '')
    setSkillsText((individual.specializations || []).join(', '))
    setSocialLinks(socialLinksFrom(individual.socialLinks))
    setWorkExperience(individual.workExperience?.length ? individual.workExperience : [])
    setEducation(individual.education?.length ? individual.education : [])
    setCertifications(individual.certifications?.length ? individual.certifications : [])
    setPhotoPreview(mediaUrl(individual.publicProfile.photoUrl))
    setCoverPreview(mediaUrl(individual.publicProfile.coverUrl))
  }

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([fetchDomains(), fetchMyProviderProfiles(controller.signal)])
      .then(([domainList, providers]) => {
        if (controller.signal.aborted) return
        setDomains(domainList)
        const individual = providers.find((item) => item.providerType === 'individual') ?? null
        setProfile(individual)
        if (individual) hydrate(individual, domainList)
      })
      .catch((err: unknown) => { if (!controller.signal.aborted) setLoadError(getErrorMessage(err)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!editing || loading) return
    if (section === 'experience') setWorkExperience((rows) => rows.length ? rows : [emptyWorkExperience()])
    if (section === 'education') setEducation((rows) => rows.length ? rows : [emptyEducation()])
    if (section === 'certifications') setCertifications((rows) => rows.length ? rows : [emptyCertification()])
  }, [editing, loading, section])

  useEffect(() => {
    if (!profile) return
    const controller = new AbortController()
    resolveProviderLocations(
      { location: profile.location, serviceAreaCityIds: profile.serviceAreaCityIds ?? [] },
      controller.signal,
    )
      .then((values) => {
        if (controller.signal.aborted) return
        setLocation(values.location)
        setServiceAreas(values.serviceAreas)
        setSavedPlaces(values)
      })
      .catch((err: unknown) => { if (!controller.signal.aborted) setLoadError(getErrorMessage(err)) })
    return () => controller.abort()
  }, [profile])

  useEffect(() => {
    const categoryRef = domains.find((domain) => domain.id === category)?.categoryRef
    if (!categoryRef) {
      setSubcategories([])
      return
    }
    const controller = new AbortController()
    fetchSubcategories(categoryRef, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return
        const active = items.filter((item) => item.isActive)
        setSubcategories(active)
        setSubcategoryId((current) => (current && active.some((item) => item._id === current) ? current : active[0]?._id || ''))
      })
      .catch(() => { if (!controller.signal.aborted) setSubcategories([]) })
    return () => controller.abort()
  }, [category, domains])

  async function onPhotoChange(file: File | undefined) {
    if (!file || !profile) return
    try {
      validateImageFile(file)
    } catch (err) {
      toast.danger(getErrorMessage(err))
      return
    }
    setUploading('photo')
    const local = URL.createObjectURL(file)
    setPhotoPreview(local)
    try {
      const next = await uploadProviderPhoto(profile._id, file)
      setProfile(next)
      setPhotoPreview(mediaUrl(next.publicProfile.photoUrl))
      await onSaved()
      toast.success('Fotoja e profilit u ngarkua.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
      setPhotoPreview(mediaUrl(profile.publicProfile.photoUrl))
    } finally {
      setUploading(null)
      URL.revokeObjectURL(local)
    }
  }

  async function onCoverChange(file: File | undefined) {
    if (!file || !profile) return
    try {
      validateImageFile(file)
    } catch (err) {
      toast.danger(getErrorMessage(err))
      return
    }
    setUploading('cover')
    const local = URL.createObjectURL(file)
    setCoverPreview(local)
    try {
      const next = await uploadProviderCover(profile._id, file)
      setProfile(next)
      setCoverPreview(mediaUrl(next.publicProfile.coverUrl))
      await onSaved()
      toast.success('Sfondi u ngarkua.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
      setCoverPreview(mediaUrl(profile.publicProfile.coverUrl))
    } finally {
      setUploading(null)
      URL.revokeObjectURL(local)
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    if (!category || !subcategoryId) {
      setError('Kategoria dhe nënkategoria janë të detyrueshme.')
      return
    }
    if (!location) {
      setError('Zgjidh qytetin / zonën e shërbimit.')
      return
    }
    const years = Number(yearsOfExperience)
    if (!Number.isInteger(years) || years < 0 || years > 60) {
      setError('Vitet e përvojës duhet të jenë një numër i plotë 0–60.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const next = await updateMyProviderProfile(profile._id, {
        categories: [category],
        subcategoryIds: [subcategoryId],
        yearsOfExperience: years,
        specializations: parseSkills(skillsText),
        socialLinks,
        workExperience,
        education,
        certifications,
        publicProfile: {
          displayName: [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.name || profile.publicProfile.displayName || 'Ekspert',
          title,
          description: bio,
          shortDescription: bio.slice(0, 300),
        },
        qualificationClaims: needsLicense && licenseNumber.trim()
          ? [{ categoryId: category, referenceNumber: licenseNumber.trim(), status: 'unverified' }]
          : [],
        location: { countryId: location.country._id, cityId: location.city._id },
        serviceAreaCityIds: serviceAreas.map((area) => area.city._id),
      })
      setProfile(next)
      hydrate(next, domains)
      await onSaved()
      toast.success('Profili i ekspertit u ruajt.')
      navigate('/dashboard/provider/profile')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function openEdit(next: EditSection) {
    setError('')
    if (next === 'experience' && workExperience.length === 0) setWorkExperience([emptyWorkExperience()])
    if (next === 'education' && education.length === 0) setEducation([emptyEducation()])
    if (next === 'certifications' && certifications.length === 0) setCertifications([emptyCertification()])
    navigate('/dashboard/provider/profile/edit', { state: { section: next } })
  }

  function cancelEdit() {
    if (profile) hydrate(profile, domains)
    setLocation(savedPlaces.location)
    setServiceAreas(savedPlaces.serviceAreas)
    setError('')
    navigate('/dashboard/provider/profile')
  }

  const header = (
    <header className="uo-head">
      <div className="uo-head-copy">
        <h1>Profili</h1>
        <p>Menaxho profilin tënd profesional. Këto të dhëna shfaqen te profili publik dhe te shërbimet që ofron.</p>
      </div>
      {profile && user ? (
        <Link to={`/providers/${user.uid}`} className={`${buttonVariants({ variant: 'outline' })} uo-primary`}>
          <ExternalLink size={16} aria-hidden />
          Shiko profilin publik
        </Link>
      ) : null}
    </header>
  )

  if (loading) {
    return (
      <section className="uo up" aria-busy="true">
        {header}
        <Card className="uo-card up-hero">
          <div className="up-hero-main">
            <Skeleton className="ep-skel-avatar" />
            <div className="up-hero-copy ep-skel-copy">
              <Skeleton className="uo-skel-line is-wide" />
              <Skeleton className="uo-skel-line" />
            </div>
          </div>
        </Card>
        <Card className="uo-card">
          <Card.Content className="uo-card-body ds-pad-top">
            <RowsSkeleton rows={3} />
          </Card.Content>
        </Card>
      </section>
    )
  }

  if (!profile) {
    return (
      <section className="uo up">
        {header}
        {loadError ? (
          <Alert status="danger" className="uo-alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Profili nuk u ngarkua</Alert.Title>
              <Alert.Description>{loadError}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : (
          <Card className="uo-card">
            <Card.Content className="uo-card-body ds-pad-top">
              <EmptyBlock
                title="Nuk ke ende profil eksperti"
                text="Krijo profilin e ekspertit për të publikuar shërbime dhe për t’u shfaqur te ofertat."
                action={
                  <Link to="/dashboard/provider/create" className={buttonVariants({ variant: 'primary' })}>
                    Krijo profilin e ekspertit
                  </Link>
                }
              />
            </Card.Content>
          </Card>
        )}
      </section>
    )
  }

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.name || profile.publicProfile.displayName
  const subcategory = subcategories.find((item) => item._id === subcategoryId)
  const categoryText = [selectedDomain?.labelSq, subcategory?.name.sq].filter(Boolean).join(' › ')
  const locationText = location ? locationLabel(location, 'sq') : ''
  const skills = parseSkills(skillsText)
  const socialEntries = filledSocialLinks(socialLinks)
  const percent = completion?.exists && completion.overallPercent !== null
    ? Math.max(0, Math.min(100, Math.round(completion.overallPercent)))
    : null
  const missing = completion?.section.missingRequired ?? []
  const notAdded = <span className="up-missing">Nuk është shtuar</span>
  const copy = SECTION_COPY[section]

  if (editing) {
    return (
      <section className="uo up">
        <header className="uo-head"><div className="uo-head-copy"><h1>Ndrysho profilin</h1><p>Menaxho të dhënat e profilit tënd profesional.</p></div></header>
        <div className="ep-edit-nav" role="group" aria-label="Seksionet e profilit">
          {(Object.keys(SECTION_COPY) as EditSection[]).map((item) => <Button key={item} size="sm" variant={section === item ? 'primary' : 'outline'} onPress={() => setSection(item)}>{SECTION_COPY[item].title}</Button>)}
        </div>
        <form className="up-form" onSubmit={onSave}>
          <Card className="uo-card">
            <SectionHead title={copy.title} />
            <Card.Content className="uo-card-body ep-modal-body">
              <p className="ds-hint">{copy.description}</p>

                  {section === 'professional' ? (
                    <div className="ep-fields">
                      <label className="ds-field ep-full">
                        <span className="ds-label">Titulli profesional</span>
                        <input className="ds-input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} placeholder="p.sh. Avokat" />
                      </label>
                      <label className="ds-field">
                        <span className="ds-label">Kategoria</span>
                        <span className="ds-select">
                          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
                            {domains.map((domain) => (
                              <option key={domain.id} value={domain.id}>{domain.labelSq}</option>
                            ))}
                          </select>
                          <ChevronDown size={16} aria-hidden />
                        </span>
                      </label>
                      <label className="ds-field">
                        <span className="ds-label">Nënkategoria</span>
                        <span className="ds-select">
                          <select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)} required disabled={!subcategories.length}>
                            {!subcategories.length ? <option value="">Nuk ka nënkategori</option> : null}
                            {subcategories.map((item) => (
                              <option key={item._id} value={item._id}>{item.name.sq}</option>
                            ))}
                          </select>
                          <ChevronDown size={16} aria-hidden />
                        </span>
                      </label>
                      <label className="ds-field">
                        <span className="ds-label">Vitet e përvojës</span>
                        <input
                          className="ds-input"
                          type="number"
                          min={0}
                          max={60}
                          step={1}
                          value={yearsOfExperience}
                          onChange={(e) => setYearsOfExperience(e.target.value)}
                          required
                          placeholder="p.sh. 5"
                        />
                      </label>
                      {needsLicense ? (
                        <label className="ds-field">
                          <span className="ds-label">Licenca / certifikimi</span>
                          <input className="ds-input" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required maxLength={120} placeholder="Numri i licencës" />
                        </label>
                      ) : null}
                      <label className="ds-field ep-full">
                        <span className="ds-label">Bio / Përshkrimi</span>
                        <textarea className="ds-input ep-textarea" value={bio} onChange={(e) => setBio(e.target.value)} required rows={5} maxLength={3000} />
                      </label>
                      <label className="ds-field ep-full">
                        <span className="ds-label">Specializimet</span>
                        <input className="ds-input" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} required placeholder="p.sh. Kontrata, Tatime" />
                        <span className="ds-hint">Ndaji me presje.</span>
                      </label>
                      <p className="ds-hint ep-full">Emri publik ndryshohet nga profili privat.</p>
                    </div>
                  ) : null}

                  {section === 'location' ? (
                    <div className="ds-field">
                      <span className="ds-label">Qyteti / zona e shërbimit</span>
                      <ProviderLocationFields
                        location={location}
                        serviceAreas={serviceAreas}
                        onLocationChange={setLocation}
                        onServiceAreasChange={setServiceAreas}
                        disabled={saving}
                      />
                    </div>
                  ) : null}

                  {section === 'experience' ? (
                    <div className="ep-repeat">
                      {workExperience.map((entry, index) => (
                        <RepeatItem
                          key={`work-${index}`}
                          title={`Përvoja ${index + 1}`}
                          disabled={saving}
                          onRemove={() => setWorkExperience((rows) => rows.filter((_, i) => i !== index))}
                        >
                          <label className="ds-field">
                            <span className="ds-label">Pozita</span>
                            <input
                              className="ds-input"
                              value={entry.position}
                              onChange={(e) => setWorkExperience((rows) => rows.map((row, i) => (i === index ? { ...row, position: e.target.value } : row)))}
                              maxLength={160}
                              required
                            />
                          </label>
                          <label className="ds-field">
                            <span className="ds-label">Kompania / Organizata</span>
                            <input
                              className="ds-input"
                              value={entry.organization}
                              onChange={(e) => setWorkExperience((rows) => rows.map((row, i) => (i === index ? { ...row, organization: e.target.value } : row)))}
                              maxLength={160}
                              required
                            />
                          </label>
                          <MonthYearFields
                            label="Nga"
                            value={entry.from}
                            disabled={saving}
                            onChange={(from) => setWorkExperience((rows) => rows.map((row, i) => (i === index ? { ...row, from } : row)))}
                          />
                          {!entry.current ? (
                            <MonthYearFields
                              label="Deri"
                              value={entry.to || entry.from}
                              disabled={saving}
                              onChange={(to) => setWorkExperience((rows) => rows.map((row, i) => (i === index ? { ...row, to } : row)))}
                            />
                          ) : null}
                          <label className="ep-check ep-full">
                            <input
                              type="checkbox"
                              checked={entry.current}
                              onChange={(e) => setWorkExperience((rows) => rows.map((row, i) => (
                                i === index ? { ...row, current: e.target.checked, to: e.target.checked ? undefined : (row.to || row.from) } : row
                              )))}
                            />
                            Aktualisht punoj këtu
                          </label>
                          <label className="ds-field ep-full">
                            <span className="ds-label">Përshkrimi <Optional /></span>
                            <textarea
                              className="ds-input ep-textarea"
                              value={entry.description || ''}
                              onChange={(e) => setWorkExperience((rows) => rows.map((row, i) => (i === index ? { ...row, description: e.target.value } : row)))}
                              rows={2}
                              maxLength={2000}
                            />
                          </label>
                        </RepeatItem>
                      ))}
                      <Button variant="outline" className="ep-add" onPress={() => setWorkExperience((rows) => [...rows, emptyWorkExperience()])} isDisabled={saving}>
                        <Plus size={16} aria-hidden />
                        Shto përvojë pune
                      </Button>
                    </div>
                  ) : null}

                  {section === 'education' ? (
                    <div className="ep-repeat">
                      {education.map((entry, index) => (
                        <RepeatItem
                          key={`edu-${index}`}
                          title={`Arsimi ${index + 1}`}
                          disabled={saving}
                          onRemove={() => setEducation((rows) => rows.filter((_, i) => i !== index))}
                        >
                          <label className="ds-field ep-full">
                            <span className="ds-label">Institucioni</span>
                            <input
                              className="ds-input"
                              value={entry.institution}
                              onChange={(e) => setEducation((rows) => rows.map((row, i) => (i === index ? { ...row, institution: e.target.value } : row)))}
                              maxLength={160}
                              required
                            />
                          </label>
                          <label className="ds-field">
                            <span className="ds-label">Diploma / Programi</span>
                            <input
                              className="ds-input"
                              value={entry.degree}
                              onChange={(e) => setEducation((rows) => rows.map((row, i) => (i === index ? { ...row, degree: e.target.value } : row)))}
                              maxLength={160}
                              required
                            />
                          </label>
                          <label className="ds-field">
                            <span className="ds-label">Fusha e studimit</span>
                            <input
                              className="ds-input"
                              value={entry.fieldOfStudy}
                              onChange={(e) => setEducation((rows) => rows.map((row, i) => (i === index ? { ...row, fieldOfStudy: e.target.value } : row)))}
                              maxLength={160}
                              required
                            />
                          </label>
                          <MonthYearFields
                            label="Nga"
                            value={entry.from}
                            disabled={saving}
                            onChange={(from) => setEducation((rows) => rows.map((row, i) => (i === index ? { ...row, from } : row)))}
                          />
                          {!entry.current ? (
                            <MonthYearFields
                              label="Deri"
                              value={entry.to || entry.from}
                              disabled={saving}
                              onChange={(to) => setEducation((rows) => rows.map((row, i) => (i === index ? { ...row, to } : row)))}
                            />
                          ) : null}
                          <label className="ep-check ep-full">
                            <input
                              type="checkbox"
                              checked={entry.current}
                              onChange={(e) => setEducation((rows) => rows.map((row, i) => (
                                i === index ? { ...row, current: e.target.checked, to: e.target.checked ? undefined : (row.to || row.from) } : row
                              )))}
                            />
                            Aktualisht studioj
                          </label>
                        </RepeatItem>
                      ))}
                      <Button variant="outline" className="ep-add" onPress={() => setEducation((rows) => [...rows, emptyEducation()])} isDisabled={saving}>
                        <Plus size={16} aria-hidden />
                        Shto arsim
                      </Button>
                    </div>
                  ) : null}

                  {section === 'certifications' ? (
                    <div className="ep-repeat">
                      {certifications.map((entry, index) => (
                        <RepeatItem
                          key={`cert-${index}`}
                          title={`Certifikimi ${index + 1}`}
                          disabled={saving}
                          onRemove={() => setCertifications((rows) => rows.filter((_, i) => i !== index))}
                        >
                          <label className="ds-field">
                            <span className="ds-label">Emri i certifikimit</span>
                            <input
                              className="ds-input"
                              value={entry.name}
                              onChange={(e) => setCertifications((rows) => rows.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))}
                              maxLength={160}
                              required
                            />
                          </label>
                          <label className="ds-field">
                            <span className="ds-label">Institucioni që e ka lëshuar</span>
                            <input
                              className="ds-input"
                              value={entry.issuer}
                              onChange={(e) => setCertifications((rows) => rows.map((row, i) => (i === index ? { ...row, issuer: e.target.value } : row)))}
                              maxLength={160}
                              required
                            />
                          </label>
                          <label className="ds-field">
                            <span className="ds-label">Viti</span>
                            <input
                              className="ds-input"
                              type="number"
                              min={1950}
                              max={new Date().getFullYear() + 1}
                              step={1}
                              value={entry.year}
                              onChange={(e) => setCertifications((rows) => rows.map((row, i) => (i === index ? { ...row, year: Number(e.target.value) } : row)))}
                              required
                            />
                          </label>
                          <label className="ds-field">
                            <span className="ds-label">URL e kredencialit <Optional /></span>
                            <input
                              className="ds-input"
                              value={entry.credentialUrl || ''}
                              onChange={(e) => setCertifications((rows) => rows.map((row, i) => (i === index ? { ...row, credentialUrl: e.target.value } : row)))}
                              placeholder="https://"
                              inputMode="url"
                              maxLength={500}
                            />
                          </label>
                        </RepeatItem>
                      ))}
                      <Button variant="outline" className="ep-add" onPress={() => setCertifications((rows) => [...rows, emptyCertification()])} isDisabled={saving}>
                        <Plus size={16} aria-hidden />
                        Shto certifikim
                      </Button>
                    </div>
                  ) : null}

                  {section === 'social' ? (
                    <div className="ep-fields">
                      {SOCIAL_LINK_KEYS.map((key) => (
                        <label key={key} className="ds-field">
                          <span className="ds-label ep-social-label">
                            <SocialIcon name={key} size={15} />
                            {SOCIAL_LINK_LABELS[key]}
                          </span>
                          <input
                            className="ds-input"
                            value={socialLinks[key] || ''}
                            onChange={(e) => setSocialLinks({ ...socialLinks, [key]: e.target.value })}
                            placeholder={SOCIAL_LINK_PLACEHOLDERS[key]}
                            disabled={saving}
                            inputMode="url"
                            maxLength={500}
                          />
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {error ? <p className="ds-error" role="alert">{error}</p> : null}

            </Card.Content>
          </Card>
          <div className="up-actions">
            <Button variant="outline" onPress={() => setConfirmCancel(true)} isDisabled={saving}>Anulo</Button>
            <Button type="submit" variant="primary" isPending={saving} isDisabled={uploading !== null}>{saving ? 'Duke ruajtur…' : 'Ruaj ndryshimet'}</Button>
          </div>
        </form>
      </section>
    )
  }

  return (
    <section className="uo up">
      {header}

      {loadError ? (
        <Alert status="danger" className="uo-alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Disa të dhëna nuk u ngarkuan</Alert.Title>
            <Alert.Description>{loadError}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <ExpertInvitationsPanel />

      <Card className="uo-card up-hero">
        <div className="up-hero-main">
          <div className="ep-avatar">
            <ProfileAvatar src={photoPreview} seed={user?.uid} alt={displayName} size="fill" className="up-hero-avatar" />
            <button
              type="button"
              className="ep-avatar-btn"
              onClick={() => photoInput.current?.click()}
              disabled={uploading === 'photo'}
              aria-label="Ndrysho foton e profilit"
              title="Ndrysho foton e profilit"
            >
              <Camera size={15} aria-hidden />
            </button>
            <input
              ref={photoInput}
              type="file"
              accept={IMAGE_ACCEPT}
              hidden
              disabled={uploading === 'photo'}
              onChange={(e) => {
                void onPhotoChange(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
          <div className="up-hero-copy">
            <div className="up-hero-title">
              <h2>{displayName}</h2>
              {percent === 100 ? (
                <Chip size="sm" variant="soft" color="success">
                  <Chip.Label>Profili i plotë</Chip.Label>
                </Chip>
              ) : null}
            </div>
            <p className="up-hero-role">{title || 'Ofrues shërbimi'}</p>
            <ul className="up-hero-meta">
              {categoryText ? (
                <li className="ep-hero-category"><BriefcaseBusiness size={15} aria-hidden />{categoryText}</li>
              ) : null}
              {locationText ? <li><MapPin size={15} aria-hidden />{locationText}</li> : null}
              {yearsOfExperience ? (
                <li><Clock size={15} aria-hidden />{yearsOfExperience} {yearsOfExperience === '1' ? 'vit' : 'vite'} përvojë</li>
              ) : null}
            </ul>
          </div>
        </div>
        <Button variant="primary" className="up-hero-action" onPress={() => openEdit('professional')}>
          <Pencil size={16} aria-hidden />
          Ndrysho profilin
        </Button>
      </Card>

      <div className="uo-grid up-grid">
        <div className="up-col">
          <Card className="uo-card">
            <SectionHead title="Informacioni profesional" action={<EditButton onPress={() => openEdit('professional')} />} />
            <Card.Content className="uo-card-body ep-stack">
              <dl className="up-facts">
                <div className="up-fact">
                  <dt>Titulli profesional</dt>
                  <dd>{title || notAdded}</dd>
                </div>
                <div className="up-fact">
                  <dt>Vitet e përvojës</dt>
                  <dd>{yearsOfExperience || notAdded}</dd>
                </div>
                <div className="up-fact">
                  <dt>Kategoria</dt>
                  <dd>{selectedDomain?.labelSq || notAdded}</dd>
                </div>
                <div className="up-fact">
                  <dt>Nënkategoria</dt>
                  <dd>{subcategory?.name.sq || notAdded}</dd>
                </div>
                {needsLicense ? (
                  <div className="up-fact">
                    <dt>Licenca / certifikimi</dt>
                    <dd>{licenseNumber || notAdded}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="ep-block">
                <h3 className="ep-sub">Bio</h3>
                {bio ? <p className="ep-bio">{bio}</p> : notAdded}
              </div>
              <div className="ep-block">
                <h3 className="ep-sub">Specializimet</h3>
                {skills.length ? (
                  <div className="up-chips">
                    {skills.map((skill) => (
                      <Chip key={skill} variant="soft" color="accent">
                        <Chip.Label>{skill}</Chip.Label>
                      </Chip>
                    ))}
                  </div>
                ) : notAdded}
              </div>
            </Card.Content>
          </Card>

          <Card className="uo-card">
            <SectionHead
              title="Përvoja e punës"
              meta={workExperience.length ? <span className="uo-card-meta">{workExperience.length}</span> : null}
              action={workExperience.length ? <EditButton onPress={() => openEdit('experience')} /> : null}
            />
            <Card.Content className="uo-card-body">
              {workExperience.length ? (
                <ul className="ep-entries">
                  {workExperience.map((entry, index) => (
                    <li key={`work-${index}`} className="ep-entry">
                      <span className="uo-row-icon" aria-hidden><BriefcaseBusiness size={16} /></span>
                      <div className="ep-entry-copy">
                        <strong>{entry.position}</strong>
                        <span>{entry.organization}</span>
                        <span className="ep-entry-period">{formatPeriod(entry.from, entry.to, entry.current, 'Sot')}</span>
                        {entry.description ? <p>{entry.description}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyNote text="Nuk ke shtuar përvojë pune." action="Shto përvojë" onAction={() => openEdit('experience')} />
              )}
            </Card.Content>
          </Card>

          <Card className="uo-card">
            <SectionHead
              title="Arsimi"
              meta={education.length ? <span className="uo-card-meta">{education.length}</span> : null}
              action={education.length ? <EditButton onPress={() => openEdit('education')} /> : null}
            />
            <Card.Content className="uo-card-body">
              {education.length ? (
                <ul className="ep-entries">
                  {education.map((entry, index) => (
                    <li key={`edu-${index}`} className="ep-entry">
                      <span className="uo-row-icon" aria-hidden><GraduationCap size={16} /></span>
                      <div className="ep-entry-copy">
                        <strong>{[entry.degree, entry.fieldOfStudy].filter(Boolean).join(' · ')}</strong>
                        <span>{entry.institution}</span>
                        <span className="ep-entry-period">{formatPeriod(entry.from, entry.to, entry.current, 'Aktualisht')}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyNote text="Nuk ke shtuar arsimin." action="Shto arsim" onAction={() => openEdit('education')} />
              )}
            </Card.Content>
          </Card>

          <Card className="uo-card">
            <SectionHead
              title="Certifikimet"
              meta={certifications.length ? <span className="uo-card-meta">{certifications.length}</span> : null}
              action={certifications.length ? <EditButton onPress={() => openEdit('certifications')} /> : null}
            />
            <Card.Content className="uo-card-body">
              {certifications.length ? (
                <ul className="ep-entries">
                  {certifications.map((entry, index) => (
                    <li key={`cert-${index}`} className="ep-entry">
                      <span className="uo-row-icon" aria-hidden><Award size={16} /></span>
                      <div className="ep-entry-copy">
                        <strong>{entry.name}</strong>
                        <span>{[entry.issuer, entry.year].filter(Boolean).join(' · ')}</span>
                        {entry.credentialUrl ? (
                          <a href={entry.credentialUrl} target="_blank" rel="noopener noreferrer" className="ep-entry-link">
                            Shiko kredencialin
                            <ExternalLink size={13} aria-hidden />
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyNote text="Nuk ke shtuar certifikime." action="Shto certifikim" onAction={() => openEdit('certifications')} />
              )}
            </Card.Content>
          </Card>
        </div>

        <aside className="up-col">
          {percent !== null && percent < 100 ? (
            <Card className="uo-card">
              <SectionHead title="Plotëso profilin" meta={<span className="uo-card-meta is-strong">{percent}%</span>} />
              <Card.Content className="uo-card-body uo-setup">
                <ProgressBar aria-label={`Kompletimi i profilit ${percent}%`} value={percent} className="uo-progress">
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
                {missing.length ? (
                  <div className="uo-missing">
                    <span>Mungojnë:</span>
                    {missing.map((field) => (
                      <Chip key={field.key} size="sm" variant="soft">
                        <Chip.Label>{field.label}</Chip.Label>
                      </Chip>
                    ))}
                  </div>
                ) : null}
                <Separator />
                <Button size="sm" variant="ghost" className="uo-link-btn up-setup-action" onPress={() => openEdit('professional')}>
                  Plotëso tani
                </Button>
              </Card.Content>
            </Card>
          ) : null}

          <Card className="uo-card">
            <SectionHead title="Lokacioni" action={<EditButton onPress={() => openEdit('location')} />} />
            <Card.Content className="uo-card-body ep-stack">
              <div className="ep-place">
                <span className="uo-row-icon" aria-hidden><MapPin size={16} /></span>
                <div className="ep-entry-copy">
                  <span>Qyteti</span>
                  <strong>{locationText || notAdded}</strong>
                </div>
              </div>
              {serviceAreas.length ? (
                <div className="ep-block">
                  <h3 className="ep-sub">Zonat e shërbimit</h3>
                  <div className="up-chips">
                    {serviceAreas.map((area) => (
                      <Chip key={area.city._id} size="sm" variant="soft">
                        <Chip.Label>{locationLabel(area, 'sq')}</Chip.Label>
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card.Content>
          </Card>

          <Card className="uo-card">
            <SectionHead
              title="Rrjetet sociale"
              meta={socialEntries.length ? <span className="uo-card-meta">{socialEntries.length}</span> : null}
              action={socialEntries.length ? <EditButton onPress={() => openEdit('social')} /> : null}
            />
            <Card.Content className="uo-card-body">
              {socialEntries.length ? (
                <SocialLinksList entries={socialEntries} className="ep-social" />
              ) : (
                <EmptyNote text="Nuk ke shtuar asnjë rrjet social." action="Shto rrjete" onAction={() => openEdit('social')} />
              )}
            </Card.Content>
          </Card>

          <Card className="uo-card">
            <SectionHead title="Sfondi i profilit publik" />
            <Card.Content className="uo-card-body ep-stack">
              <div className="ep-cover">
                <img src={coverPreview || '/images/login-advice.png'} alt="" />
              </div>
              <p className="ds-hint">
                {coverPreview ? '' : 'Po përdoret sfondi i parazgjedhur. '}
                {IMAGE_ACCEPT_HINT}.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="ep-cover-btn"
                isPending={uploading === 'cover'}
                onPress={() => coverInput.current?.click()}
              >
                <ImageIcon size={15} aria-hidden />
                {uploading === 'cover' ? 'Duke ngarkuar…' : 'Ndrysho sfondin'}
              </Button>
              <input
                ref={coverInput}
                type="file"
                accept={IMAGE_ACCEPT}
                hidden
                disabled={uploading === 'cover'}
                onChange={(e) => {
                  void onCoverChange(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </Card.Content>
          </Card>
        </aside>
      </div>


      <ConfirmActionDialog isOpen={confirmCancel} onClose={() => setConfirmCancel(false)} onConfirm={() => { cancelEdit(); setConfirmCancel(false) }} title="Hidh ndryshimet?" description="Ndryshimet e paruajtura në profilin e ekspertit do të humbasin." confirmLabel="Hidh ndryshimet" />
    </section>
  )
}
