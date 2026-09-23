import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from '@heroui/react'
import { createCustomDomain, fetchDomains } from '../api/domains'
import { createExpert, fetchMyExperts, type ExpertItem } from '../api/experts'
import {
  fetchRateableProviders,
  type RateableProvider,
} from '../api/ratings'
import RateProvider from '../components/RateProvider'
import CompanyTeamPanel from './CompanyTeamPanel'
import ProviderServicesPanel from './ProviderServicesPanel'
import { domainRequires, type DomainDefinition } from '../data/domains'
import { useCatalogOptions } from '../hooks/useCatalogOptions'
import { getErrorMessage } from '../utils/errors'
import DashPageHeader from './DashPageHeader'
import LocationSelector from '../components/LocationSelector'
import { locationLabel, type LocationSelection } from '../api/locations'

export { ProviderServicesPanel }

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


export function CompanyExpertsPanel() {
  const domains = useDomains()
  const { languages, deliveryModes: deliveryModeOptions } = useCatalogOptions()
  const [experts, setExperts] = useState<ExpertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('law')
  const [specialty, setSpecialty] = useState('')
  const [location, setLocation] = useState<LocationSelection | null>(null)
  const [bio, setBio] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [languageFrom, setLanguageFrom] = useState('')
  const [languageTo, setLanguageTo] = useState('')
  const [deliveryModes, setDeliveryModes] = useState<string[]>([])
  const [error, setError] = useState('')
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

  useEffect(() => {
    if (languages[0]) {
      if (!languageFrom) setLanguageFrom(languages[0].value)
      if (!languageTo) setLanguageTo(languages[1]?.value || languages[0].value)
    }
  }, [languages, languageFrom, languageTo])

  function toggleDelivery(mode: string) {
    setDeliveryModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
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
      toast.success('Eksperti u shtua.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
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
        <div className="full field">
          <span>Lokacioni</span>
          <LocationSelector value={location} onChange={setLocation} />
        </div>

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
                {languages.map((l) => (
                  <option key={l.id} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Në
              <select value={languageTo} onChange={(e) => setLanguageTo(e.target.value)}>
                {languages.map((l) => (
                  <option key={l.id} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        {domainRequires(selectedDomain, 'delivery_mode') ? (
          <fieldset className="full checkbox-fieldset">
            <legend>Online / Fizikisht / Grup</legend>
            {deliveryModeOptions.map((mode) => (
              <label key={mode.id} className="check-row">
                <input
                  type="checkbox"
                  checked={deliveryModes.includes(mode.value)}
                  onChange={() => toggleDelivery(mode.value)}
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
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchDomains().then(setDomains).catch(() => undefined)
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
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
      toast.success('Kategoria e re u krijua (Ekspertë të tjerë / custom).')
    } catch (err) {
      toast.danger(getErrorMessage(err))
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
        <button type="submit" className="full" disabled={submitting}>
          {submitting ? 'Duke krijuar...' : 'Krijo kategori të re'}
        </button>
      </form>
    </section>
  )
}
