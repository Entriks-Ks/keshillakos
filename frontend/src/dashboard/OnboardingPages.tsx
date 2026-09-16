import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createCompany, becomeExpert } from '../api/onboarding'
import { fetchDomains } from '../api/domains'
import { useAuth } from '../auth/AuthContext'
import type { DomainDefinition } from '../data/domains'
import { getErrorMessage } from '../utils/errors'

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
  const [city, setCity] = useState('')
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
    setError('')
    setSaving(true)
    try {
      await becomeExpert({ displayName, title, description, categories: [category], languages: languages.split(',').map((value) => value.trim()).filter(Boolean), mode, city })
      await refreshUser()
      navigate('/dashboard/provider', { replace: true })
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  return <section className="provider-section">
    <h2>Bëhu Ekspert</h2>
    <p className="muted">Krijo profilin tënd profesional. Profili pret rishikim para publikimit.</p>
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
      {mode === 'on_site' ? <label>Qyteti<input value={city} onChange={(e) => setCity(e.target.value)} required /></label> : null}
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
      navigate('/dashboard/company/experts', { replace: true })
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  return <section className="provider-section">
    <h2>Krijo Kompani / Agjenci</h2>
    <p className="muted">Krijo kompaninë dhe pastaj fto ekspertët e regjistruar në ekip.</p>
    <form className="service-form" onSubmit={onSubmit}>
      <label>Emri publik<input value={publicName} onChange={(e) => setPublicName(e.target.value)} required maxLength={160} /></label>
      <label>Emri ligjor (opsional)<input value={legalName} onChange={(e) => setLegalName(e.target.value)} maxLength={200} /></label>
      {error ? <p className="error full">{error}</p> : null}
      <button type="submit" className="full" disabled={saving}>{saving ? 'Duke krijuar...' : 'Krijo kompaninë'}</button>
    </form>
    <p><Link to="/dashboard/user/profile">Kthehu te profili</Link></p>
  </section>
}
