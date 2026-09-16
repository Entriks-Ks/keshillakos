import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createCustomDomain, fetchDomains } from '../api/domains'
import { createExpert, fetchMyExperts, type ExpertItem } from '../api/experts'
import {
  fetchProviderRatings,
  fetchRateableProviders,
  type RateableProvider,
} from '../api/ratings'
import {
  createService,
  fetchMyServices,
  type ServiceDetails,
  type ServiceItem,
} from '../api/services'
import RateProvider from '../components/RateProvider'
import {
  AUDIENCE_OPTIONS,
  COACHING_DISCLAIMER,
  DELIVERY_MODES,
  FINANCE_REGULATORY_NOTICE,
  LANGUAGE_OPTIONS,
  OFFER_TYPES,
  SYSTEM_DOMAINS,
  domainRequires,
  type DomainDefinition,
} from '../data/domains'
import { getErrorMessage } from '../utils/errors'

function useDomains() {
  const [domains, setDomains] = useState<DomainDefinition[]>(SYSTEM_DOMAINS)
  useEffect(() => {
    fetchDomains()
      .then(setDomains)
      .catch(() => setDomains(SYSTEM_DOMAINS))
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
      <h2>Vlerëso ofruesit</h2>
      <p className="muted">Jep yje ofruesve të shërbimeve që ke përdorur.</p>

      {loading ? <p className="muted">Duke u ngarkuar...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && providers.length === 0 ? (
        <p className="muted">Ende nuk ka ofrues të publikuar për të vlerësuar.</p>
      ) : null}

      <ul className="rate-provider-list">
        {providers.map((provider) => (
          <li key={provider.providerUid}>
            <div>
              <strong>{provider.providerName}</strong>
              <span className="muted">{provider.titles.slice(0, 2).join(' · ')}</span>
            </div>
            <RateProvider
              providerUid={provider.providerUid}
              providerName={provider.providerName}
              initialAverage={provider.average}
              initialCount={provider.count}
              onRated={(stats) => {
                setProviders((prev) =>
                  prev.map((p) =>
                    p.providerUid === stats.providerUid
                      ? { ...p, average: stats.average, count: stats.count }
                      : p,
                  ),
                )
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ProviderOwnRatings({ providerUid }: { providerUid: string }) {
  const [average, setAverage] = useState(0)
  const [count, setCount] = useState(0)
  const [ratings, setRatings] = useState<
    Array<{ id: string; raterName: string; score: number; comment?: string }>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchProviderRatings(providerUid)
      .then((data) => {
        if (cancelled) return
        setAverage(data.stats.average)
        setCount(data.stats.count)
        setRatings(data.ratings)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [providerUid])

  return (
    <section className="provider-section">
      <h2>Vlerësimet e mia</h2>
      {loading ? <p className="muted">Duke u ngarkuar...</p> : null}
      {!loading ? (
        <p className="rate-summary">
          ★ {count > 0 ? average.toFixed(1) : '—'}
          <span className="muted">
            {' '}
            · {count} {count === 1 ? 'vlerësim' : 'vlerësime'}
          </span>
        </p>
      ) : null}
      <ul className="rate-provider-list">
        {ratings.map((r) => (
          <li key={r.id}>
            <strong>
              ★ {r.score} — {r.raterName}
            </strong>
            {r.comment ? <p>{r.comment}</p> : null}
          </li>
        ))}
      </ul>
      {!loading && ratings.length === 0 ? (
        <p className="muted">Ende nuk ke asnjë vlerësim nga klientët.</p>
      ) : null}
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
      {domainRequires(domain.id, 'license_verification') ? (
        <p>Kërkohet Verification / License — nuk mjafton vetëm emri dhe profili.</p>
      ) : null}
      {domainRequires(domain.id, 'coaching_boundary') ? (
        <p>{COACHING_DISCLAIMER}</p>
      ) : null}
      {domainRequires(domain.id, 'regulatory_notice') ? (
        <p>{FINANCE_REGULATORY_NOTICE}</p>
      ) : null}
    </div>
  )
}

export function ProviderServicesPanel() {
  const domains = useDomains()
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('business-founding')
  const [subcategory, setSubcategory] = useState('')
  const [location, setLocation] = useState('')
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
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedDomain = useMemo(
    () => domains.find((d) => d.id === categoryId) ?? null,
    [domains, categoryId],
  )

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
    if (selectedDomain?.examples[0]) setSubcategory(selectedDomain.examples[0])
  }, [selectedDomain])

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const details: ServiceDetails = {}
      if (domainRequires(categoryId, 'license_verification')) {
        details.licenseNumber = licenseNumber
      }
      if (domainRequires(categoryId, 'documents_deadlines')) {
        details.serviceTypeDetail = serviceTypeDetail
        details.documentsNote = documentsNote
        details.deadlineNote = deadlineNote
      }
      if (domainRequires(categoryId, 'audience_b2c_b2b')) details.audience = audience
      if (domainRequires(categoryId, 'delivery_mode')) details.deliveryModes = deliveryModes
      if (domainRequires(categoryId, 'language_pair')) {
        details.languageFrom = languageFrom
        details.languageTo = languageTo
        details.certifiedTranslation = certifiedTranslation
      }
      if (domainRequires(categoryId, 'offer_type_packages')) {
        details.offerType = offerType
        if (priceTo.trim()) details.priceTo = Number(priceTo)
      }
      if (domainRequires(categoryId, 'portfolio_references')) {
        details.portfolioUrl = portfolioUrl
        details.references = references
      }
      if (domainRequires(categoryId, 'regulatory_notice')) {
        details.regulatoryNotice = FINANCE_REGULATORY_NOTICE
      }
      if (domainRequires(categoryId, 'coaching_boundary')) {
        details.coachingDisclaimerAccepted = coachingOk
      }
      if (domainRequires(categoryId, 'cross_border_multilingual')) {
        details.crossBorder = true
        details.supportLanguages = supportLanguages
      }

      const service = await createService({
        title,
        description,
        categoryId,
        subcategory,
        location,
        priceFrom: priceFrom.trim() ? Number(priceFrom) : undefined,
        details,
      })
      setServices((prev) => [service, ...prev])
      setTitle('')
      setDescription('')
      setLocation('')
      setPriceFrom('')
      setPriceTo('')
      setLicenseNumber('')
      setServiceTypeDetail('')
      setDocumentsNote('')
      setDeadlineNote('')
      setPortfolioUrl('')
      setReferences('')
      setCoachingOk(false)
      setSuccess('Shërbimi u publikua.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="provider-section">
      <h2>Ofro një shërbim</h2>
      <p className="muted">Zgjidh domenin — forma kërkon fushat e duhura për atë kategori.</p>

      <form onSubmit={onSubmit} className="service-form">
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
            {(selectedDomain?.examples ?? ['Tjetër']).map((item) => (
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

        <label>
          Lokacioni
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Prishtinë / Online / Diaspora"
            required
          />
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

        {domainRequires(categoryId, 'offer_type_packages') ? (
          <>
            <label>
              Lloji i ofertës
              <select
                value={offerType}
                onChange={(e) =>
                  setOfferType(e.target.value as 'package' | 'project' | 'service')
                }
              >
                {OFFER_TYPES.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
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
          </>
        ) : null}

        {domainRequires(categoryId, 'license_verification') ? (
          <label className="full">
            License / Verification (numri i licencës)
            <input
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="Numri i licencës së avokatit / ekspertit"
              required
            />
          </label>
        ) : null}

        {domainRequires(categoryId, 'documents_deadlines') ? (
          <>
            <label>
              Lloji i shërbimit
              <input
                value={serviceTypeDetail}
                onChange={(e) => setServiceTypeDetail(e.target.value)}
                placeholder="p.sh. Deklarata tatimore mujore"
                required
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
          </>
        ) : null}

        {domainRequires(categoryId, 'audience_b2c_b2b') ? (
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
        ) : null}

        {domainRequires(categoryId, 'delivery_mode') ? (
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
        ) : null}

        {domainRequires(categoryId, 'language_pair') ? (
          <>
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
          </>
        ) : null}

        {domainRequires(categoryId, 'portfolio_references') ? (
          <>
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
          </>
        ) : null}

        {domainRequires(categoryId, 'coaching_boundary') ? (
          <label className="full check-row">
            <input
              type="checkbox"
              checked={coachingOk}
              onChange={(e) => setCoachingOk(e.target.checked)}
              required
            />
            {COACHING_DISCLAIMER}
          </label>
        ) : null}

        {domainRequires(categoryId, 'cross_border_multilingual') ? (
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
        ) : null}

        <label className="full">
          Përshkrimi
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
          />
        </label>

        {error ? <p className="error full">{error}</p> : null}
        {success ? <p className="success full">{success}</p> : null}

        <button type="submit" className="full" disabled={submitting}>
          {submitting ? 'Duke publikuar...' : 'Publiko shërbimin'}
        </button>
      </form>

      <div className="services-list">
        <h3>Shërbimet e mia</h3>
        {loading ? <p className="muted">Duke u ngarkuar...</p> : null}
        {!loading && services.length === 0 ? (
          <p className="muted">Nuk ke publikuar ende asnjë shërbim.</p>
        ) : null}
        <ul>
          {services.map((service) => (
            <li key={service.id}>
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
              <p>{service.description}</p>
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
  const [location, setLocation] = useState('')
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
    setSubmitting(true)
    try {
      const expert = await createExpert({
        name,
        title,
        categoryId,
        specialty,
        bio,
        location,
        licenseNumber: domainRequires(categoryId, 'license_verification')
          ? licenseNumber
          : undefined,
        languageFrom: domainRequires(categoryId, 'language_pair') ? languageFrom : undefined,
        languageTo: domainRequires(categoryId, 'language_pair') ? languageTo : undefined,
        deliveryModes: domainRequires(categoryId, 'delivery_mode') ? deliveryModes : undefined,
        crossBorder: domainRequires(categoryId, 'cross_border_multilingual') ? true : undefined,
      })
      setExperts((prev) => [expert, ...prev])
      setName('')
      setTitle('')
      setLocation('')
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
    <section className="provider-section">
      <h2>Shto ekspert të kompanisë</h2>
      <p className="muted">Ekspertët shfaqen me kategorinë dhe verifikimin përkatës.</p>

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
        <label>
          Lokacioni
          <input value={location} onChange={(e) => setLocation(e.target.value)} required />
        </label>

        {domainRequires(categoryId, 'license_verification') ? (
          <label>
            License / Verification
            <input
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              required
            />
          </label>
        ) : null}

        {domainRequires(categoryId, 'language_pair') ? (
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

        {domainRequires(categoryId, 'delivery_mode') ? (
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
  )
}

export function AdminDomainsPanel() {
  const [domains, setDomains] = useState<DomainDefinition[]>(SYSTEM_DOMAINS)
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
      <h2>Kategori (admin)</h2>
      <p className="muted">
        Sistemi ka domenet bazë. Këtu shto kategori të reja kur del një shërbim që nuk hyn te
        ato ekzistuese.
      </p>

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
