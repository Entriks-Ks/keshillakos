import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { requestRoleChange } from '../api/auth'
import { IMAGE_ACCEPT, IMAGE_ACCEPT_HINT, mediaUrl, validateImageFile } from '../api/media'
import { useAuth } from '../auth/AuthContext'
import { LANGUAGE_OPTIONS } from '../data/domains'
import { getErrorMessage } from '../utils/errors'
import ExpertInvitationsPanel from './ExpertInvitationsPanel'
import DashPageHeader from './DashPageHeader'
import { fetchMyProviderProfiles, updateProviderLocations, type ManagedProviderProfile } from '../api/providerProfiles'
import { resolveProviderLocations, type LocationSelection } from '../api/locations'
import ProviderLocationFields from '../components/ProviderLocationFields'

function parseSkills(raw: string) {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function ProfilePanel() {
  const { user, updateProfile, uploadProfilePhoto, refreshUser } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [skillsText, setSkillsText] = useState('')
  const [languages, setLanguages] = useState<string[]>([])
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [requestingRole, setRequestingRole] = useState(false)

  useEffect(() => {
    if (!user) return
    setFirstName(user.firstName || '')
    setLastName(user.lastName || '')
    setHeadline(user.headline || '')
    setBio(user.bio || '')
    setLocation(user.location || '')
    setSkillsText((user.skills || []).join(', '))
    setLanguages(user.languages || [])
    setPreview(mediaUrl(user.profilePhoto))
  }, [user])

  function toggleLanguage(lang: string) {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    )
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      await updateProfile({
        firstName,
        lastName,
        headline,
        bio,
        location,
        skills: parseSkills(skillsText),
        languages,
      })
      setSuccess('Profili u ruajt.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function onPhotoChange(file: File | undefined) {
    if (!file) return
    setError('')
    setSuccess('')
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
      setSuccess('Fotoja e profilit u ngarkua.')
    } catch (err) {
      setError(getErrorMessage(err))
      setPreview(mediaUrl(user?.profilePhoto))
    } finally {
      setUploading(false)
      URL.revokeObjectURL(localPreview)
    }
  }

  if (!user) return null
  const roles = user.roles ?? [user.role]
  const hasProviderProfile = roles.some((role) => role === 'provider' || role === 'company')
  const providerPending = user.requestedRole === 'provider' && !roles.includes('provider')
  const companyPending = user.requestedRole === 'company' && !roles.includes('company')
  const rolePending = providerPending || companyPending

  async function requestCapability(role: 'provider' | 'company') {
    setError('')
    setSuccess('')
    setRequestingRole(true)
    try {
      await requestRoleChange(role)
      await refreshUser()
      setSuccess(
        role === 'provider'
          ? 'Kërkesa u dërgua. Admini do ta shqyrtojë para se të bëhesh ofrues.'
          : 'Kërkesa u dërgua. Admini do ta shqyrtojë para se të bëhesh kompani.',
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setRequestingRole(false)
    }
  }

  return (
    <section className="provider-section">
      <DashPageHeader
        title="Profili im"
        description="Ndrysho emrin, foton, aftësitë dhe informacionet e tjera të profilit."
      />

      <div className="profile-role-options">
        {roles.includes('provider') ? (
          <Link className="ghost link-btn" to="/dashboard/provider">Paneli i ofruesit</Link>
        ) : providerPending ? (
          <span className="role-pending-pill">Kërkesa për ofrues · Pending</span>
        ) : (
          <button type="button" className="ghost link-btn" onClick={() => void requestCapability('provider')} disabled={requestingRole || rolePending}>
            {requestingRole ? 'Duke dërguar…' : 'Bëhu ofrues'}
          </button>
        )}
        {roles.includes('company') ? (
          <Link className="ghost link-btn" to="/dashboard/company/experts">Paneli i kompanisë</Link>
        ) : companyPending ? (
          <span className="role-pending-pill">Kërkesa për kompani · Pending</span>
        ) : (
          <button type="button" className="ghost link-btn" onClick={() => void requestCapability('company')} disabled={requestingRole || rolePending}>
            {requestingRole ? 'Duke dërguar…' : 'Bëhu kompani'}
          </button>
        )}
        {user.role !== 'user' ? <Link className="ghost link-btn" to="/dashboard/user">Paneli i përdoruesit</Link> : null}
      </div>
      {providerPending ? (
        <p className="muted profile-role-pending">
          Kërkesa jote për ofrues është në pritje. Admini e shqyrton dhe, nëse e pranon, roli ndryshon automatikisht.
        </p>
      ) : null}
      {companyPending ? (
        <p className="muted profile-role-pending">
          Kërkesa jote për kompani është në pritje. Admini e shqyrton dhe, nëse e pranon, roli ndryshon automatikisht.
        </p>
      ) : null}
      {(user.roles ?? [user.role]).includes('provider') ? <ExpertInvitationsPanel /> : null}

      <div className="profile-photo-row">
        <div className="profile-avatar-lg" aria-hidden>
          {preview ? <img src={preview} alt="" /> : <span>{user.name.slice(0, 1)}</span>}
        </div>
        <div className="profile-photo-actions">
          <label className="primary-btn profile-upload-btn">
            {uploading ? 'Duke ngarkuar...' : 'Ngarko foto'}
            <input
              type="file"
              accept={IMAGE_ACCEPT}
              hidden
              disabled={uploading}
              onChange={(e) => onPhotoChange(e.target.files?.[0])}
            />
          </label>
          <p className="muted">{IMAGE_ACCEPT_HINT}</p>
        </div>
      </div>

      <form onSubmit={onSave} className="service-form">
        <label>
          Emri
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={80} autoComplete="given-name" />
        </label>
        <label>
          Mbiemri
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={80} autoComplete="family-name" />
        </label>
        <label>
          Titulli / specialiteti
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="p.sh. Avokat, Konsulent biznesi"
            maxLength={120}
          />
        </label>
        {!hasProviderProfile ? <label>
          Lokacioni
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Prishtinë / Online / Diaspora"
            maxLength={120}
          />
        </label> : null}
        <label>
          Email
          <input value={user.email} disabled />
        </label>
        <label className="full">
          Aftësitë (ndara me presje)
          <input
            value={skillsText}
            onChange={(e) => setSkillsText(e.target.value)}
            placeholder="p.sh. Ligj, Tatime, Biznes, Përkthim"
          />
        </label>
        <fieldset className="full checkbox-fieldset">
          <legend>Gjuhët</legend>
          {LANGUAGE_OPTIONS.map((lang) => (
            <label key={lang} className="check-row">
              <input
                type="checkbox"
                checked={languages.includes(lang)}
                onChange={() => toggleLanguage(lang)}
              />
              {lang}
            </label>
          ))}
        </fieldset>
        <label className="full">
          Rreth meje
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={1200}
            placeholder="Përshkruaj përvojën, aftësitë dhe si mund të ndihmosh."
          />
        </label>

        {error ? <p className="error full">{error}</p> : null}
        {success ? <p className="success full">{success}</p> : null}

        <button type="submit" className="full" disabled={saving}>
          {saving ? 'Duke ruajtur...' : 'Ruaj profilin'}
        </button>
      </form>
      {hasProviderProfile ? <ProviderLocationsPanel /> : null}
    </section>
  )
}

function ProviderLocationsPanel() {
  const [profiles, setProfiles] = useState<ManagedProviderProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetchMyProviderProfiles(controller.signal).then(setProfiles)
      .catch((err: unknown) => { if (!controller.signal.aborted) setError(getErrorMessage(err)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  return <section className="provider-location-panel">
    <h3>Lokacioni dhe zonat e shërbimit</h3>
    {loading ? <p className="muted" role="status">Profilet po ngarkohen...</p> : null}
    {error ? <p className="error" role="alert">{error}</p> : null}
    {profiles.map((profile) => <ProviderLocationEditor key={profile._id} profile={profile} />)}
  </section>
}

function ProviderLocationEditor({ profile }: { profile: ManagedProviderProfile }) {
  const [location, setLocation] = useState<LocationSelection | null>(null)
  const [serviceAreas, setServiceAreas] = useState<LocationSelection[]>([])
  const [loading, setLoading] = useState(true)
  const [restoreFailed, setRestoreFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    resolveProviderLocations({ location: profile.location, serviceAreaCityIds: profile.serviceAreaCityIds ?? [] }, controller.signal)
      .then((values) => { if (!controller.signal.aborted) { setLocation(values.location); setServiceAreas(values.serviceAreas) } })
      .catch((err: unknown) => { if (!controller.signal.aborted) { setError(getErrorMessage(err)); setRestoreFailed(true) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [profile.location, profile.serviceAreaCityIds])

  async function onSave(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      await updateProviderLocations(profile._id, {
        location: location ? { countryId: location.country._id, cityId: location.city._id } : null,
        serviceAreaCityIds: serviceAreas.map((area) => area.city._id),
      })
      setSuccess('Lokacioni dhe zonat e shërbimit u ruajtën.')
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  return <form className="service-form provider-location-form" onSubmit={onSave}>
    <h4 className="full">{profile.publicProfile.displayName}</h4>
    {loading ? <p className="muted full" role="status">Lokacionet po ngarkohen...</p> : !restoreFailed ? <ProviderLocationFields location={location} serviceAreas={serviceAreas} onLocationChange={setLocation} onServiceAreasChange={setServiceAreas} disabled={saving} /> : null}
    {error ? <p className="error full" role="alert">{error}</p> : null}
    {success ? <p className="success full" role="status">{success}</p> : null}
    <button type="submit" className="full" disabled={loading || saving || restoreFailed}>{saving ? 'Duke ruajtur...' : 'Ruaj lokacionet'}</button>
  </form>
}
