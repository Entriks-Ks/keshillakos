import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from '@heroui/react'
import { Link, useLocation } from 'react-router-dom'
import {
  fetchCategories,
  fetchSubcategories,
  type CatalogCategory,
  type CatalogSubcategory,
} from '../api/catalog'
import { locationLabel, matchLocationByText, type LocationSelection } from '../api/locations'
import { IMAGE_ACCEPT, IMAGE_ACCEPT_HINT, MAX_SERVICE_PHOTOS, mediaUrl } from '../api/media'
import {
  createService,
  deleteService,
  fetchMyServices,
  updateService,
  uploadServicePhoto,
  type ServiceDetails,
  type ServiceItem,
} from '../api/services'
import {
  fetchBusinessTeam,
  fetchMyBusinesses,
  type TeamPerson,
} from '../api/onboarding'
import ExtensionFieldsForm, { categorySpecificFields } from '../components/ExtensionFieldsForm'
import LocationSelector from '../components/LocationSelector'
import DashPageHeader from './DashPageHeader'
import { useCatalogOptions } from '../hooks/useCatalogOptions'
import { getErrorMessage } from '../utils/errors'

type PricingMode = 'agreement' | 'from' | 'fixed' | 'range'
type OfferOwner = 'company' | 'expert'

function currentCatalogLanguage(): 'sq' | 'en' {
  return document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'sq'
}

function catalogLabel(item: { name: { sq: string; en: string } }, language: 'sq' | 'en') {
  return item.name[language] || item.name.sq
}

function derivePricingMode(from: string, to: string): PricingMode {
  const fromValue = from.trim()
  const toValue = to.trim()
  if (!fromValue && !toValue) return 'agreement'
  if (fromValue && toValue && fromValue === toValue) return 'fixed'
  if (fromValue && toValue) return 'range'
  return 'from'
}

function FieldLabel({
  children,
  required,
  optional,
  language,
}: {
  children: ReactNode
  required?: boolean
  optional?: boolean
  language: 'sq' | 'en'
}) {
  return (
    <span className="service-field-label">
      <span>{children}</span>
      {required ? (
        <span className="service-field-badge is-required" title={language === 'en' ? 'Required' : 'E detyrueshme'}>
          {language === 'en' ? 'Required' : 'E detyrueshme'}
        </span>
      ) : null}
      {optional ? (
        <span className="service-field-badge is-optional">
          {language === 'en' ? 'Optional' : 'Opsionale'}
        </span>
      ) : null}
    </span>
  )
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="service-form-section full">
      <header className="service-form-section-head">
        <h3 className="service-form-section-title">{title}</h3>
        {description ? <p className="service-form-section-desc">{description}</p> : null}
      </header>
      <div className="service-form-section-body">{children}</div>
    </section>
  )
}

function FieldHint({ children }: { children: ReactNode }) {
  return <p className="service-field-hint">{children}</p>
}

