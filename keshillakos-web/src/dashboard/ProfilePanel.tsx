import { useEffect, useState, type FormEvent } from 'react'
import { mediaUrl } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { LANGUAGE_OPTIONS } from '../data/domains'
import { getErrorMessage } from '../utils/errors'

function parseSkills(raw: string) {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function ProfilePanel() {
  const { user, updateProfile, uploadProfilePhoto } = useAuth()
  const [name, setName] = useState('')
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

  useEffect(() => {
    if (!user) return
    setName(user.name || '')
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
        name,
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

  return (
    <section className="provider-section">
      <h2>Profili im</h2>
      <p className="muted">Ndrysho emrin, foton, aftësitë dhe informacionet e tjera të profilit.</p>

      <div className="profile-photo-row">
        <div className="profile-avatar-lg" aria-hidden>
          {preview ? <img src={preview} alt="" /> : <span>{user.name.slice(0, 1)}</span>}
        </div>
        <div className="profile-photo-actions">
          <label className="primary-btn profile-upload-btn">
            {uploading ? 'Duke ngarkuar...' : 'Ngarko foto'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              disabled={uploading}
              onChange={(e) => onPhotoChange(e.target.files?.[0])}
            />
          </label>
          <p className="muted">JPG, PNG ose WEBP · max 2MB</p>
        </div>
      </div>

      <form onSubmit={onSave} className="service-form">
        <label>
          Emri
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
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
        <label>
          Lokacioni
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Prishtinë / Online / Diaspora"
            maxLength={120}
          />
        </label>
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
    </section>
  )
}
