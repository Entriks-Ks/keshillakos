import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Card, Chip, buttonVariants, toast } from '@heroui/react'
import ConfirmActionDialog from '../components/ConfirmActionDialog'
import { Camera, ExternalLink, Globe, ImageIcon, MapPin, Pencil } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { fetchMyBusinesses, updateBusinessProfile, uploadBusinessCover, uploadBusinessLogo, type BusinessProfile } from '../api/businesses'
import { fetchCategories, type CatalogCategory } from '../api/catalog'
import { IMAGE_ACCEPT, mediaUrl, validateImageFile } from '../api/media'
import { locationLabel, resolveSavedLocation, type LocationSelection } from '../api/locations'
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
import ProfileAvatar from '../components/ProfileAvatar'
import { getErrorMessage } from '../utils/errors'
import ExpertProfilePage from './ExpertProfilePage'
import { SectionHead } from './OverviewParts'
import { EmptyNote, filledSocialLinks, SocialLinksList, UserProfile } from './UserProfilePage'
import './UserProfile.css'
import './DashboardSections.css'
import './ExpertProfile.css'
import './ProfilePanel.css'

function matchCatalogCategoryId(categories: CatalogCategory[], saved?: string) {
  if (!saved) return ''
  const found = categories.find((item) => item._id === saved || item.slug === saved)
  return found?._id || ''
}

function websiteHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function FieldHint({ required }: { required: boolean }) {
  return <span className="profile-field-hint">{required ? 'E detyrueshme' : 'Opsionale'}</span>
}

function profileTypeFromPath(pathname: string): ProfileType {
  if (pathname.includes('/dashboard/provider')) return 'expert'
  if (pathname.includes('/dashboard/company')) return 'company'
  return 'private'
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
  const profileType = profileTypeFromPath(location.pathname)
  const { user } = useAuth()
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

  if (profileType === 'expert') {
    return <ExpertProfilePage onSaved={reloadCompletion} completion={completion} />
  }

  if (profileType === 'company') {
    return <CompanyProfileSection onSaved={reloadCompletion} completion={completion} />
  }

  return <UserProfile completion={completion} onSaved={reloadCompletion} />
}

