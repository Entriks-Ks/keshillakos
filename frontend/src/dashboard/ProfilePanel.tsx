import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ProgressBar, toast } from '@heroui/react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { fetchMyBusinesses, updateBusinessProfile, uploadBusinessLogo, type BusinessProfile } from '../api/businesses'
import { fetchDomains } from '../api/domains'
import { fetchCategories, fetchSubcategories, type CatalogCategory, type CatalogSubcategory } from '../api/catalog'
import { IMAGE_ACCEPT, IMAGE_ACCEPT_HINT, mediaUrl, validateImageFile } from '../api/media'
import { resolveProviderLocations, resolveSavedLocation, type LocationSelection } from '../api/locations'
import {
  emptyCertification,
  emptyEducation,
  emptyWorkExperience,
  fetchMyProviderProfiles,
  updateMyProviderProfile,
  uploadProviderPhoto,
  type CertificationEntry,
  type EducationEntry,
  type ManagedProviderProfile,
  type MonthYear,
  type WorkExperienceEntry,
} from '../api/providerProfiles'
import { fetchProfileCompletion, type ProfileCompletion, type ProfileType } from '../api/profileCompletion'
import {
  SOCIAL_LINK_KEYS,
  SOCIAL_LINK_LABELS,
  SOCIAL_LINK_PLACEHOLDERS,
  socialLinksFrom,
  type SocialLinks,
} from '../api/socialLinks'
import { useAuth } from '../auth/AuthContext'
import LocationSelector from '../components/LocationSelector'
import ProviderLocationFields from '../components/ProviderLocationFields'
import type { DomainDefinition } from '../data/domains'
import { domainRequires } from '../data/domains'
import { useCatalogOptions } from '../hooks/useCatalogOptions'
import { getErrorMessage } from '../utils/errors'
import ExpertInvitationsPanel from './ExpertInvitationsPanel'
import DashPageHeader from './DashPageHeader'

