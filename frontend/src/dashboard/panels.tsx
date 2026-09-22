import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { IMAGE_ACCEPT, IMAGE_ACCEPT_HINT, MAX_SERVICE_PHOTOS, mediaUrl } from '../api/media'
import { createCustomDomain, fetchDomains } from '../api/domains'
import { createExpert, fetchMyExperts, type ExpertItem } from '../api/experts'
import {
  fetchRateableProviders,
  type RateableProvider,
} from '../api/ratings'
import {
  createService,
  deleteService,
  fetchMyServices,
  updateService,
  uploadServicePhoto,
  type ServiceDetails,
  type ServiceItem,
} from '../api/services'
import RateProvider from '../components/RateProvider'
import CompanyTeamPanel from './CompanyTeamPanel'
import {
  AUDIENCE_OPTIONS,
  DELIVERY_MODES,
  LANGUAGE_OPTIONS,
  OFFER_TYPES,
  domainRequires,
  type DomainDefinition,
} from '../data/domains'
import { getErrorMessage } from '../utils/errors'
import DashPageHeader from './DashPageHeader'
import LocationSelector from '../components/LocationSelector'
import { locationLabel, matchLocationByText, type LocationSelection } from '../api/locations'

function useDomains() {
  const [domains, setDomains] = useState<DomainDefinition[]>([])
  useEffect(() => {
    fetchDomains()
      .then(setDomains)
      .catch(() => setDomains([]))
  }, [])
  return domains
}

