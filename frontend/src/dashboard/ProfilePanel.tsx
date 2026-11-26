import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Card, Chip, buttonVariants, toast } from '@heroui/react'
import ConfirmActionDialog from '../components/ConfirmActionDialog'
import { Camera, ExternalLink, Globe, ImageIcon, MapPin, Pencil, Trash2 } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchMyBusinesses, removeBusinessCover, updateBusinessProfile, uploadBusinessCover, uploadBusinessLogo, type BusinessProfile } from '../api/businesses'
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
import ProfileCover from '../components/ProfileCover'
import { getErrorMessage } from '../utils/errors'
import { catalogLanguage } from '../i18n'
import ExpertProfilePage from './ExpertProfilePage'
import { SectionHead } from './OverviewParts'
import { EmptyNote, filledSocialLinks, SocialLinksList, UserProfile } from './UserProfilePage'
import { AiTrustRecommendationsCard } from '../components/ai/AiTrustRecommendationsCard'
import { providerPath } from '../utils/publicPaths'
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
  const { t } = useTranslation()
  return <span className="profile-field-hint">{required ? t('profile.required') : t('profile.optional')}</span>
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
  const { t } = useTranslation()
  return (
    <fieldset className="full checkbox-fieldset profile-social-fieldset">
      <legend>{t('profile.socialLinks')} <FieldHint required={false} /></legend>
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
  const { t, i18n } = useTranslation()
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
  const [removingCover, setRemovingCover] = useState(false)
  const [confirmRemoveCover, setConfirmRemoveCover] = useState(false)
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
      toast.success(t('profile.company.logoUploaded'))
    } catch (err) {
      toast.danger(getErrorMessage(err))
      setLogoPreview(mediaUrl(business.logoUrl))
    } finally {
      setUploading(null)
      URL.revokeObjectURL(local)
    }
  }

  async function onRemoveCover() {
    if (!business) return
    setConfirmRemoveCover(false)
    setRemovingCover(true)
    setUploading('cover')
    try {
      const next = await removeBusinessCover(business._id)
      setBusiness(next)
      setCoverPreview('')
      await onSaved()
      toast.success(t('profile.coverRemoved'))
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setRemovingCover(false)
      setUploading(null)
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
      toast.success(t('profile.coverUploaded'))
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
      setError(t('profile.company.cityRequired'))
      return
    }
    if (!categoryId) {
      setError(t('profile.company.categoryRequired'))
      return
    }
    const selected = categories.find((item) => item._id === categoryId)
    if (!selected) {
      setError(t('profile.company.categoryInvalid'))
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
      toast.success(t('profile.company.saved'))
      navigate('/dashboard/company/profile')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function startEdit() { navigate('/dashboard/company/profile/edit') }

  if (loading) return <p className="muted" role="status">{t('profile.company.loading')}</p>

  if (!business) {
    return (
      <div className="profile-section-block">
        <p className="muted">
          {t('profile.company.none')}{' '}
          <Link to="/dashboard/company/create">{t('profile.createCompany')}</Link>
        </p>
      </div>
    )
  }

  const statusLabel = business.status === 'active'
    ? t('status.active')
    : business.status === 'suspended'
      ? t('status.suspended')
      : business.status === 'closed'
        ? t('status.closed')
        : t('status.draft')

  const category = categories.find((item) => item._id === categoryId)
  const place = city ? locationLabel(city, catalogLanguage(i18n.language)) : business.branches?.[0]?.location?.cityName || ''
  const missing = <span className="up-missing">{t('profile.notAdded')}</span>
  const socialEntries = filledSocialLinks(socialLinks)
  const completionMissing = completion?.exists ? completion.section.missingRequired : []
  const isComplete = completion?.exists && completion.overallPercent !== null && completionMissing.length === 0

  if (editing) {
    return (
      <section className="uo up">
        <header className="uo-head"><div className="uo-head-copy"><h1>{t('profile.editProfile')}</h1><p>{t('profile.company.editLead')}</p></div></header>
        <form className="up-form" onSubmit={onSave}>
          <Card className="uo-card">
            <SectionHead title={t('profile.company.logo')} />
            <Card.Content className="uo-card-body">
              <div className="up-photo">
                <ProfileAvatar src={logoPreview} seed={business._id} alt={publicName} size="fill" fit="contain" className="up-photo-avatar" />
                <div className="up-photo-copy">
                  <Button size="sm" variant="outline" isPending={uploading === 'logo'} isDisabled={saving} onPress={() => logoInput.current?.click()}><Camera size={16} aria-hidden />{uploading === 'logo' ? t('profile.uploading') : logoPreview ? t('profile.company.changeLogo') : t('profile.company.uploadLogo')}</Button>
                  <p className="up-hint">{t('profile.company.logoHint')}</p>
                </div>
                <input ref={logoInput} type="file" accept={IMAGE_ACCEPT} hidden disabled={uploading === 'logo'} onChange={(e) => { void onLogoChange(e.target.files?.[0]); e.target.value = '' }} />
              </div>
            </Card.Content>
          </Card>
          <Card className="uo-card">
            <SectionHead title={t('profile.company.info')} />
            <Card.Content className="uo-card-body"><div className="service-form cp-form">
              <label>{t('profile.company.name')} <FieldHint required /><input value={publicName} onChange={(e) => setPublicName(e.target.value)} required maxLength={160} /></label>
              <label>{t('profile.categoryIndustry')} <FieldHint required /><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required disabled={!categories.length}><option value="">{categories.length ? t('profile.chooseCategory') : t('home.loadingCategories')}</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name.sq}</option>)}</select></label>
              <div className="full field"><span className="profile-inline-label">{t('profile.city')} <FieldHint required /></span><LocationSelector value={city} onChange={setCity} disabled={saving} /></div>
              <label className="full">{t('profile.description')} <FieldHint required /><textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} maxLength={3000} /></label>
            </div></Card.Content>
          </Card>
          <Card className="uo-card">
            <SectionHead title={t('profile.company.contact')} />
            <Card.Content className="uo-card-body"><div className="service-form cp-form">
              <label>{t('profile.company.email')} <FieldHint required /><input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required type="email" maxLength={160} /></label>
              <label>{t('profile.phoneNumber')} <FieldHint required /><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required placeholder="+38344123456" maxLength={32} /></label>
              <label>{t('profile.website')} <FieldHint required={false} /><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" maxLength={500} /></label>
              <label>{t('profile.address')} <FieldHint required={false} /><input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={240} /></label>
            </div></Card.Content>
          </Card>
          <Card className="uo-card"><SectionHead title={t('footer.social')} /><Card.Content className="uo-card-body"><div className="service-form cp-form"><SocialLinksFields value={socialLinks} onChange={setSocialLinks} disabled={saving} /></div></Card.Content></Card>
          {error ? <p className="up-error" role="alert">{error}</p> : null}
          <div className="up-actions"><Button variant="outline" onPress={() => setConfirmCancel(true)} isDisabled={saving || uploading !== null}>{t('notifications.cancel')}</Button><Button type="submit" variant="primary" isPending={saving} isDisabled={uploading !== null || !categories.length}>{saving ? t('req.saving') : t('profile.saveChanges')}</Button></div>
        </form>
        <ConfirmActionDialog
          isOpen={confirmRemoveCover}
          onClose={() => setConfirmRemoveCover(false)}
          onConfirm={() => void onRemoveCover()}
          title={t('profile.removeCoverTitle')}
          description={t('profile.removeCoverText')}
          confirmLabel={t('profile.removeCover')}
          pending={removingCover}
        />
        <ConfirmActionDialog isOpen={confirmCancel} onClose={() => setConfirmCancel(false)} onConfirm={() => { setConfirmCancel(false); navigate('/dashboard/company/profile') }} title={t('profile.discardTitle')} description={t('profile.company.discardText')} confirmLabel={t('profile.discardConfirm')} />
      </section>
    )
  }

  return (
    <section className="uo up cp">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>{t('dash.profile')}</h1>
          <p>{t('profile.company.lead')}</p>
        </div>
        {user ? <Link to={providerPath({ uid: user.uid })} className={`${buttonVariants({ variant: 'outline' })} uo-primary`}>
          <ExternalLink size={16} aria-hidden /> {t('profile.viewPublic')}
        </Link> : null}
      </header>

      <Card className="uo-card up-hero">
        <div className="up-hero-main">
          <div className="ep-avatar">
            <ProfileAvatar src={logoPreview} seed={business._id} alt={publicName} size="fill" fit="contain" className="up-hero-avatar" />
            <button type="button" className="ep-avatar-btn" aria-label={t('profile.company.changeLogoAria')} title={t('profile.company.changeLogoAria')} disabled={uploading === 'logo'} onClick={() => logoInput.current?.click()}><Camera size={15} aria-hidden /></button>
            <input ref={logoInput} type="file" accept={IMAGE_ACCEPT} hidden disabled={uploading === 'logo'} onChange={(e) => { void onLogoChange(e.target.files?.[0]); e.target.value = '' }} />
          </div>
          <div className="up-hero-copy">
            <div className="up-hero-title">
              <h2>{publicName || t('profile.company.fallbackName')}</h2>
              {isComplete ? <Chip size="sm" variant="soft" color="success"><Chip.Label>{t('profile.complete')}</Chip.Label></Chip> : null}
              <Chip size="sm" variant="soft"><Chip.Label>{statusLabel}</Chip.Label></Chip>
              {business.verification?.status === 'verified' ? <Chip size="sm" variant="soft" color="accent"><Chip.Label>{t('profile.company.verified')}</Chip.Label></Chip> : null}
            </div>
            <ul className="up-hero-meta">
              {category ? <li>{category.name.sq}</li> : null}
              {place ? <li><MapPin size={15} aria-hidden />{place}</li> : null}
              {website ? <li><Globe size={15} aria-hidden /><a href={websiteHref(website)} target="_blank" rel="noopener noreferrer" className="cp-link">{website}</a></li> : null}
            </ul>
          </div>
        </div>
        <Button variant="primary" className="up-hero-action" onPress={startEdit}><Pencil size={16} aria-hidden />{t('profile.editProfile')}</Button>
      </Card>

      <AiTrustRecommendationsCard isCompany providerUid={user?.uid} />

      <div className="uo-grid up-grid">
        <div className="up-col">
          <Card className="uo-card">
            <SectionHead title={t('profile.company.info')} action={<Button size="sm" variant="ghost" className="uo-link-btn" onPress={startEdit}><Pencil size={14} aria-hidden />{t('profile.edit')}</Button>} />
            <Card.Content className="uo-card-body ep-stack">
              <dl className="up-facts">
                <div className="up-fact"><dt>{t('profile.company.name')}</dt><dd>{publicName || missing}</dd></div>
                <div className="up-fact"><dt>{t('profile.categoryIndustry')}</dt><dd>{category?.name.sq || missing}</dd></div>
                <div className="up-fact"><dt>{t('profile.city')}</dt><dd>{place || missing}</dd></div>
              </dl>
              <div className="ep-block"><h3 className="ep-sub">{t('profile.description')}</h3>{description ? <p className="ep-bio">{description}</p> : missing}</div>
            </Card.Content>
          </Card>
          <Card className="uo-card">
            <SectionHead title={t('profile.company.contact')} action={<Button size="sm" variant="ghost" className="uo-link-btn" onPress={startEdit}><Pencil size={14} aria-hidden />{t('profile.edit')}</Button>} />
            <Card.Content className="uo-card-body">
              <dl className="up-facts">
                <div className="up-fact"><dt>{t('req.email')}</dt><dd>{contactEmail ? <a className="cp-link" href={`mailto:${contactEmail}`}>{contactEmail}</a> : missing}</dd></div>
                <div className="up-fact"><dt>{t('req.phone')}</dt><dd>{contactPhone ? <a className="cp-link" href={`tel:${contactPhone}`}>{contactPhone}</a> : missing}</dd></div>
                <div className="up-fact"><dt>{t('profile.website')}</dt><dd>{website ? <a className="cp-link" href={websiteHref(website)} target="_blank" rel="noopener noreferrer">{website}</a> : missing}</dd></div>
                <div className="up-fact"><dt>{t('profile.address')}</dt><dd>{address || missing}</dd></div>
              </dl>
            </Card.Content>
          </Card>
        </div>
        <aside className="up-col">
          {completion?.exists && completionMissing.length > 0 ? <Card className="uo-card">
            <SectionHead title={t('profile.completeTitle')} meta={<span className="uo-card-meta is-strong">{t('profile.company.remaining', { count: completionMissing.length })}</span>} />
            <Card.Content className="uo-card-body uo-setup">
              <div className="uo-missing"><span>{t('profile.missing')}</span>{completionMissing.map((field) => <Chip key={field.key} size="sm" variant="soft"><Chip.Label>{field.label}</Chip.Label></Chip>)}</div>
              <Button size="sm" variant="primary" onPress={startEdit}>{t('profile.completeTitle')}</Button>
            </Card.Content>
          </Card> : null}
          <Card className="uo-card">
            <SectionHead title={t('footer.social')} meta={socialEntries.length ? <span className="uo-card-meta">{socialEntries.length}</span> : null} action={socialEntries.length ? <Button size="sm" variant="ghost" className="uo-link-btn" onPress={startEdit}><Pencil size={14} aria-hidden />{t('profile.edit')}</Button> : null} />
            <Card.Content className="uo-card-body">
              {socialEntries.length ? <SocialLinksList entries={socialEntries} className="ep-social" /> : <EmptyNote text={t('profile.socialEmpty')} action={t('profile.socialAdd')} onAction={startEdit} />}
            </Card.Content>
          </Card>
          <Card className="uo-card">
            <SectionHead title={t('profile.cover')} />
            <Card.Content className="uo-card-body ep-stack">
              <ProfileCover src={coverPreview} seed={user?.uid || ''} className="ep-cover" />
              {coverPreview ? null : <p className="ds-hint">{t('profile.coverDefault')}</p>}
              <Button size="sm" variant="outline" className="ep-cover-btn" isPending={uploading === 'cover' && !removingCover} isDisabled={removingCover} onPress={() => coverInput.current?.click()}><ImageIcon size={15} aria-hidden />{uploading === 'cover' && !removingCover ? t('profile.uploading') : t('profile.changeCover')}</Button>
              {business?.coverUrl ? (
                <Button size="sm" variant="ghost" className="ep-cover-btn" isPending={removingCover} isDisabled={uploading === 'cover'} onPress={() => setConfirmRemoveCover(true)}>
                  <Trash2 size={15} aria-hidden />
                  {removingCover ? t('profile.removingCover') : t('profile.removeCover')}
                </Button>
              ) : null}
              <input ref={coverInput} type="file" accept={IMAGE_ACCEPT} hidden disabled={uploading === 'cover'} onChange={(e) => { void onCoverChange(e.target.files?.[0]); e.target.value = '' }} />
            </Card.Content>
          </Card>
        </aside>
      </div>
    </section>
  )
}
