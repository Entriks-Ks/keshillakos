import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  ProgressBar,
  Separator,
  Skeleton,
  TextField,
  toast,
} from '@heroui/react'
import { BriefcaseBusiness, Building2, Camera, ExternalLink, Mail, MapPin, Pencil, Plus } from 'lucide-react'
import type { AuthUser } from '../api/auth'
import { IMAGE_ACCEPT, IMAGE_ACCEPT_HINT, mediaUrl, validateImageFile } from '../api/media'
import { locationLabel, resolveSavedLocation, type LocationSelection } from '../api/locations'
import type { ProfileCompletion } from '../api/profileCompletion'
import {
  SOCIAL_LINK_KEYS,
  SOCIAL_LINK_LABELS,
  SOCIAL_LINK_PLACEHOLDERS,
  socialLinksFrom,
  type SocialLinkKey,
  type SocialLinks,
} from '../api/socialLinks'
import { useAuth } from '../auth/AuthContext'
import LocationSelector from '../components/LocationSelector'
import ProfileAvatar from '../components/ProfileAvatar'
import SocialIcon from '../components/SocialIcon'
import { useCatalogOptions, type CatalogOptionChoice } from '../hooks/useCatalogOptions'
import { getErrorMessage } from '../utils/errors'
import { ROLE_LABELS } from './nav'
import './UserOverview.css'
import './UserProfile.css'

type Props = {
  completion: ProfileCompletion | null
  onSaved: () => Promise<void>
}

function savedLocationKey(user: AuthUser) {
  return user.savedLocation ? `${user.savedLocation.countryId}:${user.savedLocation.cityId}` : ''
}

function socialHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function socialDisplay(value: string) {
  return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '')
}

export function filledSocialLinks(links?: SocialLinks | null) {
  return SOCIAL_LINK_KEYS
    .map((key) => [key, links?.[key]?.trim() || ''] as const)
    .filter(([, value]) => value)
}

export function SocialLinksList({ entries, className }: { entries: ReturnType<typeof filledSocialLinks>; className?: string }) {
  return (
    <ul className={`up-social${className ? ` ${className}` : ''}`}>
      {entries.map(([key, value]) => (
        <li key={key}>
          <a href={socialHref(value)} target="_blank" rel="noopener noreferrer" className="up-social-link">
            <span className="up-social-icon"><SocialIcon name={key} /></span>
            <span className="up-social-copy">
              <strong>{SOCIAL_LINK_LABELS[key]}</strong>
              <span>{socialDisplay(value)}</span>
            </span>
            <ExternalLink size={15} aria-hidden className="up-social-out" />
          </a>
        </li>
      ))}
    </ul>
  )
}

function languageLabel(options: CatalogOptionChoice[], value: string) {
  return options.find((option) => option.value === value)?.label || value
}

function SectionHead({ title, meta, action }: { title: string; meta?: ReactNode; action?: ReactNode }) {
  return (
    <Card.Header className="uo-card-head">
      <div className="uo-card-heading">
        <Card.Title className="uo-card-title">{title}</Card.Title>
        {meta}
      </div>
      {action}
    </Card.Header>
  )
}

export function EmptyNote({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <div className="up-empty">
      <p>{text}</p>
      <Button size="sm" variant="ghost" className="uo-link-btn" onPress={onAction}>
        <Plus size={15} aria-hidden />
        {action}
      </Button>
    </div>
  )
}