export function UserRateProvidersPanel() {
  const [providers, setProviders] = useState<RateableProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchRateableProviders()
      .then((items) => {
        if (!cancelled) setProviders(items)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="provider-section">
      <DashPageHeader
        title="Si ishte shërbimi?"
        description="Këtu shfaqen ofruesit me të cilët ke përfunduar një bashkëpunim. Zgjidh yjet dhe, nëse do, shto një koment."
      />

      {loading ? <p className="muted">Duke u ngarkuar…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && providers.length === 0 ? (
        <p className="muted">
          Nuk ke ende një shërbim të përfunduar. Kur ofruesi ta shënojë kërkesën si të përfunduar, mund ta vlerësosh këtu.
        </p>
      ) : null}

      <ul className="rate-provider-list">
        {providers.map((provider) => (
          <li key={provider.providerId || provider.providerUid}>
            <div>
              <strong>{provider.providerName}</strong>
              <span className="muted">{provider.titles.slice(0, 2).join(' · ')}</span>
            </div>
            <RateProvider
              providerUid={provider.providerUid}
              providerName={provider.providerName}
              providerId={provider.providerId}
              interaction={provider.interaction}
              initialAverage={provider.average}
              initialCount={provider.count}
              onRated={(stats) => {
                setProviders((prev) =>
                  prev
                    .map((p) =>
                      p.providerUid === stats.providerUid
                        ? { ...p, average: stats.average, count: stats.count, interaction: undefined }
                        : p,
                    )
                    .filter((p) => p.providerUid !== stats.providerUid || Boolean(p.interaction)),
                )
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

function DomainFieldsHint({ domain }: { domain: DomainDefinition | null }) {
  if (!domain) return null
  return (
    <div className="domain-hint full">
      <strong>
        {domain.labelSq} <span className="muted">({domain.labelDe})</span>
      </strong>
      <p className="muted">Shembuj: {domain.examples.join(' · ')}</p>
      {domainRequires(domain, 'license_verification') ? (
        <p>Kërkohet Verification / License — nuk mjafton vetëm emri dhe profili.</p>
      ) : null}
      {domain.guidelines?.sq ? <p>{domain.guidelines.sq}</p> : null}
    </div>
  )
}

export function ProviderServicesPanel() {
  const domains = useDomains()
  const formRef = useRef<HTMLFormElement>(null)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('business-founding')
  const [subcategory, setSubcategory] = useState('')
  const [location, setLocation] = useState<LocationSelection | null>(null)
  const [priceFrom, setPriceFrom] = useState('')
  const [priceTo, setPriceTo] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [serviceTypeDetail, setServiceTypeDetail] = useState('')
  const [documentsNote, setDocumentsNote] = useState('')
  const [deadlineNote, setDeadlineNote] = useState('')
  const [audience, setAudience] = useState<'b2c' | 'b2b' | 'both'>('both')
  const [deliveryModes, setDeliveryModes] = useState<Array<'online' | 'physical' | 'group'>>([])
  const [languageFrom, setLanguageFrom] = useState('Shqip')
  const [languageTo, setLanguageTo] = useState('Gjermanisht')
  const [certifiedTranslation, setCertifiedTranslation] = useState(false)
  const [offerType, setOfferType] = useState<'package' | 'project' | 'service'>('package')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [references, setReferences] = useState('')
  const [coachingOk, setCoachingOk] = useState(false)
  const [supportLanguages, setSupportLanguages] = useState<string[]>(['Shqip', 'Gjermanisht'])
  const [photos, setPhotos] = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState('')

  const selectedDomain = useMemo(
    () => domains.find((d) => d.id === categoryId) ?? null,
    [domains, categoryId],
  )
  const subcategoryOptions = useMemo(() => {
    const examples = selectedDomain?.examples ?? ['Tjetër']
    return subcategory && !examples.includes(subcategory) ? [subcategory, ...examples] : examples
  }, [selectedDomain, subcategory])

  useEffect(() => {
    let cancelled = false
    fetchMyServices()
      .then((items) => {
        if (!cancelled) setServices(items)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (editingId || !selectedDomain?.examples[0]) return
    setSubcategory((current) =>
      selectedDomain.examples.includes(current) ? current : selectedDomain.examples[0],
    )
  }, [selectedDomain, editingId])

  function toggleDelivery(mode: 'online' | 'physical' | 'group') {
    setDeliveryModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    )
  }

  function toggleSupportLanguage(lang: string) {
    setSupportLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    )
  }

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setLocation(null)
    setPriceFrom('')
    setPriceTo('')
    setLicenseNumber('')
    setServiceTypeDetail('')
    setDocumentsNote('')
    setDeadlineNote('')
    setAudience('both')
    setDeliveryModes([])
    setLanguageFrom('Shqip')
    setLanguageTo('Gjermanisht')
    setCertifiedTranslation(false)
    setOfferType('package')
    setPortfolioUrl('')
    setReferences('')
    setCoachingOk(false)
    setSupportLanguages(['Shqip', 'Gjermanisht'])
    setPhotos([])
  }

  function startEdit(service: ServiceItem) {
    const details = service.details || {}
    setEditingId(service.id)
    setTitle(service.title)
    setDescription(service.description)
    setCategoryId(service.categoryId || categoryId)
    setSubcategory(service.subcategory)
    setLocation(null)
    void matchLocationByText(service.location).then(setLocation)
    setPriceFrom(service.priceFrom != null ? String(service.priceFrom) : '')
    setPriceTo(details.priceTo != null ? String(details.priceTo) : '')
    setLicenseNumber(details.licenseNumber || '')
    setServiceTypeDetail(details.serviceTypeDetail || '')
    setDocumentsNote(details.documentsNote || '')
    setDeadlineNote(details.deadlineNote || '')
    setAudience(details.audience || 'both')
    setDeliveryModes(details.deliveryModes || [])
    setLanguageFrom(details.languageFrom || 'Shqip')
    setLanguageTo(details.languageTo || 'Gjermanisht')
    setCertifiedTranslation(Boolean(details.certifiedTranslation))
    setOfferType(details.offerType || 'package')
    setPortfolioUrl(details.portfolioUrl || '')
    setReferences(details.references || '')
    setCoachingOk(Boolean(details.coachingDisclaimerAccepted))
    setSupportLanguages(details.supportLanguages?.length ? details.supportLanguages : ['Shqip', 'Gjermanisht'])
    setPhotos(details.photos || [])
    setError('')
    setSuccess('')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function collectDetails(): ServiceDetails {
    const details: ServiceDetails = { photos }
    if (licenseNumber.trim()) details.licenseNumber = licenseNumber.trim()
    if (serviceTypeDetail.trim()) details.serviceTypeDetail = serviceTypeDetail.trim()
    if (documentsNote.trim()) details.documentsNote = documentsNote.trim()
    if (deadlineNote.trim()) details.deadlineNote = deadlineNote.trim()
    details.audience = audience
    if (deliveryModes.length) details.deliveryModes = deliveryModes
    details.languageFrom = languageFrom
    details.languageTo = languageTo
    details.certifiedTranslation = certifiedTranslation
    details.offerType = offerType
    if (priceTo.trim()) details.priceTo = Number(priceTo)
    if (portfolioUrl.trim()) details.portfolioUrl = portfolioUrl.trim()
    if (references.trim()) details.references = references.trim()
    if (coachingOk) details.coachingDisclaimerAccepted = true
    if (supportLanguages.length) {
      details.crossBorder = true
      details.supportLanguages = supportLanguages
    }
    return details
  }

  async function onPhotoChange(file: File | undefined) {
    if (!file) return
    setError('')
    setUploadingPhoto(true)
    try {
      const url = await uploadServicePhoto(file)
      setPhotos((prev) => [...prev, url].slice(0, MAX_SERVICE_PHOTOS))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (domainRequires(selectedDomain, 'delivery_mode') && deliveryModes.length === 0) {
      setError('Zgjidh të paktën një mënyrë mbajtjeje (online, fizikisht ose grup).')
      return
    }
    if (domainRequires(selectedDomain, 'license_verification') && !licenseNumber.trim()) {
      setError('Numri i licencës është i detyrueshëm për këtë kategori.')
      return
    }
    if (domainRequires(selectedDomain, 'coaching_boundary') && !coachingOk) {
      setError('Duhet të pranosh kufirin e coaching-ut për këtë kategori.')
      return
    }
    if (domainRequires(selectedDomain, 'documents_deadlines') && !serviceTypeDetail.trim()) {
      setError('Lloji i shërbimit është i detyrueshëm për këtë kategori.')
      return
    }
    if (domainRequires(selectedDomain, 'portfolio_references') && !portfolioUrl.trim() && !references.trim()) {
      setError('Shto një portfolio ose një referencë për këtë kategori.')
      return
    }
    if (domainRequires(selectedDomain, 'cross_border_multilingual') && supportLanguages.length === 0) {
      setError('Zgjidh të paktën një gjuhë për këtë kategori.')
      return
    }
    if (!location) {
      setError('Zgjidh lokacionin nga lista e qyteteve.')
      return
    }
    setSubmitting(true)
    const payload = {
      title,
      description,
      categoryId,
      subcategory,
      location: locationLabel(location, 'sq'),
      priceFrom: priceFrom.trim() ? Number(priceFrom) : undefined,
      details: collectDetails(),
    }
    try {
      if (editingId) {
        const service = await updateService(editingId, payload)
        setServices((prev) => prev.map((item) => (item.id === service.id ? service : item)))
        resetForm()
        setSuccess('Shërbimi u përditësua.')
      } else {
        const service = await createService(payload)
        setServices((prev) => [service, ...prev])
        resetForm()
        setSuccess('Shërbimi u publikua dhe shfaqet te ofertat.')
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm('A je i sigurt që do ta fshish këtë shërbim?')) return
    setError('')
    setSuccess('')
    setDeletingId(id)
    try {
      await deleteService(id)
      setServices((prev) => prev.filter((item) => item.id !== id))
      if (editingId === id) resetForm()
      setSuccess('Shërbimi u fshi.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDeletingId('')
    }
  }

  return (
    <section className="provider-section">
      <DashPageHeader
        title={editingId ? 'Ndrysho shërbimin' : 'Ofro një shërbim'}
        description="Plotëso fushat e shërbimit, shto foto të punës dhe menaxho ofertat: shiko, ndrysho ose fshij."
      />

      <form ref={formRef} onSubmit={onSubmit} className="service-form">
        <label>
          Domeni / kategoria
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.labelSq} ({d.labelDe})
              </option>
            ))}
          </select>
        </label>

        <label>
          Nënkategoria / shembulli
          <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} required>
            {subcategoryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <DomainFieldsHint domain={selectedDomain} />

        <label>
          Titulli
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label className="full">
          Lokacioni
          <LocationSelector value={location} onChange={setLocation} />
        </label>

        <label>
          Çmimi nga (€)
          <input
            type="number"
            min={0}
            value={priceFrom}
            onChange={(e) => setPriceFrom(e.target.value)}
          />
        </label>

        <label>
          Çmimi deri (€)
          <input
            type="number"
            min={0}
            value={priceTo}
            onChange={(e) => setPriceTo(e.target.value)}
            placeholder="p.sh. 1500"
          />
        </label>

        <label>
          Lloji i ofertës
          <select
            value={offerType}
            onChange={(e) => setOfferType(e.target.value as 'package' | 'project' | 'service')}
          >
            {OFFER_TYPES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          License / Verification
          <input
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            placeholder="Numri i licencës së avokatit / ekspertit"
            required={domainRequires(selectedDomain, 'license_verification')}
          />
        </label>

        <label>
          Lloji i shërbimit
          <input
            value={serviceTypeDetail}
            onChange={(e) => setServiceTypeDetail(e.target.value)}
            placeholder="p.sh. Deklarata tatimore mujore"
            required={domainRequires(selectedDomain, 'documents_deadlines')}
          />
        </label>

        <label>
          Dokumentet
          <input
            value={documentsNote}
            onChange={(e) => setDocumentsNote(e.target.value)}
            placeholder="Çfarë dokumentesh duhen"
          />
        </label>

        <label className="full">
          Afatet
          <input
            value={deadlineNote}
            onChange={(e) => setDeadlineNote(e.target.value)}
            placeholder="p.sh. deri më 15 të muajit"
          />
        </label>

        <label>
          Audienca
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as 'b2c' | 'b2b' | 'both')}
          >
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="full checkbox-fieldset">
          <legend>Mënyra e mbajtjes</legend>
          {DELIVERY_MODES.map((mode) => (
            <label key={mode.id} className="check-row">
              <input
                type="checkbox"
                checked={deliveryModes.includes(mode.id)}
                onChange={() => toggleDelivery(mode.id)}
              />
              {mode.label}
            </label>
          ))}
        </fieldset>

        <label>
          Nga gjuha
          <select value={languageFrom} onChange={(e) => setLanguageFrom(e.target.value)}>
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Në gjuhën
          <select value={languageTo} onChange={(e) => setLanguageTo(e.target.value)}>
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="full check-row">
          <input
            type="checkbox"
            checked={certifiedTranslation}
            onChange={(e) => setCertifiedTranslation(e.target.checked)}
          />
          Përkthim i noterizuar / certifikuar
        </label>

        <label>
          Portfolio URL
          <input
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>
        <label>
          Referenca
          <input
            value={references}
            onChange={(e) => setReferences(e.target.value)}
            placeholder="Klienti / projekti"
          />
        </label>

        <label className="full check-row">
          <input
            type="checkbox"
            checked={coachingOk}
            onChange={(e) => setCoachingOk(e.target.checked)}
            required={domainRequires(selectedDomain, 'coaching_boundary')}
          />
          Coaching nuk është terapi ose trajtim mjekësor.
        </label>

        <fieldset className="full checkbox-fieldset">
          <legend>Gjuhë (cross-border / diaspora)</legend>
          {LANGUAGE_OPTIONS.map((lang) => (
            <label key={lang} className="check-row">
              <input
                type="checkbox"
                checked={supportLanguages.includes(lang)}
                onChange={() => toggleSupportLanguage(lang)}
              />
              {lang}
            </label>
          ))}
        </fieldset>

        <label className="full">
          Përshkrimi
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
          />
        </label>

        <div className="full service-photo-picker">
          <span>Foto të punës (deri {MAX_SERVICE_PHOTOS})</span>
          <div className="service-photo-grid">
            {photos.map((url) => (
              <div key={url} className="service-photo-tile">
                <img src={mediaUrl(url)} alt="" />
                <button
                  type="button"
                  className="service-photo-remove"
                  onClick={() => setPhotos((prev) => prev.filter((item) => item !== url))}
                  aria-label="Hiq foton"
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < MAX_SERVICE_PHOTOS ? (
              <label className="service-photo-add">
                {uploadingPhoto ? '...' : '+'}
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  hidden
                  disabled={uploadingPhoto}
                  onChange={(e) => {
                    void onPhotoChange(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
            ) : null}
          </div>
          <p className="muted">{IMAGE_ACCEPT_HINT}. Këto foto shfaqen te oferta dhe te profili publik.</p>
        </div>

        {error ? <p className="error full">{error}</p> : null}
        {success ? <p className="success full">{success}</p> : null}

        <div className="full form-actions">
          <button type="submit" disabled={submitting || uploadingPhoto}>
            {submitting
              ? editingId
                ? 'Duke ruajtur...'
                : 'Duke publikuar...'
              : editingId
                ? 'Ruaj ndryshimet'
                : 'Publiko shërbimin'}
          </button>
          {editingId ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                resetForm()
                setSuccess('')
                setError('')
              }}
            >
              Anulo
            </button>
          ) : null}
        </div>
      </form>

      <div className="services-list">
        <h3>Shërbimet e mia</h3>
        {loading ? <p className="muted">Duke u ngarkuar...</p> : null}
        {!loading && services.length === 0 ? (
          <p className="muted">Nuk ke publikuar ende asnjë shërbim.</p>
        ) : null}
        <ul>
          {services.map((service) => (
            <li key={service.id} className={editingId === service.id ? 'is-editing' : undefined}>
              <strong>{service.title}</strong>
              <span>
                {service.categoryLabel || service.category} · {service.subcategory} ·{' '}
                {service.location}
                {service.priceFrom != null ? ` · nga €${service.priceFrom}` : ''}
                {service.details?.priceTo != null ? `–€${service.details.priceTo}` : ''}
              </span>
              {service.details?.licenseNumber ? (
                <span>License: {service.details.licenseNumber}</span>
              ) : null}
              {service.details?.languageFrom && service.details?.languageTo ? (
                <span>
                  {service.details.languageFrom} → {service.details.languageTo}
                </span>
              ) : null}
              {service.details?.deliveryModes?.length ? (
                <span>{service.details.deliveryModes.join(' · ')}</span>
              ) : null}
              <p>{service.description}</p>
              {service.details?.photos?.length ? (
                <div className="services-list-thumbs">
                  {service.details.photos.map((url) => (
                    <img key={url} src={mediaUrl(url)} alt="" />
                  ))}
                </div>
              ) : null}
              <div className="services-list-actions">
                <Link className="ghost link-btn" to={`/services/${service.id}`}>
                  Shiko
                </Link>
                <button type="button" className="ghost" onClick={() => startEdit(service)}>
                  Ndrysho
                </button>
                <button
                  type="button"
                  className="ghost danger-ghost"
                  disabled={deletingId === service.id}
                  onClick={() => void onDelete(service.id)}
                >
                  {deletingId === service.id ? 'Duke fshirë...' : 'Fshi'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function CompanyExpertsPanel() {
  const domains = useDomains()
  const [experts, setExperts] = useState<ExpertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('law')
  const [specialty, setSpecialty] = useState('')
  const [location, setLocation] = useState<LocationSelection | null>(null)
  const [bio, setBio] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [languageFrom, setLanguageFrom] = useState('Shqip')
  const [languageTo, setLanguageTo] = useState('Gjermanisht')
  const [deliveryModes, setDeliveryModes] = useState<Array<'online' | 'physical' | 'group'>>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedDomain = useMemo(
    () => domains.find((d) => d.id === categoryId) ?? null,
    [domains, categoryId],
  )

  useEffect(() => {
    let cancelled = false
    fetchMyExperts()
      .then((items) => {
        if (!cancelled) setExperts(items)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedDomain?.examples[0]) setSpecialty(selectedDomain.examples[0])
  }, [selectedDomain])

  function toggleDelivery(mode: 'online' | 'physical' | 'group') {
    setDeliveryModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!location) {
      setError('Zgjidh lokacionin nga lista e qyteteve.')
      return
    }
    setSubmitting(true)
    try {
      const expert = await createExpert({
        name,
        title,
        categoryId,
        specialty,
        bio,
        location: locationLabel(location, 'sq'),
        licenseNumber: domainRequires(selectedDomain, 'license_verification')
          ? licenseNumber
          : undefined,
        languageFrom: domainRequires(selectedDomain, 'language_pair') ? languageFrom : undefined,
        languageTo: domainRequires(selectedDomain, 'language_pair') ? languageTo : undefined,
        deliveryModes: domainRequires(selectedDomain, 'delivery_mode') ? deliveryModes : undefined,
        crossBorder: domainRequires(selectedDomain, 'cross_border_multilingual') ? true : undefined,
      })
      setExperts((prev) => [expert, ...prev])
      setName('')
      setTitle('')
      setLocation(null)
      setBio('')
      setLicenseNumber('')
      setSuccess('Eksperti u shtua.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <CompanyTeamPanel />
    <section className="provider-section">
      <DashPageHeader
        title="Shto ekspert të kompanisë"
        description="Ekspertët shfaqen me kategorinë dhe verifikimin përkatës."
      />

      <form onSubmit={onSubmit} className="service-form">
        <label>
          Domeni
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.labelSq}
              </option>
            ))}
          </select>
        </label>

        <label>
          Specialiteti
          <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} required>
            {(selectedDomain?.examples ?? ['Tjetër']).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <DomainFieldsHint domain={selectedDomain} />

        <label>
          Emri
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Titulli / pozita
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="full">
          Lokacioni
          <LocationSelector value={location} onChange={setLocation} />
        </label>

        {domainRequires(selectedDomain, 'license_verification') ? (
          <label>
            License / Verification
            <input
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              required
            />
          </label>
        ) : null}

        {domainRequires(selectedDomain, 'language_pair') ? (
          <>
            <label>
              Nga
              <select value={languageFrom} onChange={(e) => setLanguageFrom(e.target.value)}>
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Në
              <select value={languageTo} onChange={(e) => setLanguageTo(e.target.value)}>
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        {domainRequires(selectedDomain, 'delivery_mode') ? (
          <fieldset className="full checkbox-fieldset">
            <legend>Online / Fizikisht / Grup</legend>
            {DELIVERY_MODES.map((mode) => (
              <label key={mode.id} className="check-row">
                <input
                  type="checkbox"
                  checked={deliveryModes.includes(mode.id)}
                  onChange={() => toggleDelivery(mode.id)}
                />
                {mode.label}
              </label>
            ))}
          </fieldset>
        ) : null}

        <label className="full">
          Bio
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} required />
        </label>

        {error ? <p className="error full">{error}</p> : null}
        {success ? <p className="success full">{success}</p> : null}

        <button type="submit" className="full" disabled={submitting}>
          {submitting ? 'Duke shtuar...' : 'Shto ekspertin'}
        </button>
      </form>

      <div className="services-list">
        <h3>Ekspertët e kompanisë</h3>
        {loading ? <p className="muted">Duke u ngarkuar...</p> : null}
        {!loading && experts.length === 0 ? (
          <p className="muted">Nuk ke shtuar ende asnjë ekspert.</p>
        ) : null}
        <ul>
          {experts.map((expert) => (
            <li key={expert.id}>
              <strong>{expert.name}</strong>
              <span>
                {expert.categoryLabel} · {expert.title} · {expert.specialty} · {expert.location}
              </span>
              {expert.licenseNumber ? (
                <span>
                  License: {expert.licenseNumber}
                  {expert.licenseVerified ? ' · i verifikuar' : ' · në pritje të verifikimit'}
                </span>
              ) : null}
              {expert.languageFrom && expert.languageTo ? (
                <span>
                  {expert.languageFrom} → {expert.languageTo}
                </span>
              ) : null}
              <p>{expert.bio}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
    </>
  )
}

export function AdminDomainsPanel() {
  const [domains, setDomains] = useState<DomainDefinition[]>([])
  const [labelSq, setLabelSq] = useState('')
  const [labelDe, setLabelDe] = useState('')
  const [examples, setExamples] = useState('')
  const [keywords, setKeywords] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchDomains().then(setDomains).catch(() => undefined)
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const domain = await createCustomDomain({
        labelSq,
        labelDe: labelDe || labelSq,
        examples: examples
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        keywords: keywords
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      })
      setDomains((prev) => {
        const withoutOther = prev.filter((d) => d.id !== 'other')
        const other = prev.find((d) => d.id === 'other')
        return [...withoutOther, domain, ...(other ? [other] : [])]
      })
      setLabelSq('')
      setLabelDe('')
      setExamples('')
      setKeywords('')
      setSuccess('Kategoria e re u krijua (Ekspertë të tjerë / custom).')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="provider-section">
      <DashPageHeader
        title="Kategori"
        description="Sistemi ka domenet bazë. Këtu shto kategori të reja kur del një shërbim që nuk hyn te ato ekzistuese."
      />

      <ul className="domain-admin-list">
        {domains.map((d) => (
          <li key={d.id}>
            <strong>{d.labelSq}</strong>
            <span>
              {d.labelDe}
              {d.system ? ' · sistem' : ' · custom'}
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={onSubmit} className="service-form">
        <label>
          Emri (SQ)
          <input value={labelSq} onChange={(e) => setLabelSq(e.target.value)} required />
        </label>
        <label>
          Emri (DE)
          <input value={labelDe} onChange={(e) => setLabelDe(e.target.value)} />
        </label>
        <label className="full">
          Shembuj (ndarë me presje)
          <input value={examples} onChange={(e) => setExamples(e.target.value)} />
        </label>
        <label className="full">
          Keywords (ndarë me presje)
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </label>
        {error ? <p className="error full">{error}</p> : null}
        {success ? <p className="success full">{success}</p> : null}
        <button type="submit" className="full" disabled={submitting}>
          {submitting ? 'Duke krijuar...' : 'Krijo kategori të re'}
        </button>
      </form>
    </section>
  )
}
