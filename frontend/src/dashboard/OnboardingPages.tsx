import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createCompany, becomeExpert } from '../api/onboarding'
import { fetchDomains } from '../api/domains'
import { useAuth } from '../auth/AuthContext'
import type { DomainDefinition } from '../data/domains'
import { getErrorMessage } from '../utils/errors'
import type { LocationSelection } from '../api/locations'
import ProviderLocationFields from '../components/ProviderLocationFields'

export function ExpertOnboardingPage() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [domains, setDomains] = useState<DomainDefinition[]>([])
  const [displayName, setDisplayName] = useState(user?.name || '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [languages, setLanguages] = useState('')
  const [mode, setMode] = useState<'online' | 'on_site'>('online')
  const [location, setLocation] = useState<LocationSelection | null>(null)
  const [serviceAreas, setServiceAreas] = useState<LocationSelection[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchDomains().then((items) => {
      setDomains(items)
      setCategory((current) => current || items[0]?.id || '')
    }).catch((err) => setError(getErrorMessage(err)))
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!location || (mode === 'on_site' && !serviceAreas.length)) {
      setError('Zgjidh lokacionin dhe të paktën një qytet ku ofron shërbime.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await becomeExpert({ displayName, title, description, categories: [category], languages: languages.split(',').map((value) => value.trim()).filter(Boolean), mode,
        location: { countryId: location.country._id, cityId: location.city._id }, serviceAreaCityIds: serviceAreas.map((area) => area.city._id) })
      await refreshUser()
      navigate('/dashboard/user/profile', { replace: true })
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  return <section className="provider-section">
    <h2>Bëhu Ekspert</h2>
    <p className="muted">Krijo profilin tënd profesional. Kërkesa shkon te admini; roli ofrues aktivizohet pasi të pranohet.</p>
    <form className="service-form" onSubmit={onSubmit}>
      <label>Emri publik<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={160} /></label>
      <label>Kategoria<select value={category} onChange={(e) => setCategory(e.target.value)} required>
        {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.labelSq}</option>)}
      </select></label>
      <label>Titulli<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} /></label>
      <label>Gjuhët (ndara me presje)<input value={languages} onChange={(e) => setLanguages(e.target.value)} /></label>
      <label>Mënyra e punës<select value={mode} onChange={(e) => setMode(e.target.value as 'online' | 'on_site')}>
        <option value="online">Online</option><option value="on_site">Në lokacion</option>
      </select></label>
      <ProviderLocationFields location={location} serviceAreas={serviceAreas} onLocationChange={setLocation} onServiceAreasChange={setServiceAreas} disabled={saving} />
      <label className="full">Përshkrimi<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} /></label>
      {error ? <p className="error full">{error}</p> : null}
      <button type="submit" className="full" disabled={saving || !category}>{saving ? 'Duke krijuar...' : 'Krijo profilin e ekspertit'}</button>
    </form>
    <p><Link to="/dashboard/user/profile">Kthehu te profili</Link></p>
  </section>
}

export function CompanyOnboardingPage() {
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const [publicName, setPublicName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await createCompany({ publicName, legalName })
      await refreshUser()
      navigate('/dashboard/user/profile', { replace: true })
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  return <section className="provider-section">
    <h2>Krijo Kompani / Agjenci</h2>
    <p className="muted">Krijo kompaninë. Kërkesa shkon te admini; roli kompani aktivizohet pasi të pranohet.</p>
    <form className="service-form" onSubmit={onSubmit}>
      <label>Emri publik<input value={publicName} onChange={(e) => setPublicName(e.target.value)} required maxLength={160} /></label>
      <label>Emri ligjor (opsional)<input value={legalName} onChange={(e) => setLegalName(e.target.value)} maxLength={200} /></label>
      {error ? <p className="error full">{error}</p> : null}
      <button type="submit" className="full" disabled={saving}>{saving ? 'Duke krijuar...' : 'Krijo kompaninë'}</button>
    </form>
    <p><Link to="/dashboard/user/profile">Kthehu te profili</Link></p>
  </section>
}