function CompanyProfileSection({ onSaved, completion }: { onSaved: () => Promise<void>; completion: ProfileCompletion | null }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const route = useLocation()
  const editing = route.pathname.endsWith('/profile/edit')
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
  const [coverPreview, setCoverPreview] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null)
  const [error, setError] = useState('')
  const logoInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)

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
          setCoverPreview(mediaUrl(current.coverUrl))
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
    setUploading('logo')
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
      setUploading(null)
      URL.revokeObjectURL(local)
    }
  }

  async function onCoverChange(file: File | undefined) {
    if (!file || !business) return
    try {
      validateImageFile(file)
    } catch (err) {
      setError(getErrorMessage(err))
      return
    }
    setUploading('cover')
    const local = URL.createObjectURL(file)
    setCoverPreview(local)
    try {
      const next = await uploadBusinessCover(business._id, file)
      setBusiness(next)
      setCoverPreview(mediaUrl(next.coverUrl))
      await onSaved()
      toast.success('Sfondi u ngarkua.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
      setCoverPreview(mediaUrl(business.coverUrl))
    } finally {
      setUploading(null)
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
      navigate('/dashboard/company/profile')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function startEdit() { navigate('/dashboard/company/profile/edit') }

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

  const category = categories.find((item) => item._id === categoryId)
  const place = city ? locationLabel(city, 'sq') : business.branches?.[0]?.location?.cityName || ''
  const missing = <span className="up-missing">Nuk është shtuar</span>
  const socialEntries = filledSocialLinks(socialLinks)
  const completionMissing = completion?.exists ? completion.section.missingRequired : []
  const isComplete = completion?.exists && completion.overallPercent !== null && completionMissing.length === 0

  if (editing) {
    return (
      <section className="uo up">
        <header className="uo-head"><div className="uo-head-copy"><h1>Ndrysho profilin</h1><p>Përditëso të dhënat e kompanisë që shfaqen në KëshillaKos.</p></div></header>
        <form className="up-form" onSubmit={onSave}>
          <Card className="uo-card">
            <SectionHead title="Logoja e kompanisë" />
            <Card.Content className="uo-card-body">
              <div className="up-photo">
                <ProfileAvatar src={logoPreview} seed={business._id} alt={publicName} size="fill" fit="contain" className="up-photo-avatar" />
                <div className="up-photo-copy">
                  <Button size="sm" variant="outline" isPending={uploading === 'logo'} isDisabled={saving} onPress={() => logoInput.current?.click()}><Camera size={16} aria-hidden />{uploading === 'logo' ? 'Duke ngarkuar…' : logoPreview ? 'Ndrysho logon' : 'Ngarko logon'}</Button>
                  <p className="up-hint">Logoja ruhet menjëherë pas ngarkimit.</p>
                </div>
                <input ref={logoInput} type="file" accept={IMAGE_ACCEPT} hidden disabled={uploading === 'logo'} onChange={(e) => { void onLogoChange(e.target.files?.[0]); e.target.value = '' }} />
              </div>
            </Card.Content>
          </Card>
          <Card className="uo-card">
            <SectionHead title="Informacioni i kompanisë" />
            <Card.Content className="uo-card-body"><div className="service-form cp-form">
              <label>Emri i kompanisë <FieldHint required /><input value={publicName} onChange={(e) => setPublicName(e.target.value)} required maxLength={160} /></label>
              <label>Kategoria / industria <FieldHint required /><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required disabled={!categories.length}><option value="">{categories.length ? 'Zgjidh kategorinë' : 'Duke ngarkuar kategoritë…'}</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name.sq}</option>)}</select></label>
              <div className="full field"><span className="profile-inline-label">Qyteti <FieldHint required /></span><LocationSelector value={city} onChange={setCity} disabled={saving} /></div>
              <label className="full">Përshkrimi <FieldHint required /><textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} maxLength={3000} /></label>
            </div></Card.Content>
          </Card>
          <Card className="uo-card">
            <SectionHead title="Kontakti" />
            <Card.Content className="uo-card-body"><div className="service-form cp-form">
              <label>Email i kompanisë <FieldHint required /><input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required type="email" maxLength={160} /></label>
              <label>Numri i telefonit <FieldHint required /><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required placeholder="+38344123456" maxLength={32} /></label>
              <label>Website <FieldHint required={false} /><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" maxLength={500} /></label>
              <label>Adresa <FieldHint required={false} /><input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={240} /></label>
            </div></Card.Content>
          </Card>
          <Card className="uo-card"><SectionHead title="Rrjetet sociale" /><Card.Content className="uo-card-body"><div className="service-form cp-form"><SocialLinksFields value={socialLinks} onChange={setSocialLinks} disabled={saving} /></div></Card.Content></Card>
          {error ? <p className="up-error" role="alert">{error}</p> : null}
          <div className="up-actions"><Button variant="outline" onPress={() => setConfirmCancel(true)} isDisabled={saving || uploading !== null}>Anulo</Button><Button type="submit" variant="primary" isPending={saving} isDisabled={uploading !== null || !categories.length}>{saving ? 'Duke ruajtur…' : 'Ruaj ndryshimet'}</Button></div>
        </form>
        <ConfirmActionDialog isOpen={confirmCancel} onClose={() => setConfirmCancel(false)} onConfirm={() => { setConfirmCancel(false); navigate('/dashboard/company/profile') }} title="Hidh ndryshimet?" description="Ndryshimet e paruajtura në profilin e kompanisë do të humbasin." confirmLabel="Hidh ndryshimet" />
      </section>
    )
  }

  return (
    <section className="uo up cp">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>Profili</h1>
          <p>Menaxho të dhënat e kompanisë që shfaqen në KëshillaKos.</p>
        </div>
        {user ? <Link to={`/providers/${user.uid}`} className={`${buttonVariants({ variant: 'outline' })} uo-primary`}>
          <ExternalLink size={16} aria-hidden /> Shiko profilin publik
        </Link> : null}
      </header>

      <Card className="uo-card up-hero">
        <div className="up-hero-main">
          <div className="ep-avatar">
            <ProfileAvatar src={logoPreview} seed={business._id} alt={publicName} size="fill" fit="contain" className="up-hero-avatar" />
            <button type="button" className="ep-avatar-btn" aria-label="Ndrysho logon e kompanisë" title="Ndrysho logon e kompanisë" disabled={uploading === 'logo'} onClick={() => logoInput.current?.click()}><Camera size={15} aria-hidden /></button>
            <input ref={logoInput} type="file" accept={IMAGE_ACCEPT} hidden disabled={uploading === 'logo'} onChange={(e) => { void onLogoChange(e.target.files?.[0]); e.target.value = '' }} />
          </div>
          <div className="up-hero-copy">
            <div className="up-hero-title">
              <h2>{publicName || 'Kompania'}</h2>
              {isComplete ? <Chip size="sm" variant="soft" color="success"><Chip.Label>Profili i plotë</Chip.Label></Chip> : null}
              <Chip size="sm" variant="soft"><Chip.Label>{statusLabel}</Chip.Label></Chip>
              {business.verification?.status === 'verified' ? <Chip size="sm" variant="soft" color="accent"><Chip.Label>E verifikuar</Chip.Label></Chip> : null}
            </div>
            <ul className="up-hero-meta">
              {category ? <li>{category.name.sq}</li> : null}
              {place ? <li><MapPin size={15} aria-hidden />{place}</li> : null}
              {website ? <li><Globe size={15} aria-hidden /><a href={websiteHref(website)} target="_blank" rel="noopener noreferrer" className="cp-link">{website}</a></li> : null}
            </ul>
          </div>
        </div>
        <Button variant="primary" className="up-hero-action" onPress={startEdit}><Pencil size={16} aria-hidden />Ndrysho profilin</Button>
      </Card>

      <div className="uo-grid up-grid">
        <div className="up-col">
          <Card className="uo-card">
            <SectionHead title="Informacioni i kompanisë" action={<Button size="sm" variant="ghost" className="uo-link-btn" onPress={startEdit}><Pencil size={14} aria-hidden />Ndrysho</Button>} />
            <Card.Content className="uo-card-body ep-stack">
              <dl className="up-facts">
                <div className="up-fact"><dt>Emri i kompanisë</dt><dd>{publicName || missing}</dd></div>
                <div className="up-fact"><dt>Kategoria / industria</dt><dd>{category?.name.sq || missing}</dd></div>
                <div className="up-fact"><dt>Qyteti</dt><dd>{place || missing}</dd></div>
              </dl>
              <div className="ep-block"><h3 className="ep-sub">Përshkrimi</h3>{description ? <p className="ep-bio">{description}</p> : missing}</div>
            </Card.Content>
          </Card>
          <Card className="uo-card">
            <SectionHead title="Kontakti" action={<Button size="sm" variant="ghost" className="uo-link-btn" onPress={startEdit}><Pencil size={14} aria-hidden />Ndrysho</Button>} />
            <Card.Content className="uo-card-body">
              <dl className="up-facts">
                <div className="up-fact"><dt>Email</dt><dd>{contactEmail ? <a className="cp-link" href={`mailto:${contactEmail}`}>{contactEmail}</a> : missing}</dd></div>
                <div className="up-fact"><dt>Telefoni</dt><dd>{contactPhone ? <a className="cp-link" href={`tel:${contactPhone}`}>{contactPhone}</a> : missing}</dd></div>
                <div className="up-fact"><dt>Website</dt><dd>{website ? <a className="cp-link" href={websiteHref(website)} target="_blank" rel="noopener noreferrer">{website}</a> : missing}</dd></div>
                <div className="up-fact"><dt>Adresa</dt><dd>{address || missing}</dd></div>
              </dl>
            </Card.Content>
          </Card>
        </div>
        <aside className="up-col">
          {completion?.exists && completionMissing.length > 0 ? <Card className="uo-card">
            <SectionHead title="Plotëso profilin" meta={<span className="uo-card-meta is-strong">{completionMissing.length} {completionMissing.length === 1 ? 'e dhënë mbetet' : 'të dhëna mbeten'}</span>} />
            <Card.Content className="uo-card-body uo-setup">
              <div className="uo-missing"><span>Mungojnë:</span>{completionMissing.map((field) => <Chip key={field.key} size="sm" variant="soft"><Chip.Label>{field.label}</Chip.Label></Chip>)}</div>
              <Button size="sm" variant="primary" onPress={startEdit}>Plotëso profilin</Button>
            </Card.Content>
          </Card> : null}
          <Card className="uo-card">
            <SectionHead title="Rrjetet sociale" meta={socialEntries.length ? <span className="uo-card-meta">{socialEntries.length}</span> : null} action={socialEntries.length ? <Button size="sm" variant="ghost" className="uo-link-btn" onPress={startEdit}><Pencil size={14} aria-hidden />Ndrysho</Button> : null} />
            <Card.Content className="uo-card-body">
              {socialEntries.length ? <SocialLinksList entries={socialEntries} className="ep-social" /> : <EmptyNote text="Nuk ke shtuar asnjë rrjet social." action="Shto rrjete" onAction={startEdit} />}
            </Card.Content>
          </Card>
          <Card className="uo-card">
            <SectionHead title="Sfondi i profilit publik" />
            <Card.Content className="uo-card-body ep-stack">
              <div className="ep-cover"><img src={coverPreview || '/images/login-advice.png'} alt="" /></div>
              <Button size="sm" variant="outline" className="ep-cover-btn" isPending={uploading === 'cover'} onPress={() => coverInput.current?.click()}><ImageIcon size={15} aria-hidden />{uploading === 'cover' ? 'Duke ngarkuar…' : 'Ndrysho sfondin'}</Button>
              <input ref={coverInput} type="file" accept={IMAGE_ACCEPT} hidden disabled={uploading === 'cover'} onChange={(e) => { void onCoverChange(e.target.files?.[0]); e.target.value = '' }} />
            </Card.Content>
          </Card>
        </aside>
      </div>
    </section>
  )
}