function parseSkills(raw: string) {
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function matchCatalogCategoryId(categories: CatalogCategory[], saved?: string) {
  if (!saved) return ''
  const found = categories.find((item) => item._id === saved || item.slug === saved)
  return found?._id || ''
}

function FieldHint({ required }: { required: boolean }) {
  return <span className="profile-field-hint">{required ? 'E detyrueshme' : 'Opsionale'}</span>
}

function profileTypeFromPath(pathname: string): ProfileType {
  if (pathname.includes('/dashboard/provider')) return 'expert'
  if (pathname.includes('/dashboard/company')) return 'company'
  return 'private'
}

function CompletionCard({ completion }: { completion: ProfileCompletion | null }) {
  if (!completion || !completion.exists || completion.overallPercent === null) return null
  const section = completion.section
  return (
    <div className="profile-completion-card">
      <div className="profile-completion-head">
        <div>
          <h3>Kompletimi i profilit</h3>
          <p className="muted">Vetëm fushat e detyrueshme të këtij profili. Rrjetet sociale janë opsionale.</p>
        </div>
        <strong className="profile-completion-percent">{completion.overallPercent}%</strong>
      </div>
      <ProgressBar aria-label={`Kompletimi i profilit ${completion.overallPercent}%`} value={completion.overallPercent}>
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      {section.missingRequired.length ? (
        <p className="muted profile-completion-missing">
          Mungojnë: {section.missingRequired.map((field) => field.label).join(', ')}
        </p>
      ) : (
        <p className="muted profile-completion-missing">Të gjitha fushat e detyrueshme janë plotësuar.</p>
      )}
    </div>
  )
}

function SocialLinksFields({
  value,
  onChange,
  disabled,
}: {
  value: SocialLinks
  onChange: (next: SocialLinks) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="full checkbox-fieldset profile-social-fieldset">
      <legend>Lidhjet sociale <FieldHint required={false} /></legend>
      <div className="profile-social-grid">
        {SOCIAL_LINK_KEYS.map((key) => (
          <label key={key}>
            {SOCIAL_LINK_LABELS[key]}
            <input
              value={value[key] || ''}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              placeholder={SOCIAL_LINK_PLACEHOLDERS[key]}
              disabled={disabled}
              inputMode="url"
              maxLength={500}
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function ProfilePanel() {
  const location = useLocation()
  const navigate = useNavigate()
  const profileType = profileTypeFromPath(location.pathname)
  const { user, switchContext } = useAuth()
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null)

  const reloadCompletion = useCallback(async (signal?: AbortSignal) => {
    const next = await fetchProfileCompletion(profileType, signal)
    if (!signal?.aborted) setCompletion(next)
  }, [profileType])

  useEffect(() => {
    const controller = new AbortController()
    reloadCompletion(controller.signal).catch((err: unknown) => {
      if (!controller.signal.aborted) toast.danger(getErrorMessage(err))
    })
    return () => controller.abort()
  }, [reloadCompletion, user?.uid])

  if (!user) return null
  const roles = user.roles ?? [user.role]

  async function openExpertContext() {
    try {
      if (roles.includes('provider')) {
        await switchContext('provider')
        navigate('/dashboard/provider/profile')
        return
      }
      navigate('/dashboard/user/become-expert')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    }
  }

  async function openCompanyContext() {
    try {
      if (roles.includes('company')) {
        await switchContext('company')
        navigate('/dashboard/company/profile')
        return
      }
      navigate('/dashboard/user/create-company')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    }
  }

  const title = profileType === 'expert'
    ? 'Profili i ekspertit'
    : profileType === 'company'
      ? 'Profili i kompanisë'
      : 'Profili privat'

  const description = profileType === 'expert'
    ? 'Fotoja, titulli, kategoria, bio, specializimet, vitet e përvojës dhe zona e shërbimit janë të detyrueshme. Përvoja e punës, arsimi, certifikimet dhe rrjetet sociale janë opsionale. Emri publik vjen nga profili privat.'
    : profileType === 'company'
      ? 'Emri, logo, email, telefoni, qyteti, përshkrimi dhe kategoria janë të detyrueshme. Website, adresa dhe rrjetet sociale janë opsionale.'
      : 'Emri dhe mbiemri janë të detyrueshme. Fotoja, telefoni, qyteti, gjuhët dhe rrjetet sociale janë opsionale.'

  return (
    <section className="provider-section">
      <DashPageHeader title={title} description={description} />

      {profileType === 'private' ? (
        <div className="profile-role-options">
          {roles.includes('provider') ? (
            <button type="button" className="ghost link-btn" onClick={() => void openExpertContext()}>
              Profili i ekspertit
            </button>
          ) : (
            <button type="button" className="ghost link-btn" onClick={() => void openExpertContext()}>
              Bëhu ekspert
            </button>
          )}
          {roles.includes('company') ? (
            <button type="button" className="ghost link-btn" onClick={() => void openCompanyContext()}>
              Profili i kompanisë
            </button>
          ) : (
            <button type="button" className="ghost link-btn" onClick={() => void openCompanyContext()}>
              Krijo kompaninë
            </button>
          )}
        </div>
      ) : null}

      {profileType === 'expert' ? <ExpertInvitationsPanel /> : null}

      <CompletionCard completion={completion} />

      {profileType === 'private' ? <PrivateProfileSection onSaved={reloadCompletion} /> : null}
      {profileType === 'expert' ? <ExpertProfileSection onSaved={reloadCompletion} /> : null}
      {profileType === 'company' ? <CompanyProfileSection onSaved={reloadCompletion} /> : null}
    </section>
  )
}

function PrivateProfileSection({ onSaved }: { onSaved: () => Promise<void> }) {
  const { user, updateProfile, uploadProfilePhoto } = useAuth()
  const { languages: languageOptions } = useCatalogOptions()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState<LocationSelection | null>(null)
  const [languages, setLanguages] = useState<string[]>([])
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(socialLinksFrom())
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!user) return
    setFirstName(user.firstName || '')
    setLastName(user.lastName || '')
    setPhone(user.phone || '')
    setLanguages(user.languages || [])
    setSocialLinks(socialLinksFrom(user.socialLinks))
    setPreview(mediaUrl(user.profilePhoto))
  }, [user])

  useEffect(() => {
    if (!user?.savedLocation) {
      setCity(null)
      return
    }
    const controller = new AbortController()
    resolveSavedLocation(user.savedLocation, controller.signal)
      .then((value) => { if (!controller.signal.aborted) setCity(value) })
      .catch(() => { if (!controller.signal.aborted) setCity(null) })
    return () => controller.abort()
  }, [user?.savedLocation])

  function toggleLanguage(lang: string) {
    setLanguages((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]))
  }

  async function onSavePrivate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await updateProfile({
        firstName,
        lastName,
        phone: phone.trim() || null,
        languages,
        socialLinks,
        savedLocation: city
          ? { countryId: city.country._id, cityId: city.city._id }
          : null,
      })
      await onSaved()
      toast.success('Profili privat u ruajt.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function onPhotoChange(file: File | undefined) {
    if (!file || !user) return
    setError('')
    try {
      validateImageFile(file)
    } catch (err) {
      setError(getErrorMessage(err))
      return
    }
    setUploading(true)
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)
    try {
      const next = await uploadProfilePhoto(file)
      setPreview(mediaUrl(next.profilePhoto))
      await onSaved()
      toast.success('Fotoja e profilit u ngarkua.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
      setPreview(mediaUrl(user.profilePhoto))
    } finally {
      setUploading(false)
      URL.revokeObjectURL(localPreview)
    }
  }

  if (!user) return null

  return (
    <div className="profile-section-block">
      <div className="profile-photo-row">
        <div className="profile-avatar-lg" aria-hidden>
          {preview ? <img src={preview} alt="" /> : <span>{user.name.slice(0, 1)}</span>}
        </div>
        <div className="profile-photo-actions">
          <label className="primary-btn profile-upload-btn">
            {uploading ? 'Duke ngarkuar...' : 'Ngarko foto'}
            <input type="file" accept={IMAGE_ACCEPT} hidden disabled={uploading} onChange={(e) => onPhotoChange(e.target.files?.[0])} />
          </label>
          <p className="muted"><FieldHint required={false} /> · {IMAGE_ACCEPT_HINT}</p>
        </div>
      </div>

      <form onSubmit={onSavePrivate} className="service-form">
        <label>
          Emri <FieldHint required />
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={80} autoComplete="given-name" />
        </label>
        <label>
          Mbiemri <FieldHint required />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={80} autoComplete="family-name" />
        </label>
        <label>
          Numri i telefonit <FieldHint required={false} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+38344123456" inputMode="tel" autoComplete="tel" maxLength={32} />
        </label>
        <div className="full field">
          <span className="profile-inline-label">Qyteti <FieldHint required={false} /></span>
          <LocationSelector value={city} onChange={setCity} disabled={saving} />
        </div>
        <label>
          Email
          <input value={user.email} disabled />
        </label>
        <fieldset className="full checkbox-fieldset">
          <legend>Gjuhët <FieldHint required={false} /></legend>
          {languageOptions.map((lang) => (
            <label key={lang.id} className="check-row">
              <input type="checkbox" checked={languages.includes(lang.value)} onChange={() => toggleLanguage(lang.value)} />
              {lang.label}
            </label>
          ))}
        </fieldset>
        <SocialLinksFields value={socialLinks} onChange={setSocialLinks} disabled={saving} />
        {error ? <p className="error full">{error}</p> : null}
        <button type="submit" className="full" disabled={saving}>
          {saving ? 'Duke ruajtur...' : 'Ruaj profilin privat'}
        </button>
      </form>
    </div>
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
    <div className="profile-month-year">
      <span className="profile-inline-label">{label}</span>
      <div className="profile-month-year-row">
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
      </div>
    </div>
  )
}

function ExpertProfileSection({ onSaved }: { onSaved: () => Promise<void> }) {
  const { user } = useAuth()
  const [domains, setDomains] = useState<DomainDefinition[]>([])
  const [profile, setProfile] = useState<ManagedProviderProfile | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const selectedDomain = useMemo(() => domains.find((domain) => domain.id === category) ?? null, [domains, category])
  const needsLicense = domainRequires(selectedDomain, 'license_verification')

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([fetchDomains(), fetchMyProviderProfiles(controller.signal)])
      .then(([domainList, providers]) => {
        if (controller.signal.aborted) return
        setDomains(domainList)
        const individual = providers.find((item) => item.providerType === 'individual') ?? null
        setProfile(individual)
        if (individual) {
          setTitle(individual.publicProfile.title || '')
          setCategory(individual.categories[0] || domainList[0]?.id || '')
          setSubcategoryId(individual.subcategoryIds?.[0] || '')
          setBio(individual.publicProfile.description || '')
          setYearsOfExperience(
            typeof individual.yearsOfExperience === 'number' ? String(individual.yearsOfExperience) : '',
          )
          setLicenseNumber(individual.qualificationClaims?.[0]?.referenceNumber || '')
          setSkillsText((individual.specializations || []).join(', '))
          setSocialLinks(socialLinksFrom(individual.socialLinks))
          setWorkExperience(individual.workExperience?.length ? individual.workExperience : [])
          setEducation(individual.education?.length ? individual.education : [])
          setCertifications(individual.certifications?.length ? individual.certifications : [])
          setPhotoPreview(mediaUrl(individual.publicProfile.photoUrl))
        }
      })
      .catch((err: unknown) => { if (!controller.signal.aborted) setError(getErrorMessage(err)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

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
      })
      .catch((err: unknown) => { if (!controller.signal.aborted) setError(getErrorMessage(err)) })
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
      setError(getErrorMessage(err))
      return
    }
    setUploading(true)
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
      setUploading(false)
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
      await onSaved()
      toast.success('Profili i ekspertit u ruajt.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="muted" role="status">Profili i ekspertit po ngarkohet...</p>

  if (!profile) {
    return (
      <div className="profile-section-block">
        <p className="muted">
          Nuk ke ende profil eksperti.{' '}
          <Link to="/dashboard/provider/create">Krijo profilin e ekspertit</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="profile-section-block">
      <p className="muted">
        Emri publik: <strong>{[user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.name || profile.publicProfile.displayName}</strong>
        {' · '}ndryshohet nga profili privat.
      </p>
      <div className="profile-photo-row">
        <div className="profile-avatar-lg" aria-hidden>
          {photoPreview ? <img src={photoPreview} alt="" /> : <span>{title.slice(0, 1) || 'E'}</span>}
        </div>
        <div className="profile-photo-actions">
          <label className="primary-btn profile-upload-btn">
            {uploading ? 'Duke ngarkuar...' : 'Ngarko foto profili'}
            <input type="file" accept={IMAGE_ACCEPT} hidden disabled={uploading || saving} onChange={(e) => onPhotoChange(e.target.files?.[0])} />
          </label>
          <p className="muted"><FieldHint required /> · {IMAGE_ACCEPT_HINT}</p>
        </div>
      </div>
      <form className="service-form" onSubmit={onSave}>
        <label>
          Titulli profesional <FieldHint required />
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} placeholder="p.sh. Avokat" />
        </label>
        <label>
          Kategoria <FieldHint required />
          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>{domain.labelSq}</option>
            ))}
          </select>
        </label>
        <label>
          Nënkategoria <FieldHint required />
          <select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)} required disabled={!subcategories.length}>
            {!subcategories.length ? <option value="">Nuk ka nënkategori</option> : null}
            {subcategories.map((item) => (
              <option key={item._id} value={item._id}>{item.name.sq}</option>
            ))}
          </select>
        </label>
        <label className="full">
          Bio / Përshkrimi <FieldHint required />
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} required rows={4} maxLength={3000} />
        </label>
        <label className="full">
          Specializimet <FieldHint required />
          <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} required placeholder="p.sh. Kontrata, Tatime" />
        </label>
        <label>
          Vitet e përvojës <FieldHint required />
          <input
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
          <label>
            Licenca / certifikimi <FieldHint required />
            <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required maxLength={120} placeholder="Numri i licencës" />
          </label>
        ) : null}
        <div className="full field">
          <span className="profile-inline-label">Qyteti / zona e shërbimit <FieldHint required /></span>
          <ProviderLocationFields
            location={location}
            serviceAreas={serviceAreas}
            onLocationChange={setLocation}
            onServiceAreasChange={setServiceAreas}
            disabled={saving}
          />
        </div>

        <fieldset className="full checkbox-fieldset profile-repeatable-fieldset">
          <legend>Përvoja e punës <FieldHint required={false} /></legend>
          {workExperience.map((entry, index) => (
            <div key={`work-${index}`} className="profile-repeatable-entry">
              <label>
                Pozita
                <input
                  value={entry.position}
                  onChange={(e) => setWorkExperience((rows) => rows.map((row, i) => (i === index ? { ...row, position: e.target.value } : row)))}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                Kompania / Organizata
                <input
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
              <label className="profile-checkbox">
                <input
                  type="checkbox"
                  checked={entry.current}
                  onChange={(e) => setWorkExperience((rows) => rows.map((row, i) => (
                    i === index ? { ...row, current: e.target.checked, to: e.target.checked ? undefined : (row.to || row.from) } : row
                  )))}
                />
                Aktualisht punoj këtu
              </label>
              <label className="full">
                Përshkrimi <FieldHint required={false} />
                <textarea
                  value={entry.description || ''}
                  onChange={(e) => setWorkExperience((rows) => rows.map((row, i) => (i === index ? { ...row, description: e.target.value } : row)))}
                  rows={2}
                  maxLength={2000}
                />
              </label>
              <button
                type="button"
                className="ghost"
                onClick={() => setWorkExperience((rows) => rows.filter((_, i) => i !== index))}
                disabled={saving}
              >
                Hiq
              </button>
            </div>
          ))}
          <button type="button" className="ghost" onClick={() => setWorkExperience((rows) => [...rows, emptyWorkExperience()])} disabled={saving}>
            Shto përvojë pune
          </button>
        </fieldset>

        <fieldset className="full checkbox-fieldset profile-repeatable-fieldset">
          <legend>Arsimi <FieldHint required={false} /></legend>
          {education.map((entry, index) => (
            <div key={`edu-${index}`} className="profile-repeatable-entry">
              <label>
                Institucioni
                <input
                  value={entry.institution}
                  onChange={(e) => setEducation((rows) => rows.map((row, i) => (i === index ? { ...row, institution: e.target.value } : row)))}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                Diploma / Programi
                <input
                  value={entry.degree}
                  onChange={(e) => setEducation((rows) => rows.map((row, i) => (i === index ? { ...row, degree: e.target.value } : row)))}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                Fusha e studimit
                <input
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
              <label className="profile-checkbox">
                <input
                  type="checkbox"
                  checked={entry.current}
                  onChange={(e) => setEducation((rows) => rows.map((row, i) => (
                    i === index ? { ...row, current: e.target.checked, to: e.target.checked ? undefined : (row.to || row.from) } : row
                  )))}
                />
                Aktualisht studioj
              </label>
              <button
                type="button"
                className="ghost"
                onClick={() => setEducation((rows) => rows.filter((_, i) => i !== index))}
                disabled={saving}
              >
                Hiq
              </button>
            </div>
          ))}
          <button type="button" className="ghost" onClick={() => setEducation((rows) => [...rows, emptyEducation()])} disabled={saving}>
            Shto arsim
          </button>
        </fieldset>

        <fieldset className="full checkbox-fieldset profile-repeatable-fieldset">
          <legend>Certifikimet <FieldHint required={false} /></legend>
          {certifications.map((entry, index) => (
            <div key={`cert-${index}`} className="profile-repeatable-entry">
              <label>
                Emri i certifikimit
                <input
                  value={entry.name}
                  onChange={(e) => setCertifications((rows) => rows.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                Institucioni që e ka lëshuar
                <input
                  value={entry.issuer}
                  onChange={(e) => setCertifications((rows) => rows.map((row, i) => (i === index ? { ...row, issuer: e.target.value } : row)))}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                Viti
                <input
                  type="number"
                  min={1950}
                  max={new Date().getFullYear() + 1}
                  step={1}
                  value={entry.year}
                  onChange={(e) => setCertifications((rows) => rows.map((row, i) => (i === index ? { ...row, year: Number(e.target.value) } : row)))}
                  required
                />
              </label>
              <label>
                URL e kredencialit
                <input
                  value={entry.credentialUrl || ''}
                  onChange={(e) => setCertifications((rows) => rows.map((row, i) => (i === index ? { ...row, credentialUrl: e.target.value } : row)))}
                  placeholder="https://"
                  inputMode="url"
                  maxLength={500}
                />
              </label>
              <button
                type="button"
                className="ghost"
                onClick={() => setCertifications((rows) => rows.filter((_, i) => i !== index))}
                disabled={saving}
              >
                Hiq
              </button>
            </div>
          ))}
          <button type="button" className="ghost" onClick={() => setCertifications((rows) => [...rows, emptyCertification()])} disabled={saving}>
            Shto certifikim
          </button>
        </fieldset>

        <SocialLinksFields value={socialLinks} onChange={setSocialLinks} disabled={saving} />
        <p className="muted full">
          Çmimi dhe verifikimi llogariten nga shërbimet / oferta dhe statusi i verifikimit kur aplikohen.
          Përvoja e punës, arsimi, certifikimet dhe rrjetet sociale janë opsionale.
        </p>
        {error ? <p className="error full">{error}</p> : null}
        <button type="submit" className="full" disabled={saving || uploading}>
          {saving ? 'Duke ruajtur...' : 'Ruaj profilin e ekspertit'}
        </button>
      </form>
    </div>
  )
}