export function UserProfile({ completion, onSaved }: Props) {
  const { user, switchContext } = useAuth()
  const navigate = useNavigate()
  const route = useLocation()
  const { languages: languageOptions } = useCatalogOptions()
  const editing = route.pathname.endsWith('/profile/edit')
  const profilePath = route.pathname.startsWith('/dashboard/admin') ? '/dashboard/admin/profile' : '/dashboard/user/profile'
  const editPath = profilePath.startsWith('/dashboard/admin') ? '/dashboard/admin/profile/edit' : '/dashboard/profile/edit'
  const [resolved, setResolved] = useState<{ key: string; value: LocationSelection | null }>({ key: '', value: null })

  const countryId = user?.savedLocation?.countryId
  const cityId = user?.savedLocation?.cityId

  useEffect(() => {
    if (!countryId || !cityId) return
    const controller = new AbortController()
    const key = `${countryId}:${cityId}`
    resolveSavedLocation({ countryId, cityId }, controller.signal)
      .then((value) => { if (!controller.signal.aborted) setResolved({ key, value }) })
      .catch(() => { if (!controller.signal.aborted) setResolved({ key, value: null }) })
    return () => controller.abort()
  }, [countryId, cityId])

  if (!user) return null

  const locationKey = savedLocationKey(user)
  const cityLoading = Boolean(locationKey) && resolved.key !== locationKey
  const city = locationKey && resolved.key === locationKey ? resolved.value : null
  const locationText = city ? locationLabel(city, 'sq') : locationKey ? '' : user.location || ''
  const roles = user.roles ?? [user.role]

  function startEdit() {
    navigate(editPath)
    window.scrollTo({ top: 0 })
  }

  function finishEdit(nextCity?: LocationSelection | null) {
    if (nextCity !== undefined) {
      setResolved({ key: nextCity ? `${nextCity.country._id}:${nextCity.city._id}` : '', value: nextCity })
    }
    navigate(profilePath)
    window.scrollTo({ top: 0 })
  }

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

  if (editing) {
    return (
      <ProfileEditor
        user={user}
        initialCity={city}
        languageOptions={languageOptions}
        onSaved={onSaved}
        onCancel={() => finishEdit()}
        onDone={finishEdit}
      />
    )
  }

  const percent = completion?.exists && completion.overallPercent !== null
    ? Math.max(0, Math.min(100, Math.round(completion.overallPercent)))
    : null
  const missing = completion?.section.missingRequired ?? []
  const socialEntries = filledSocialLinks(user.socialLinks)
  const userLanguages = user.languages ?? []
  const skills = user.skills ?? []

  const personalRows: Array<{ label: string; value: ReactNode }> = [
    { label: 'Emri', value: user.firstName },
    { label: 'Mbiemri', value: user.lastName },
    { label: 'Email', value: user.email },
    { label: 'Telefoni', value: user.phone },
    {
      label: 'Qyteti',
      value: cityLoading ? <Skeleton className="up-skel-line" /> : locationText,
    },
  ]

  return (
    <section className="uo up">
      <Card className="uo-card up-hero">
        <div className="up-hero-main">
          <ProfileAvatar src={user.profilePhoto} seed={user.uid} alt={user.name} size="fill" className="up-hero-avatar" />
          <div className="up-hero-copy">
            <div className="up-hero-title">
              <h1>{user.name}</h1>
              {percent === 100 ? (
                <Chip size="sm" variant="soft" color="success">
                  <Chip.Label>Profili i plotë</Chip.Label>
                </Chip>
              ) : null}
            </div>
            <p className="up-hero-role">{user.headline || ROLE_LABELS[user.role]}</p>
            <ul className="up-hero-meta">
              {cityLoading ? (
                <li><Skeleton className="up-skel-line" /></li>
              ) : locationText ? (
                <li><MapPin size={15} aria-hidden />{locationText}</li>
              ) : null}
              <li><Mail size={15} aria-hidden /><span className="up-truncate">{user.email}</span></li>
            </ul>
          </div>
        </div>
        <Button variant="primary" className="up-hero-action" onPress={startEdit} isDisabled={cityLoading}>
          <Pencil size={16} aria-hidden />
          Ndrysho profilin
        </Button>
      </Card>

      <div className="uo-grid up-grid">
        <div className="up-col">
          <Card className="uo-card">
            <SectionHead title="Të dhënat personale" />
            <Card.Content className="uo-card-body">
              <dl className="up-facts">
                {personalRows.map((row) => (
                  <div key={row.label} className="up-fact">
                    <dt>{row.label}</dt>
                    <dd>{row.value || <span className="up-missing">Nuk është shtuar</span>}</dd>
                  </div>
                ))}
              </dl>
            </Card.Content>
          </Card>

          <Card className="uo-card">
            <SectionHead
              title="Gjuhët"
              meta={userLanguages.length ? <span className="uo-card-meta">{userLanguages.length}</span> : null}
            />
            <Card.Content className="uo-card-body">
              {userLanguages.length ? (
                <div className="up-chips">
                  {userLanguages.map((value) => (
                    <Chip key={value} variant="soft">
                      <Chip.Label>{languageLabel(languageOptions, value)}</Chip.Label>
                    </Chip>
                  ))}
                </div>
              ) : (
                <EmptyNote text="Nuk ke shtuar gjuhët që flet." action="Shto gjuhët" onAction={startEdit} />
              )}
            </Card.Content>
          </Card>

          {skills.length ? (
            <Card className="uo-card">
              <SectionHead title="Aftësitë" meta={<span className="uo-card-meta">{skills.length}</span>} />
              <Card.Content className="uo-card-body">
                <div className="up-chips">
                  {skills.map((skill) => (
                    <Chip key={skill} variant="soft" color="accent">
                      <Chip.Label>{skill}</Chip.Label>
                    </Chip>
                  ))}
                </div>
              </Card.Content>
            </Card>
          ) : null}

          <Card className="uo-card">
            <SectionHead
              title="Rrjetet sociale"
              meta={socialEntries.length ? <span className="uo-card-meta">{socialEntries.length}</span> : null}
            />
            <Card.Content className="uo-card-body">
              {socialEntries.length ? (
                <SocialLinksList entries={socialEntries} />
              ) : (
                <EmptyNote text="Nuk ke shtuar asnjë rrjet social." action="Shto rrjete sociale" onAction={startEdit} />
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
                <Button size="sm" variant="ghost" className="uo-link-btn up-setup-action" onPress={startEdit}>
                  Plotëso tani
                </Button>
              </Card.Content>
            </Card>
          ) : null}

          <Card className="uo-card">
            <SectionHead title="Profilet profesionale" />
            <Card.Content className="uo-card-body">
              <ul className="uo-rows">
                <li className="uo-row">
                  <span className="uo-row-icon"><BriefcaseBusiness size={18} aria-hidden /></span>
                  <span className="uo-row-copy">
                    <strong>Ekspert</strong>
                    <span>{roles.includes('provider') ? 'Profili yt si ekspert' : 'Ofro shërbimet e tua'}</span>
                  </span>
                  <Button size="sm" variant="outline" onPress={() => void openExpertContext()}>
                    {roles.includes('provider') ? 'Hap profilin' : 'Bëhu ekspert'}
                  </Button>
                </li>
                <li className="uo-row">
                  <span className="uo-row-icon"><Building2 size={18} aria-hidden /></span>
                  <span className="uo-row-copy">
                    <strong>Kompani</strong>
                    <span>{roles.includes('company') ? 'Profili i kompanisë tënde' : 'Regjistro biznesin tënd'}</span>
                  </span>
                  <Button size="sm" variant="outline" onPress={() => void openCompanyContext()}>
                    {roles.includes('company') ? 'Hap profilin' : 'Krijo kompaninë'}
                  </Button>
                </li>
              </ul>
            </Card.Content>
          </Card>
        </aside>
      </div>
    </section>
  )
}

