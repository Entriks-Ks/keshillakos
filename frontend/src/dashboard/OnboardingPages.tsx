import { useEffect, useState, type FormEvent } from 'react'
import { toast } from '@heroui/react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { createCompany, becomeExpert, fetchOwnedCompany } from '../api/onboarding'
import { uploadBusinessLogo } from '../api/businesses'
import { fetchCategories, type CatalogCategory } from '../api/catalog'
import { fetchDomains } from '../api/domains'
import { IMAGE_ACCEPT, IMAGE_ACCEPT_HINT, validateImageFile } from '../api/media'
import { useAuth } from '../auth/AuthContext'
import type { DomainDefinition } from '../data/domains'
import { getErrorMessage } from '../utils/errors'
import type { LocationSelection } from '../api/locations'
import LocationSelector from '../components/LocationSelector'
import ProviderLocationFields from '../components/ProviderLocationFields'
import DashPageHeader from './DashPageHeader'

export function ExpertOnboardingPage() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const insideProviderDash = location.pathname.startsWith('/dashboard/provider')
  const profileBackTo = insideProviderDash ? '/dashboard/provider/profile' : '/dashboard/user/profile'
  const [domains, setDomains] = useState<DomainDefinition[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [languages, setLanguages] = useState('')
  const [mode, setMode] = useState<'online' | 'on_site'>('online')
  const [serviceLocation, setServiceLocation] = useState<LocationSelection | null>(null)
  const [serviceAreas, setServiceAreas] = useState<LocationSelection[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const publicName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.name || ''

  useEffect(() => {
    fetchDomains().then((items) => {
      setDomains(items)
      setCategory((current) => current || items[0]?.id || '')
    }).catch((err) => setError(getErrorMessage(err)))
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!publicName.trim()) {
      setError('Plotëso emrin dhe mbiemrin në profilin privat para se të bëhesh ekspert.')
      return
    }
    if (!serviceLocation || (mode === 'on_site' && !serviceAreas.length)) {
      setError('Zgjidh lokacionin dhe të paktën një qytet ku ofron shërbime.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await becomeExpert({
        displayName: publicName,
        title,
        description,
        categories: [category],
        languages: languages.split(',').map((value) => value.trim()).filter(Boolean),
        mode,
        location: { countryId: serviceLocation.country._id, cityId: serviceLocation.city._id },
        serviceAreaCityIds: serviceAreas.map((area) => area.city._id),
      })
      await refreshUser()
      toast.success('Profili i ekspertit u krijua. Mund të menaxhosh profilin menjëherë.')
      navigate('/dashboard/provider/profile', { replace: true })
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="provider-section">
      <DashPageHeader
        title="Bëhu ekspert"
        description="Krijo profilin profesional mbi llogarinë tënde. Emri publik vjen nga profili privat. Nuk krijohet llogari e re dhe nuk nevojitet miratim admini."
      />
      <form className="service-form" onSubmit={onSubmit}>
        <label>Emri publik<input value={publicName} readOnly disabled /></label>
        <label>Kategoria<select value={category} onChange={(e) => setCategory(e.target.value)} required>
          {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.labelSq}</option>)}
        </select></label>
        <label>Titulli<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} /></label>
        <label>Gjuhët (ndara me presje)<input value={languages} onChange={(e) => setLanguages(e.target.value)} /></label>
        <label>Mënyra e punës<select value={mode} onChange={(e) => setMode(e.target.value as 'online' | 'on_site')}>
          <option value="online">Online</option><option value="on_site">Në lokacion</option>
        </select></label>
        <ProviderLocationFields
          location={serviceLocation}
          serviceAreas={serviceAreas}
          onLocationChange={setServiceLocation}
          onServiceAreasChange={setServiceAreas}
          disabled={saving}
        />
        <label className="full">Përshkrimi<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} /></label>
        {error ? <p className="error full">{error}</p> : null}
        <button type="submit" className="full" disabled={saving || !category}>{saving ? 'Duke krijuar...' : 'Krijo profilin e ekspertit'}</button>
      </form>
      <p><Link to={profileBackTo}>Kthehu te profili</Link></p>
    </section>
  )
}

function FieldHint({ required }: { required: boolean }) {
  return <span className="profile-field-hint">{required ? 'E detyrueshme' : 'Opsionale'}</span>
}