export default function ProviderServicesPanel() {
  const formRef = useRef<HTMLFormElement>(null)
  const editingCatalogRef = useRef<{ categoryId?: string; subcategoryId?: string; subcategory?: string } | null>(null)
  const routeLocation = useLocation()
  const isCompany = routeLocation.pathname.includes('/dashboard/company')
  const availabilityPath = isCompany
    ? '/dashboard/company/availability'
    : '/dashboard/provider/availability'
  const profilePath = isCompany
    ? '/dashboard/company/profile'
    : '/dashboard/provider/profile'
  const {
    languages,
    deliveryModes: deliveryModeOptions,
    availabilityOptions,
    options: catalogOptions,
    error: optionsError,
  } = useCatalogOptions()
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [catalogLanguage, setCatalogLanguage] = useState(currentCatalogLanguage)
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [subcategories, setSubcategories] = useState<CatalogSubcategory[]>([])
  const [subcategoryId, setSubcategoryId] = useState('')
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false)
  const [location, setLocation] = useState<LocationSelection | null>(null)
  const [pricingMode, setPricingMode] = useState<PricingMode>('from')
  const [priceFrom, setPriceFrom] = useState('')
  const [priceTo, setPriceTo] = useState('')
  const [deliveryModes, setDeliveryModes] = useState<string[]>([])
  const [supportLanguages, setSupportLanguages] = useState<string[]>([])
  const [availabilityMode, setAvailabilityMode] = useState('request')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [workSamples, setWorkSamples] = useState('')
  const [extensionValues, setExtensionValues] = useState<Record<string, unknown>>({})
  const [photos, setPhotos] = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [offerOwner, setOfferOwner] = useState<OfferOwner>('company')
  const [businessId, setBusinessId] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [teamExperts, setTeamExperts] = useState<TeamPerson[]>([])
  const [expertProviderId, setExpertProviderId] = useState('')
  const [responsibleExpertId, setResponsibleExpertId] = useState('')
  const [companyContextLoading, setCompanyContextLoading] = useState(false)

  const sq = catalogLanguage === 'sq'
  const section = (n: number) => (isCompany ? n + 1 : n)
  const expertsWithProfiles = useMemo(
    () => teamExperts.filter((person) => Boolean(person.providerProfileId)),
    [teamExperts],
  )
  const selectedCategory = useMemo(
    () => categories.find((item) => item._id === categoryId) ?? null,
    [categories, categoryId],
  )
  const selectedSubcategory = useMemo(
    () => subcategories.find((item) => item._id === subcategoryId) ?? null,
    [subcategories, subcategoryId],
  )
  const extensionFields = selectedCategory?.extensionFields ?? []
  const showCategoryFields = Boolean(subcategoryId && categorySpecificFields(extensionFields).length)
  const needsPhysicalLocation = deliveryModes.includes('physical') || deliveryModes.includes('group')
  const onlineOnly = deliveryModes.length > 0 && deliveryModes.every((mode) => mode === 'online')
  const isSlotsAvailability = availabilityMode === 'slots'

  const availabilityHelp: Record<string, { sq: string; en: string }> = {
    request: {
      sq: 'Klienti dërgon kërkesë; ti përgjigjesh kur je i lirë.',
      en: 'Clients send a request; you reply when available.',
    },
    by_arrangement: {
      sq: 'Koha e takimit caktohet së bashku pas kontaktit.',
      en: 'Meeting time is agreed together after contact.',
    },
    slots: {
      sq: 'Klienti zgjedh nga oraret e lira që ke hapur te Disponueshmëria.',
      en: 'Clients pick from open slots you manage under Availability.',
    },
  }

  useEffect(() => {
    const observer = new MutationObserver(() => setCatalogLanguage(currentCatalogLanguage()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isCompany) return
    let cancelled = false
    setCompanyContextLoading(true)
    fetchMyBusinesses()
      .then(async (businesses) => {
        if (cancelled) return
        const business = businesses[0]
        if (!business) {
          setBusinessId('')
          setBusinessName('')
          setTeamExperts([])
          return
        }
        setBusinessId(business._id)
        setBusinessName(business.publicName)
        const team = await fetchBusinessTeam(business._id)
        if (cancelled) return
        const people = [...team.owners, ...team.members]
        const unique = new Map<string, TeamPerson>()
        for (const person of people) unique.set(person.id, person)
        setTeamExperts([...unique.values()])
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setCompanyContextLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isCompany])

  useEffect(() => {
    if (!isCompany || offerOwner !== 'expert') return
    if (expertProviderId && expertsWithProfiles.some((person) => person.providerProfileId === expertProviderId)) return
    setExpertProviderId(expertsWithProfiles[0]?.providerProfileId || '')
  }, [isCompany, offerOwner, expertProviderId, expertsWithProfiles])

  useEffect(() => {
    let cancelled = false
    fetchCategories()
      .then((items) => {
        if (cancelled) return
        const active = items.filter((item) => item.isActive).sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
        setCategories(active)
        setCategoryId((previous) => (active.some((item) => item._id === previous) ? previous : active[0]?._id ?? ''))
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!categoryId) {
      setSubcategories([])
      setSubcategoryId('')
      return
    }
    const controller = new AbortController()
    setSubcategoriesLoading(true)
    fetchSubcategories(categoryId, controller.signal)
      .then((items) => {
        const active = items.filter((item) => item.isActive).sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
        setSubcategories(active)
        setSubcategoryId((previous) => {
          if (previous && active.some((item) => item._id === previous)) return previous
          const editing = editingCatalogRef.current
          if (editing) {
            const matched = active.find(
              (item) =>
                item._id === editing.subcategoryId
                || item.name.sq === editing.subcategory
                || item.name.en === editing.subcategory
                || item.slug === editing.subcategory,
            )
            if (matched) return matched._id
          }
          return active[0]?._id ?? ''
        })
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setSubcategories([])
          setSubcategoryId('')
          setError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSubcategoriesLoading(false)
      })
    return () => controller.abort()
  }, [categoryId])

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
    if (optionsError) setError(optionsError)
  }, [optionsError])

  useEffect(() => {
    if (editingId) return
    if (languages[0] && !supportLanguages.length) {
      setSupportLanguages(languages.slice(0, 2).map((item) => item.value))
    }
    if (availabilityOptions[0] && !availabilityOptions.some((item) => item.value === availabilityMode)) {
      setAvailabilityMode(availabilityOptions.find((item) => item.id === 'request')?.value || availabilityOptions[0].value)
    }
  }, [languages, availabilityOptions, editingId, supportLanguages.length, availabilityMode])

  useEffect(() => {
    if (editingId) return
    const next: Record<string, unknown> = {}
    for (const field of categorySpecificFields(extensionFields)) {
      if (field.defaultValue !== undefined) next[field.key] = field.defaultValue
      else if (field.type === 'boolean') next[field.key] = false
      else if (field.type === 'stringArray') next[field.key] = []
      else if (field.allowedValues?.length) next[field.key] = field.allowedValues[0]
      else next[field.key] = ''
    }
    setExtensionValues(next)
  }, [categoryId, extensionFields, editingId])

  function applyPricingMode(mode: PricingMode, from = priceFrom, to = priceTo) {
    setPricingMode(mode)
    if (mode === 'agreement') {
      setPriceFrom('')
      setPriceTo('')
      return
    }
    if (mode === 'from') {
      setPriceTo('')
      return
    }
    if (mode === 'fixed') {
      const value = from.trim() || to.trim()
      setPriceFrom(value)
      setPriceTo(value)
      return
    }
    if (!to.trim() && from.trim()) setPriceTo(from)
  }

  function resetForm() {
    setEditingId(null)
    editingCatalogRef.current = null
    setTitle('')
    setDescription('')
    setCategoryId(categories[0]?._id ?? '')
    setSubcategoryId('')
    setLocation(null)
    setPricingMode('from')
    setPriceFrom('')
    setPriceTo('')
    setDeliveryModes([])
    setSupportLanguages(languages.slice(0, 2).map((item) => item.value))
    setAvailabilityMode(availabilityOptions.find((item) => item.id === 'request')?.value || availabilityOptions[0]?.value || 'request')
    setPortfolioUrl('')
    setWorkSamples('')
    setExtensionValues({})
    setPhotos([])
    setOfferOwner('company')
    setExpertProviderId(expertsWithProfiles[0]?.providerProfileId || '')
    setResponsibleExpertId('')
  }

  function startEdit(service: ServiceItem) {
    const details = service.details || {}
    setEditingId(service.id)
    editingCatalogRef.current = {
      categoryId: service.categoryId,
      subcategoryId: service.subcategoryId,
      subcategory: service.subcategory,
    }
    setTitle(service.title)
    setDescription(service.description)
    const matchedCategory = categories.find(
      (item) => item._id === service.categoryId || item.slug === service.categoryId,
    )
    setCategoryId(matchedCategory?._id || service.categoryId || categoryId)
    setSubcategoryId(service.subcategoryId || '')
    setLocation(null)
    void matchLocationByText(service.location).then(setLocation)
    const nextFrom = service.priceFrom != null ? String(service.priceFrom) : ''
    const nextTo = details.priceTo != null ? String(details.priceTo) : ''
    setPriceFrom(nextFrom)
    setPriceTo(nextTo)
    setPricingMode(derivePricingMode(nextFrom, nextTo))
    setDeliveryModes(details.deliveryModes || [])
    setSupportLanguages(details.supportLanguages?.length ? details.supportLanguages : languages.slice(0, 2).map((item) => item.value))
    setAvailabilityMode(details.availabilityMode || 'request')
    setPortfolioUrl(details.portfolioUrl || '')
    setWorkSamples(details.references || '')
    const isCompanyOwned = service.provider?.providerType === 'business' || service.provider?.role === 'company'
    setOfferOwner(isCompanyOwned ? 'company' : 'expert')
    setExpertProviderId(!isCompanyOwned && service.providerId ? service.providerId : (expertsWithProfiles[0]?.providerProfileId || ''))
    setResponsibleExpertId(service.staffUserId || '')
    const next: Record<string, unknown> = {}
    for (const field of categorySpecificFields(matchedCategory?.extensionFields || extensionFields)) {
      const raw = (details as Record<string, unknown>)[field.key]
      next[field.key] = raw !== undefined ? raw : field.defaultValue ?? (field.type === 'boolean' ? false : field.type === 'stringArray' ? [] : '')
    }
    setExtensionValues(next)
    setPhotos(details.photos || [])
    setError('')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function collectDetails(): ServiceDetails {
    const details: ServiceDetails = { ...extensionValues, photos }
    if (deliveryModes.length) details.deliveryModes = deliveryModes
    if (supportLanguages.length) {
      details.supportLanguages = supportLanguages
      details.crossBorder = true
    }
    if (pricingMode === 'fixed' && priceFrom.trim()) {
      details.priceTo = Number(priceFrom)
    } else if (pricingMode === 'range' && priceTo.trim()) {
      details.priceTo = Number(priceTo)
    } else if (pricingMode !== 'agreement' && priceTo.trim()) {
      details.priceTo = Number(priceTo)
    }
    if (portfolioUrl.trim()) details.portfolioUrl = portfolioUrl.trim()
    if (workSamples.trim()) details.references = workSamples.trim()
    if (availabilityMode) details.availabilityMode = availabilityMode as ServiceDetails['availabilityMode']
    return details
  }

  async function onPhotoChange(file: File | undefined) {
    if (!file) return
    setError('')
    setUploadingPhoto(true)
    try {
      const url = await uploadServicePhoto(file)
      setPhotos((prev) => [...prev, url].slice(0, MAX_SERVICE_PHOTOS))
      toast.success(sq ? 'Fotoja u ngarkua.' : 'Photo uploaded.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!categoryId || !subcategoryId || !selectedSubcategory) {
      setError(sq ? 'Zgjidh kategorinë dhe nënkategorinë.' : 'Choose a category and subcategory.')
      return
    }
    if (!location) {
      setError(sq ? 'Zgjidh lokacionin nga lista e qyteteve.' : 'Choose a location from the city list.')
      return
    }
    if (pricingMode === 'from' && !priceFrom.trim()) {
      setError(sq ? 'Shkruaj çmimin fillestar ose zgjidh “Me marrëveshje”.' : 'Enter a starting price or choose “By agreement”.')
      return
    }
    if (pricingMode === 'fixed' && !priceFrom.trim()) {
      setError(sq ? 'Shkruaj çmimin fiks në euro.' : 'Enter the fixed price in euros.')
      return
    }
    if (pricingMode === 'range') {
      if (!priceFrom.trim() || !priceTo.trim()) {
        setError(sq ? 'Plotëso çmimin nga dhe deri.' : 'Fill in both the from and to prices.')
        return
      }
      if (Number(priceTo) < Number(priceFrom)) {
        setError(sq ? 'Çmimi “deri” duhet të jetë më i madh ose i barabartë me “nga”.' : '“Price to” must be greater than or equal to “price from”.')
        return
      }
    }
    if (isCompany) {
      if (!businessId) {
        setError(sq ? 'Krijo kompaninë para se të ofrosh shërbime.' : 'Create the company before offering services.')
        return
      }
      if (offerOwner === 'expert' && !expertProviderId) {
        setError(sq ? 'Zgjidh ekspertin e ekipit që e ofron shërbimin.' : 'Choose the team expert who offers this service.')
        return
      }
    }
    setSubmitting(true)
    const resolvedFrom =
      pricingMode === 'agreement'
        ? undefined
        : pricingMode === 'fixed'
          ? (priceFrom.trim() ? Number(priceFrom) : undefined)
          : priceFrom.trim()
            ? Number(priceFrom)
            : undefined
    const payload = {
      title,
      description,
      categoryId,
      subcategory: catalogLabel(selectedSubcategory, catalogLanguage),
      subcategoryId,
      location: locationLabel(location, 'sq'),
      priceFrom: resolvedFrom,
      details: collectDetails(),
      ...(isCompany
        ? offerOwner === 'company'
          ? {
              businessId,
              staffUserId: responsibleExpertId || null,
            }
          : {
              providerId: expertProviderId,
              businessId,
              staffUserId: null,
            }
        : {}),
    }
    try {
      if (editingId) {
        const service = await updateService(editingId, payload)
        setServices((prev) => prev.map((item) => (item.id === service.id ? service : item)))
        resetForm()
        toast.success(sq ? 'Shërbimi u përditësua.' : 'Service updated.')
      } else {
        const service = await createService(payload)
        setServices((prev) => [service, ...prev])
        resetForm()
        toast.success(sq ? 'Shërbimi u publikua dhe shfaqet te ofertat.' : 'Service published and visible in offers.')
      }
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(sq ? 'A je i sigurt që do ta fshish këtë shërbim?' : 'Delete this service?')) return
    setError('')
    setDeletingId(id)
    try {
      await deleteService(id)
      setServices((prev) => prev.filter((item) => item.id !== id))
      if (editingId === id) resetForm()
      toast.success(sq ? 'Shërbimi u fshi.' : 'Service deleted.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setDeletingId('')
    }
  }

  const guidelines =
    selectedCategory?.guidelines && typeof selectedCategory.guidelines === 'object'
      ? ((selectedCategory.guidelines as { sq?: string; en?: string })[catalogLanguage]
        || (selectedCategory.guidelines as { sq?: string }).sq)
      : null

  return (
    <section className="provider-section">
      <DashPageHeader
        title={editingId ? (sq ? 'Ndrysho shërbimin' : 'Edit service') : (sq ? 'Ofro një shërbim' : 'Offer a service')}
        description={sq
          ? 'Plotëso seksionet hap pas hapi. Fushat e shënuara “E detyrueshme” duhen për publikim.'
          : 'Complete the sections step by step. Fields marked “Required” are needed to publish.'}
      />

      <form ref={formRef} onSubmit={onSubmit} className="service-form">
        {isCompany ? (
          <FormSection
            title={sq ? '1. Kush e ofron këtë shërbim?' : '1. Who offers this service?'}
            description={sq
              ? 'Zgjidh nëse oferta publikohet në emër të kompanisë ose të një eksperti të ekipit. Profili përkatës përdoret për përvojën dhe verifikimin.'
              : 'Choose whether the offer is published under the company or a team expert. The matching profile supplies experience and verification.'}
          >
            <div className="service-radio-list" role="radiogroup" aria-label={sq ? 'Kush e ofron këtë shërbim?' : 'Who offers this service?'}>
              <label className={`service-radio-card${offerOwner === 'company' ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="offerOwner"
                  checked={offerOwner === 'company'}
                  disabled={Boolean(editingId)}
                  onChange={() => {
                    setOfferOwner('company')
                    setExpertProviderId('')
                  }}
                />
                <span>
                  <strong>{sq ? 'Kompania' : 'Company'}</strong>
                  <em>
                    {sq
                      ? `Publikohet nën ${businessName || 'kompaninë'} dhe përdor profilin e kompanisë.`
                      : `Published under ${businessName || 'the company'} using the company profile.`}
                  </em>
                </span>
              </label>
              <label className={`service-radio-card${offerOwner === 'expert' ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="offerOwner"
                  checked={offerOwner === 'expert'}
                  disabled={Boolean(editingId)}
                  onChange={() => {
                    setOfferOwner('expert')
                    setResponsibleExpertId('')
                    setExpertProviderId(expertsWithProfiles[0]?.providerProfileId || '')
                  }}
                />
                <span>
                  <strong>{sq ? 'Ekspert i ekipit' : 'Team expert'}</strong>
                  <em>
                    {sq
                      ? 'Publikohet nën ekspertin e zgjedhur dhe përdor profilin e tij.'
                      : 'Published under the selected expert using their profile.'}
                  </em>
                </span>
              </label>
            </div>

            {offerOwner === 'expert' ? (
              <label>
                <FieldLabel required language={catalogLanguage}>{sq ? 'Zgjidh ekspertin' : 'Choose expert'}</FieldLabel>
                <select
                  value={expertProviderId}
                  required
                  disabled={Boolean(editingId) || companyContextLoading || expertsWithProfiles.length === 0}
                  onChange={(e) => setExpertProviderId(e.target.value)}
                >
                  {companyContextLoading ? (
                    <option value="">{sq ? 'Duke u ngarkuar...' : 'Loading...'}</option>
                  ) : null}
                  {!companyContextLoading && expertsWithProfiles.length === 0 ? (
                    <option value="">{sq ? 'Nuk ka ekspertë me profil' : 'No experts with a profile'}</option>
                  ) : null}
                  {expertsWithProfiles.map((person) => (
                    <option key={person.id} value={person.providerProfileId || ''}>
                      {person.name}{person.headline ? ` — ${person.headline}` : ''}
                    </option>
                  ))}
                </select>
                <FieldHint>
                  {sq
                    ? 'Vetëm anëtarët e ekipit me profil eksperti mund të zgjidhen.'
                    : 'Only team members with an expert profile can be selected.'}
                </FieldHint>
              </label>
            ) : null}

            {offerOwner === 'company' ? (
              <label>
                <FieldLabel optional language={catalogLanguage}>{sq ? 'Eksperti përgjegjës' : 'Responsible expert'}</FieldLabel>
                <select
                  value={responsibleExpertId}
                  disabled={companyContextLoading || teamExperts.length === 0}
                  onChange={(e) => setResponsibleExpertId(e.target.value)}
                >
                  <option value="">{sq ? 'Pa caktuar (opsionale)' : 'Unassigned (optional)'}</option>
                  {teamExperts.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}{person.headline ? ` — ${person.headline}` : ''}
                    </option>
                  ))}
                </select>
                <FieldHint>
                  {sq
                    ? 'Mund ta caktosh tani ose më vonë pasi të krijosh shërbimin. Nuk zëvendëson profilin e kompanisë.'
                    : 'Assign now or later after creating the service. This does not replace the company profile.'}
                </FieldHint>
              </label>
            ) : null}

            {!businessId && !companyContextLoading ? (
              <FieldHint>
                {sq ? (
                  <>Nuk ke kompani të menaxhueshme. <Link to="/dashboard/company/create">Krijo kompaninë</Link>.</>
                ) : (
                  <>No manageable company yet. <Link to="/dashboard/company/create">Create the company</Link>.</>
                )}
              </FieldHint>
            ) : null}
          </FormSection>
        ) : null}

        <FormSection
          title={sq ? `${section(1)}. Kategoria e shërbimit` : `${section(1)}. Service category`}
          description={sq
            ? 'Zgjidh fushën e përgjithshme, pastaj nënkategorinë konkrete që e përshkruan më mirë ofertën.'
            : 'Pick the general field first, then the specific subcategory that best describes the offer.'}
        >
          <label>
            <FieldLabel required language={catalogLanguage}>{sq ? 'Kategoria' : 'Category'}</FieldLabel>
            <select
              value={categoryId}
              required
              onChange={(e) => {
                setCategoryId(e.target.value)
                setSubcategoryId('')
              }}
            >
              {categories.length === 0 ? <option value="">{sq ? 'Duke u ngarkuar...' : 'Loading...'}</option> : null}
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {catalogLabel(category, catalogLanguage)}
                </option>
              ))}
            </select>
            <FieldHint>{sq ? 'P.sh. IT, Ligj, Marketing.' : 'E.g. IT, Law, Marketing.'}</FieldHint>
          </label>

          <label>
            <FieldLabel required language={catalogLanguage}>{sq ? 'Nënkategoria' : 'Subcategory'}</FieldLabel>
            <select
              value={subcategoryId}
              required
              disabled={!categoryId || subcategoriesLoading || subcategories.length === 0}
              onChange={(e) => setSubcategoryId(e.target.value)}
            >
              {subcategoriesLoading ? <option value="">{sq ? 'Duke u ngarkuar...' : 'Loading...'}</option> : null}
              {!subcategoriesLoading && subcategories.length === 0 ? (
                <option value="">{sq ? 'Nuk ka nënkategori' : 'No subcategories'}</option>
              ) : null}
              {subcategories.map((subcategory) => (
                <option key={subcategory._id} value={subcategory._id}>
                  {catalogLabel(subcategory, catalogLanguage)}
                </option>
              ))}
            </select>
            <FieldHint>
              {selectedCategory
                ? (sq
                  ? `Nënkategoritë për “${catalogLabel(selectedCategory, catalogLanguage)}”.`
                  : `Subcategories for “${catalogLabel(selectedCategory, catalogLanguage)}”.`)
                : (sq ? 'Zgjidh kategorinë më parë.' : 'Choose a category first.')}
            </FieldHint>
          </label>
        </FormSection>

        <FormSection
          title={sq ? `${section(2)}. Përshkrimi i ofertës` : `${section(2)}. Offer description`}
          description={sq
            ? 'Titulli dhe përshkrimi shfaqen te klientët. Shkruaj qartë çfarë ofron dhe çfarë përfshihet.'
            : 'Title and description are shown to clients. Be clear about what you offer and what is included.'}
        >
          <label className="full">
            <FieldLabel required language={catalogLanguage}>{sq ? 'Titulli i shërbimit' : 'Service title'}</FieldLabel>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder={sq ? 'P.sh. Ndërtim website për biznese të vogla' : 'E.g. Website build for small businesses'}
            />
            <FieldHint>{sq ? 'I shkurtër dhe specifike — jo vetëm emri i kategorisë.' : 'Keep it short and specific — not just the category name.'}</FieldHint>
          </label>

          <label className="full">
            <FieldLabel required language={catalogLanguage}>{sq ? 'Përshkrimi' : 'Description'}</FieldLabel>
            <textarea
              value={description}
              rows={4}
              required
              onChange={(e) => setDescription(e.target.value)}
              placeholder={sq
                ? 'Çfarë përfshihet, për kë është, sa zgjat dhe çfarë duhet të dije klienti.'
                : 'What is included, who it is for, how long it takes, and what the client should know.'}
            />
          </label>
        </FormSection>

        <FormSection
          title={sq ? `${section(3)}. Si ofrohet shërbimi` : `${section(3)}. How the service is delivered`}
          description={sq
            ? 'Thuaj nëse punon online, fizikisht ose në grup, dhe në cilat gjuhë komunikoni.'
            : 'Say whether you work online, in person, or in groups, and which languages you use.'}
        >
          <fieldset className="full checkbox-fieldset">
            <legend>
              <FieldLabel optional language={catalogLanguage}>{sq ? 'Mënyra e ofrimit' : 'Delivery mode'}</FieldLabel>
            </legend>
            <FieldHint>{sq ? 'Mund të zgjedhësh më shumë se një.' : 'You can select more than one.'}</FieldHint>
            <div className="service-option-grid">
              {deliveryModeOptions.map((mode) => (
                <label key={mode.id} className="check-row service-option-chip">
                  <input
                    type="checkbox"
                    checked={deliveryModes.includes(mode.value)}
                    onChange={() => {
                      setDeliveryModes((prev) =>
                        prev.includes(mode.value) ? prev.filter((item) => item !== mode.value) : [...prev, mode.value],
                      )
                    }}
                  />
                  {mode.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="full checkbox-fieldset">
            <legend>
              <FieldLabel optional language={catalogLanguage}>{sq ? 'Gjuhët e shërbimit' : 'Service languages'}</FieldLabel>
            </legend>
            <FieldHint>{sq ? 'Zgjidh gjuhët në të cilat mund të komunikosh me klientin.' : 'Select the languages you can use with clients.'}</FieldHint>
            <div className="service-option-grid">
              {languages.map((lang) => (
                <label key={lang.id} className="check-row service-option-chip">
                  <input
                    type="checkbox"
                    checked={supportLanguages.includes(lang.value)}
                    onChange={() => {
                      setSupportLanguages((prev) =>
                        prev.includes(lang.value) ? prev.filter((item) => item !== lang.value) : [...prev, lang.value],
                      )
                    }}
                  />
                  {lang.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="full field">
            <FieldLabel required language={catalogLanguage}>
              {needsPhysicalLocation
                ? (sq ? 'Qyteti ku ofron shërbimin' : 'City where you offer the service')
                : onlineOnly
                  ? (sq ? 'Qyteti ku bazohesh' : 'City you are based in')
                  : (sq ? 'Lokacioni' : 'Location')}
            </FieldLabel>
            <LocationSelector value={location} onChange={setLocation} />
            <FieldHint>
              {needsPhysicalLocation
                ? (sq ? 'Duhet për shërbime fizike ose në grup, që klientët të të gjejnë pranë tyre.' : 'Needed for in-person or group services so clients can find you nearby.')
                : onlineOnly
                  ? (sq ? 'Edhe për shërbime online, zgjidh qytetin ku bazohesh — përdoret për kërkim dhe filtra.' : 'Even for online services, pick your base city — it is used for search and filters.')
                  : (sq ? 'Zgjidh qytetin nga lista. Mos shkruaj tekst të lirë.' : 'Pick a city from the list. Do not type free text.')}
            </FieldHint>
          </div>
        </FormSection>

        <FormSection
          title={sq ? `${section(4)}. Çmimi` : `${section(4)}. Pricing`}
          description={sq
            ? 'Trego nëse çmimi është fiks, fillon nga një vlerë, është interval, ose caktohet me marrëveshje.'
            : 'Say whether the price is fixed, starts from an amount, is a range, or is agreed later.'}
        >
          <fieldset className="full checkbox-fieldset service-pricing-modes">
            <legend>
              <FieldLabel required language={catalogLanguage}>{sq ? 'Lloji i çmimit' : 'Pricing type'}</FieldLabel>
            </legend>
            <div className="service-radio-list">
              {([
                {
                  id: 'agreement' as const,
                  label: sq ? 'Me marrëveshje' : 'By agreement',
                  hint: sq ? 'Nuk shfaqet shumë fikse; çmimi diskutohen me klientin.' : 'No fixed amount; price is discussed with the client.',
                },
                {
                  id: 'from' as const,
                  label: sq ? 'Nga (çmim fillestar)' : 'Starting from',
                  hint: sq ? 'Shfaqet “nga €X”. Ideale kur çmimi varet nga rasti.' : 'Shows “from €X”. Ideal when price depends on the case.',
                },
                {
                  id: 'fixed' as const,
                  label: sq ? 'Çmim fiks' : 'Fixed price',
                  hint: sq ? 'Një shumë e qartë për të gjithë klientët.' : 'One clear amount for all clients.',
                },
                {
                  id: 'range' as const,
                  label: sq ? 'Interval çmimi' : 'Price range',
                  hint: sq ? 'Shfaqet “nga €X deri €Y”.' : 'Shows “from €X to €Y”.',
                },
              ]).map((option) => (
                <label key={option.id} className={`service-radio-card${pricingMode === option.id ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="pricingMode"
                    checked={pricingMode === option.id}
                    onChange={() => applyPricingMode(option.id)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <em>{option.hint}</em>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {pricingMode === 'from' || pricingMode === 'fixed' ? (
            <label>
              <FieldLabel required language={catalogLanguage}>
                {pricingMode === 'fixed' ? (sq ? 'Çmimi (€)' : 'Price (€)') : (sq ? 'Çmimi nga (€)' : 'Price from (€)')}
              </FieldLabel>
              <input
                type="number"
                min={0}
                step="1"
                value={priceFrom}
                required
                onChange={(e) => {
                  const value = e.target.value
                  setPriceFrom(value)
                  if (pricingMode === 'fixed') setPriceTo(value)
                }}
                placeholder={sq ? 'p.sh. 50' : 'e.g. 50'}
              />
              <FieldHint>
                {pricingMode === 'fixed'
                  ? (sq ? 'Shuma që paguan klienti për këtë shërbim.' : 'The amount the client pays for this service.')
                  : (sq ? 'Çmimi minimal; mund të jetë më i lartë sipas rastit.' : 'Minimum price; it may be higher depending on the case.')}
              </FieldHint>
            </label>
          ) : null}

          {pricingMode === 'range' ? (
            <>
              <label>
                <FieldLabel required language={catalogLanguage}>{sq ? 'Çmimi nga (€)' : 'Price from (€)'}</FieldLabel>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={priceFrom}
                  required
                  onChange={(e) => setPriceFrom(e.target.value)}
                  placeholder={sq ? 'p.sh. 40' : 'e.g. 40'}
                />
              </label>
              <label>
                <FieldLabel required language={catalogLanguage}>{sq ? 'Çmimi deri (€)' : 'Price to (€)'}</FieldLabel>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={priceTo}
                  required
                  onChange={(e) => setPriceTo(e.target.value)}
                  placeholder={sq ? 'p.sh. 120' : 'e.g. 120'}
                />
                <FieldHint>{sq ? 'Duhet të jetë ≥ çmimit “nga”.' : 'Must be ≥ the “from” price.'}</FieldHint>
              </label>
            </>
          ) : null}

          {pricingMode === 'agreement' ? (
            <p className="muted full">
              {sq
                ? 'Nuk do të shfaqet shumë në euro. Klienti do të kontaktojë për ofertë.'
                : 'No euro amount will be shown. Clients will contact you for a quote.'}
            </p>
          ) : null}
        </FormSection>

        <FormSection
          title={sq ? `${section(5)}. Disponueshmëria` : `${section(5)}. Availability`}
          description={sq
            ? 'Si i pret klientët për takim ose punë. Nëse zgjedh orare fikse, hap slotet te Disponueshmëria.'
            : 'How clients book time with you. If you choose fixed slots, open them under Availability.'}
        >
          <fieldset className="full checkbox-fieldset">
            <legend>
              <FieldLabel required language={catalogLanguage}>{sq ? 'Si rezervojnë klientët' : 'How clients book'}</FieldLabel>
            </legend>
            <div className="service-radio-list">
              {availabilityOptions.map((option) => {
                const help = availabilityHelp[option.value] || availabilityHelp[option.id]
                return (
                  <label
                    key={option.id}
                    className={`service-radio-card${availabilityMode === option.value ? ' is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="availabilityMode"
                      checked={availabilityMode === option.value}
                      onChange={() => setAvailabilityMode(option.value)}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      {help ? <em>{help[catalogLanguage] || help.sq}</em> : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          {isSlotsAvailability ? (
            <p className="full service-inline-note">
              {sq ? 'Hap oraret e lira te ' : 'Open your free slots under '}
              <Link to={availabilityPath}>{sq ? 'Disponueshmëria' : 'Availability'}</Link>
              {sq ? ', përndryshe klientët nuk kanë termine për të zgjedhur.' : ', otherwise clients will have no slots to choose.'}
            </p>
          ) : null}
        </FormSection>

        <FormSection
          title={sq
            ? `${section(6)}. ${isCompany && offerOwner === 'company' ? 'Punët e këtij shërbimi' : 'Punët dhe portofoli'}`
            : `${section(6)}. ${isCompany && offerOwner === 'company' ? 'Work for this service' : 'Work and portfolio'}`}
          description={
            isCompany && offerOwner === 'company'
              ? (sq
                ? 'Shto vetëm materiale specifike për këtë shërbim. Informacioni i kompanisë merret automatikisht nga profili i kompanisë.'
                : 'Add only materials specific to this service. Company information comes automatically from the company profile.')
              : (sq
                ? 'Shto vetëm materiale të lidhura me këtë shërbim. Përvoja, kualifikimet dhe certifikimet merren nga profili i ekspertit.'
                : 'Add only materials related to this service. Experience, qualifications, and certifications come from the expert profile.')
          }
        >
          {isCompany && offerOwner === 'company' ? (
            <p className="full service-inline-note">
              {sq ? 'Emri, përshkrimi dhe detajet e kompanisë shfaqen automatikisht nga ' : 'Company name, description, and details are shown automatically from '}
              <Link to={profilePath}>{sq ? 'profili i kompanisë' : 'the company profile'}</Link>
              {sq ? '.' : '.'}
            </p>
          ) : (
            <p className="full service-inline-note">
              {sq
                ? 'Vitet e përvojës, përvoja profesionale, kualifikimet, licencat/certifikimet dhe statusi i verifikimit shfaqen automatikisht nga '
                : 'Years of experience, professional background, qualifications, licenses/certifications, and verification status are shown automatically from '}
              <Link to={profilePath}>
                {sq ? 'profili i ekspertit' : 'the expert profile'}
              </Link>
              {sq ? '.' : '.'}
            </p>
          )}

          <div className="full service-photo-picker">
            <FieldLabel optional language={catalogLanguage}>
              {sq ? `Foto të punës (deri ${MAX_SERVICE_PHOTOS})` : `Work photos (up to ${MAX_SERVICE_PHOTOS})`}
            </FieldLabel>
            <FieldHint>
              {sq
                ? `Shembuj vizualë për këtë shërbim. ${IMAGE_ACCEPT_HINT}. Opsionale.`
                : `Visual samples for this service. ${IMAGE_ACCEPT_HINT}. Optional.`}
            </FieldHint>
            <div className="service-photo-grid">
              {photos.map((url) => (
                <div key={url} className="service-photo-tile">
                  <img src={mediaUrl(url)} alt="" />
                  <button
                    type="button"
                    className="service-photo-remove"
                    aria-label={sq ? 'Hiq foton' : 'Remove photo'}
                    onClick={() => setPhotos((prev) => prev.filter((item) => item !== url))}
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
          </div>

          <label className="full">
            <FieldLabel optional language={catalogLanguage}>{sq ? 'Portfolio URL' : 'Portfolio URL'}</FieldLabel>
            <input
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              placeholder="https://..."
            />
            <FieldHint>
              {sq
                ? 'Linku i portofolit ose faqes me punë të ngjashme me këtë shërbim.'
                : 'Link to a portfolio or page with work similar to this service.'}
            </FieldHint>
          </label>

          <label className="full">
            <FieldLabel optional language={catalogLanguage}>
              {sq ? 'Shembuj pune / projekte të ngjashme' : 'Work samples / similar projects'}
            </FieldLabel>
            <textarea
              value={workSamples}
              rows={3}
              onChange={(e) => setWorkSamples(e.target.value)}
              placeholder={
                isCompany && offerOwner === 'company'
                  ? (sq
                    ? 'Përshkruaj shkurt projekte ose rezultate të ngjashme me këtë ofertë.'
                    : 'Briefly describe projects or results similar to this offer.')
                  : (sq
                    ? 'Përshkruaj shkurt projekte ose rezultate të ngjashme me këtë ofertë (jo CV-në e plotë).'
                    : 'Briefly describe projects or results similar to this offer (not your full CV).')
              }
            />
            <FieldHint>
              {isCompany && offerOwner === 'company'
                ? (sq
                  ? 'Vetëm shembuj për këtë shërbim.'
                  : 'Only samples for this service.')
                : (sq
                  ? 'Vetëm shembuj për këtë shërbim. CV-ja dhe certifikimet qëndrojnë te profili.'
                  : 'Only samples for this service. CV and certifications stay on the profile.')}
            </FieldHint>
          </label>
        </FormSection>

        {showCategoryFields ? (
          <FormSection
            title={sq ? `${section(7)}. Detaje sipas kategorisë` : `${section(7)}. Category-specific details`}
            description={sq
              ? `Fusha shtesë për “${catalogLabel(selectedCategory!, catalogLanguage)}”. Plotësoji sipas kërkesës.`
              : `Extra fields for “${catalogLabel(selectedCategory!, catalogLanguage)}”. Fill them as required.`}
          >
            <ExtensionFieldsForm
              fields={extensionFields}
              values={extensionValues}
              language={catalogLanguage}
              catalogOptions={catalogOptions}
              onChange={(key, value) => setExtensionValues((previous) => ({ ...previous, [key]: value }))}
            />
          </FormSection>
        ) : null}

        {guidelines ? <p className="muted full service-guidelines">{guidelines}</p> : null}

        {error ? <p className="error full">{error}</p> : null}

        <div className="full form-actions">
          <button type="submit" disabled={submitting || uploadingPhoto}>
            {submitting
              ? editingId
                ? (sq ? 'Duke ruajtur...' : 'Saving...')
                : (sq ? 'Duke publikuar...' : 'Publishing...')
              : editingId
                ? (sq ? 'Ruaj ndryshimet' : 'Save changes')
                : (sq ? 'Publiko shërbimin' : 'Publish service')}
          </button>
          {editingId ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                resetForm()
                setError('')
              }}
            >
              {sq ? 'Anulo' : 'Cancel'}
            </button>
          ) : null}
        </div>
      </form>

      <div className="services-list">
        <h3>{sq ? 'Shërbimet e mia' : 'My services'}</h3>
        {loading ? <p className="muted">{sq ? 'Duke u ngarkuar...' : 'Loading...'}</p> : null}
        {!loading && services.length === 0 ? (
          <p className="muted">{sq ? 'Nuk ke publikuar ende asnjë shërbim.' : 'No published services yet.'}</p>
        ) : null}
        <ul>
          {services.map((service) => (
            <li key={service.id} className={editingId === service.id ? 'is-editing' : undefined}>
              <strong>{service.title}</strong>
              <span>
                {service.providerName ? `${service.providerName} · ` : ''}
                {service.categoryLabel || service.category} · {service.subcategory} · {service.location}
                {service.priceFrom != null ? ` · nga €${service.priceFrom}` : ''}
                {service.details?.priceTo != null ? `–€${service.details.priceTo}` : ''}
              </span>
              {isCompany && service.responsibleExpert ? (
                <span className="muted">
                  {sq ? 'Eksperti përgjegjës' : 'Responsible expert'}: {service.responsibleExpert.name}
                </span>
              ) : null}
              {service.details?.deliveryModes?.length ? <span>{service.details.deliveryModes.join(' · ')}</span> : null}
              {service.details?.supportLanguages?.length ? <span>{service.details.supportLanguages.join(' · ')}</span> : null}
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
                  {sq ? 'Shiko' : 'View'}
                </Link>
                <button type="button" className="ghost" onClick={() => startEdit(service)}>
                  {sq ? 'Ndrysho' : 'Edit'}
                </button>
                <button
                  type="button"
                  className="ghost danger-ghost"
                  disabled={deletingId === service.id}
                  onClick={() => void onDelete(service.id)}
                >
                  {deletingId === service.id
                    ? (sq ? 'Duke fshirë...' : 'Deleting...')
                    : (sq ? 'Fshi' : 'Delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