function ProfileEditor({
  user,
  initialCity,
  languageOptions,
  onSaved,
  onCancel,
  onDone,
}: {
  user: AuthUser
  initialCity: LocationSelection | null
  languageOptions: CatalogOptionChoice[]
  onSaved: () => Promise<void>
  onCancel: () => void
  onDone: (city: LocationSelection | null) => void
}) {
  const { updateProfile, uploadProfilePhoto } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState(user.firstName || '')
  const [lastName, setLastName] = useState(user.lastName || '')
  const [phone, setPhone] = useState(user.phone || '')
  const [city, setCity] = useState<LocationSelection | null>(initialCity)
  const [languages, setLanguages] = useState<string[]>(user.languages || [])
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(() => socialLinksFrom(user.socialLinks))
  const [preview, setPreview] = useState(() => mediaUrl(user.profilePhoto))
  const [photoError, setPhotoError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  function toggleLanguage(lang: string) {
    setLanguages((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]))
  }

  function setSocial(key: SocialLinkKey, value: string) {
    setSocialLinks((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
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
      onDone(city)
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function onPhotoChange(file: File | undefined) {
    if (!file) return
    setPhotoError('')
    try {
      validateImageFile(file)
    } catch (err) {
      setPhotoError(getErrorMessage(err))
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

  return (
    <section className="uo up">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>Ndrysho profilin</h1>
          <p>Emri dhe mbiemri janë të detyrueshëm. Të gjitha fushat e tjera janë opsionale.</p>
        </div>
      </header>

      <form className="up-form" onSubmit={onSubmit}>
        <Card className="uo-card">
          <SectionHead title="Fotoja e profilit" />
          <Card.Content className="uo-card-body">
            <div className="up-photo">
              <ProfileAvatar src={preview} seed={user.uid} alt={user.name} size="fill" className="up-photo-avatar" />
              <div className="up-photo-copy">
                <Button
                  size="sm"
                  variant="outline"
                  isPending={uploading}
                  isDisabled={saving}
                  onPress={() => fileInput.current?.click()}
                >
                  <Camera size={16} aria-hidden />
                  {uploading ? 'Duke ngarkuar...' : user.profilePhoto ? 'Ndrysho foton' : 'Ngarko foto'}
                </Button>
                <p className="up-hint">{IMAGE_ACCEPT_HINT}. Fotoja ruhet menjëherë pas ngarkimit.</p>
                {photoError ? <p className="up-error" role="alert">{photoError}</p> : null}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept={IMAGE_ACCEPT}
                hidden
                disabled={uploading}
                onChange={(e) => {
                  void onPhotoChange(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>
          </Card.Content>
        </Card>

        <Card className="uo-card">
          <SectionHead title="Të dhënat personale" />
          <Card.Content className="uo-card-body">
            <div className="up-fields">
              <TextField isRequired fullWidth value={firstName} onChange={setFirstName} isDisabled={saving}>
                <Label>Emri</Label>
                <Input maxLength={80} autoComplete="given-name" />
              </TextField>
              <TextField isRequired fullWidth value={lastName} onChange={setLastName} isDisabled={saving}>
                <Label>Mbiemri</Label>
                <Input maxLength={80} autoComplete="family-name" />
              </TextField>
              <TextField fullWidth value={phone} onChange={setPhone} isDisabled={saving}>
                <Label>Telefoni</Label>
                <Input placeholder="+38344123456" inputMode="tel" autoComplete="tel" maxLength={32} />
                <Description>Me prefiksin e shtetit, p.sh. +383.</Description>
              </TextField>
              <TextField fullWidth value={user.email} isDisabled>
                <Label>Email</Label>
                <Input />
                <Description>Email-i nuk mund të ndryshohet.</Description>
              </TextField>
              <div className="up-field-full">
                <span className="up-label">Qyteti</span>
                <LocationSelector value={city} onChange={setCity} disabled={saving} className="up-location" />
              </div>
            </div>
          </Card.Content>
        </Card>

        <Card className="uo-card">
          <SectionHead title="Gjuhët" meta={languages.length ? <span className="uo-card-meta">{languages.length} të zgjedhura</span> : null} />
          <Card.Content className="uo-card-body">
            {languageOptions.length ? (
              <div className="up-langs" role="group" aria-label="Gjuhët">
                {languageOptions.map((lang) => (
                  <label key={lang.id} className="up-lang">
                    <input
                      type="checkbox"
                      checked={languages.includes(lang.value)}
                      onChange={() => toggleLanguage(lang.value)}
                      disabled={saving}
                    />
                    <span>{lang.label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="up-langs" aria-hidden>
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="up-skel-pill" />)}
              </div>
            )}
          </Card.Content>
        </Card>

        <Card className="uo-card">
          <SectionHead title="Rrjetet sociale" />
          <Card.Content className="uo-card-body">
            <div className="up-fields">
              {SOCIAL_LINK_KEYS.map((key) => (
                <TextField key={key} fullWidth value={socialLinks[key] || ''} onChange={(value) => setSocial(key, value)} isDisabled={saving}>
                  <Label className="up-social-label">
                    <SocialIcon name={key} size={15} />
                    {SOCIAL_LINK_LABELS[key]}
                  </Label>
                  <Input placeholder={SOCIAL_LINK_PLACEHOLDERS[key]} inputMode="url" maxLength={500} />
                </TextField>
              ))}
            </div>
          </Card.Content>
        </Card>

        <div className="up-actions">
          <Button variant="outline" onPress={onCancel} isDisabled={saving || uploading}>
            Anulo
          </Button>
          <Button type="submit" variant="primary" isPending={saving} isDisabled={uploading}>
            {saving ? 'Duke ruajtur...' : 'Ruaj ndryshimet'}
          </Button>
        </div>
      </form>
    </section>
  )
}