export function CompanyOnboardingPage() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const insideCompanyDash = location.pathname.startsWith('/dashboard/company')
  const profileBackTo = insideCompanyDash ? '/dashboard/company/profile' : '/dashboard/user/profile'
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [checking, setChecking] = useState(true)
  const [publicName, setPublicName] = useState('')
  const [contactEmail, setContactEmail] = useState(user?.email || '')
  const [contactPhone, setContactPhone] = useState(user?.phone || '')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState<LocationSelection | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([fetchOwnedCompany(controller.signal), fetchCategories(controller.signal)])
      .then(([business, categoryList]) => {
        if (controller.signal.aborted) return
        if (business) {
          const roles = user?.roles ?? (user?.role ? [user.role] : [])
          toast.success('Ke tashmë një kompani.')
          navigate(roles.includes('company') ? '/dashboard/company/profile' : '/dashboard/user/profile', { replace: true })
          return
        }
        const active = categoryList
          .filter((item) => item.isActive)
          .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
        setCategories(active)
        setCategoryId((current) => (current && active.some((item) => item._id === current) ? current : active[0]?._id || ''))
        setChecking(false)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(getErrorMessage(err))
        setChecking(false)
      })
    return () => controller.abort()
  }, [navigate, user?.role, user?.roles])

  useEffect(() => () => {
    if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
  }, [logoPreview])

  function onLogoPick(file: File | undefined) {
    if (!file) return
    try {
      validateImageFile(file)
    } catch (err) {
      setError(getErrorMessage(err))
      return
    }
    if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setError('')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!city) {
      setError('Qyteti është i detyrueshëm.')
      return
    }
    const selected = categories.find((item) => item._id === categoryId)
    if (!selected) {
      setError('Kategoria është e detyrueshme.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const { business } = await createCompany({
        publicName,
        contactEmail,
        contactPhone,
        description,
        categoryIds: [selected.slug || selected._id],
        location: { countryId: city.country._id, cityId: city.city._id },
        website: website.trim() || undefined,
        address: address.trim() || undefined,
      })
      if (logoFile && business._id) {
        await uploadBusinessLogo(business._id, logoFile)
      }
      await refreshUser()
      toast.success('Kompania u krijua. Mund të menaxhosh profilin dhe të ftosh ekspertë menjëherë.')
      navigate('/dashboard/company/profile', { replace: true })
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (checking) {
    return (
      <section className="provider-section">
        <p className="muted" role="status">Duke kontrolluar kompaninë…</p>
      </section>
    )
  }

  return (
    <section className="provider-section">
      <DashPageHeader
        title="Krijo kompani"
        description="Pas krijimit kompania është e gatshme për përdorim. Verifikimi profesional mbetet opsional dhe i ndarë nga statusi."
      />

      <div className="profile-photo-row">
        <div className="profile-avatar-lg" aria-hidden>
          {logoPreview ? <img src={logoPreview} alt="" /> : <span>{publicName.slice(0, 1) || 'K'}</span>}
        </div>
        <div className="profile-photo-actions">
          <label className="primary-btn profile-upload-btn">
            Ngarko logo
            <input
              type="file"
              accept={IMAGE_ACCEPT}
              hidden
              disabled={saving}
              onChange={(e) => onLogoPick(e.target.files?.[0])}
            />
          </label>
          <p className="muted"><FieldHint required={false} /> · {IMAGE_ACCEPT_HINT}</p>
        </div>
      </div>

      <form className="service-form" onSubmit={onSubmit}>
        <label>
          Emri i kompanisë <FieldHint required />
          <input value={publicName} onChange={(e) => setPublicName(e.target.value)} required maxLength={160} />
        </label>
        <label>
          Email kontakti <FieldHint required />
          <input
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
            type="email"
            maxLength={160}
            autoComplete="email"
          />
        </label>
        <label>
          Numri i telefonit <FieldHint required />
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            required
            placeholder="+38344123456"
            inputMode="tel"
            maxLength={32}
            autoComplete="tel"
          />
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
            {!categories.length ? <option value="">Duke ngarkuar kategoritë…</option> : null}
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
        {error ? <p className="error full">{error}</p> : null}
        <button type="submit" className="full" disabled={saving || !categoryId || !categories.length}>
          {saving ? 'Duke krijuar...' : 'Krijo kompaninë'}
        </button>
      </form>
      <p><Link to={profileBackTo}>Kthehu te profili</Link></p>
    </section>
  )
}