function CompanyProfileSection({ onSaved }: { onSaved: () => Promise<void> }) {
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [business, setBusiness] = useState<BusinessProfile | null>(null)
  const [publicName, setPublicName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState('')
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(socialLinksFrom())
  const [city, setCity] = useState<LocationSelection | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([fetchCategories(controller.signal), fetchMyBusinesses(controller.signal)])
      .then(([categoryList, businesses]) => {
        if (controller.signal.aborted) return
        const active = categoryList
          .filter((item) => item.isActive)
          .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
        setCategories(active)
        const current = businesses[0] ?? null
        setBusiness(current)
        if (current) {
          setPublicName(current.publicName || '')
          setContactEmail(current.contactEmail || '')
          setContactPhone(current.contactPhone || '')
          setDescription(current.description || '')
          setCategoryId(matchCatalogCategoryId(active, current.categoryIds?.[0]))
          setWebsite(current.website || '')
          setAddress(current.branches?.[0]?.location?.address || '')
          setSocialLinks(socialLinksFrom(current.socialLinks))
          setLogoPreview(mediaUrl(current.logoUrl))
        }
      })
      .catch((err: unknown) => { if (!controller.signal.aborted) setError(getErrorMessage(err)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!business?.location) {
      setCity(null)
      return
    }
    const controller = new AbortController()
    resolveSavedLocation(business.location, controller.signal)
      .then((value) => { if (!controller.signal.aborted) setCity(value) })
      .catch(() => { if (!controller.signal.aborted) setCity(null) })
    return () => controller.abort()
  }, [business?.location])

  async function onLogoChange(file: File | undefined) {
    if (!file || !business) return
    try {
      validateImageFile(file)
    } catch (err) {
      setError(getErrorMessage(err))
      return
    }
    setUploading(true)
    const local = URL.createObjectURL(file)
    setLogoPreview(local)
    try {
      const next = await uploadBusinessLogo(business._id, file)
      setBusiness(next)
      setLogoPreview(mediaUrl(next.logoUrl))
      await onSaved()
      toast.success('Logoja u ngarkua.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
      setLogoPreview(mediaUrl(business.logoUrl))
    } finally {
      setUploading(false)
      URL.revokeObjectURL(local)
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!business) return
    if (!city) {
      setError('Qyteti i kompanisë është i detyrueshëm.')
      return
    }
    if (!categoryId) {
      setError('Kategoria / industria është e detyrueshme.')
      return
    }
    const selected = categories.find((item) => item._id === categoryId)
    if (!selected) {
      setError('Kategoria nuk është e vlefshme.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const next = await updateBusinessProfile(business._id, {
        publicName,
        contactEmail,
        contactPhone,
        description,
        categoryIds: [selected.slug || selected._id],
        website: website.trim() || null,
        socialLinks,
        location: { countryId: city.country._id, cityId: city.city._id },
        branches: address.trim()
          ? [{
            name: publicName || 'Selia',
            location: {
              countryCode: 'XK',
              cityName: city.city.name.sq,
              cityId: city.city._id,
              address: address.trim(),
              online: false,
            },
          }]
          : [],
      })
      setBusiness(next)
      await onSaved()
      toast.success('Profili i kompanisë u ruajt.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="muted" role="status">Profili i kompanisë po ngarkohet...</p>

  if (!business) {
    return (
      <div className="profile-section-block">
        <p className="muted">
          Nuk ke ende kompani.{' '}
          <Link to="/dashboard/company/create">Krijo kompaninë</Link>
        </p>
      </div>
    )
  }

  const statusLabel = business.status === 'active'
    ? 'Aktive'
    : business.status === 'suspended'
      ? 'Pezulluar'
      : business.status === 'closed'
        ? 'E mbyllur'
        : 'Draft'

  return (
    <div className="profile-section-block">
      <p className="muted profile-company-status">
        Statusi i kompanisë: <strong>{statusLabel}</strong>
        {' · '}
        Verifikimi: <strong>{business.verification?.status === 'verified' ? 'I verifikuar' : 'I paverifikuar'}</strong>
      </p>
      <div className="profile-photo-row">
        <div className="profile-avatar-lg" aria-hidden>
          {logoPreview ? <img src={logoPreview} alt="" /> : <span>{publicName.slice(0, 1) || 'K'}</span>}
        </div>
        <div className="profile-photo-actions">
          <label className="primary-btn profile-upload-btn">
            {uploading ? 'Duke ngarkuar...' : 'Ngarko logo'}
            <input type="file" accept={IMAGE_ACCEPT} hidden disabled={uploading || saving} onChange={(e) => onLogoChange(e.target.files?.[0])} />
          </label>
          <p className="muted"><FieldHint required /> · {IMAGE_ACCEPT_HINT}</p>
        </div>
      </div>
      <form className="service-form" onSubmit={onSave}>
        <label>
          Emri i kompanisë <FieldHint required />
          <input value={publicName} onChange={(e) => setPublicName(e.target.value)} required maxLength={160} />
        </label>
        <label>
          Email i kompanisë <FieldHint required />
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required type="email" maxLength={160} />
        </label>
        <label>
          Numri i telefonit <FieldHint required />
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required placeholder="+38344123456" maxLength={32} />
        </label>
        <div className="full field">
          <span className="profile-inline-label">Qyteti <FieldHint required /></span>
          <LocationSelector value={city} onChange={setCity} disabled={saving} />
        </div>
        <label className="full">
          Përshkrimi <FieldHint required />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} maxLength={3000} />
        </label>
        <label>
          Kategoria / industria <FieldHint required />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required disabled={!categories.length}>
            <option value="">{categories.length ? 'Zgjidh kategorinë' : 'Duke ngarkuar kategoritë…'}</option>
            {categories.map((item) => (
              <option key={item._id} value={item._id}>{item.name.sq}</option>
            ))}
          </select>
        </label>
        <label>
          Website <FieldHint required={false} />
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" maxLength={500} />
        </label>
        <label className="full">
          Adresa <FieldHint required={false} />
          <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={240} />
        </label>
        <SocialLinksFields value={socialLinks} onChange={setSocialLinks} disabled={saving} />
        {error ? <p className="error full">{error}</p> : null}
        <button type="submit" className="full" disabled={saving || uploading || !categories.length}>
          {saving ? 'Duke ruajtur...' : 'Ruaj profilin e kompanisë'}
        </button>
      </form>
    </div>
  )
}
