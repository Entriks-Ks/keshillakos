import KeshillaPagination from '../components/KeshillaPagination'
import { fetchMyPlan } from '../api/plans'
import { usePagination } from '../hooks/usePagination'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button, buttonVariants, Card, Chip, ProgressBar, toast } from '@heroui/react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  Eye,
  Info,
  Languages,
  MapPin,
  Monitor,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  Wallet,
} from 'lucide-react'
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
import ExtensionFieldsForm, { categorySpecificFields, fieldLabel, optionLabel } from '../components/ExtensionFieldsForm'
import ConfirmActionDialog from '../components/ConfirmActionDialog'
import LocationSelector from '../components/LocationSelector'
import { useCatalogOptions } from '../hooks/useCatalogOptions'
import { getErrorMessage } from '../utils/errors'
import { servicePath } from '../utils/publicPaths'
import { formatServicePrice } from '../utils/serviceDiscovery'
import { RowsSkeleton, SectionHead } from './OverviewParts'
import './UserRequests.css'
import './DashboardSections.css'

type UiLang = 'sq' | 'en' | 'de'

function L(language: UiLang, sq: string, en: string, de: string) {
  if (language === 'de') return de
  return language === 'en' ? en : sq
}

type PricingMode = 'agreement' | 'from' | 'fixed' | 'range'
type OfferOwner = 'company' | 'expert'

function currentCatalogLanguage(): 'sq' | 'en' {
  const language = document.documentElement.lang.toLowerCase()
  return language.startsWith('sq') ? 'sq' : 'en'
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
  language: UiLang
}) {
  return (
    <span className="service-field-label">
      <span>{children}</span>
      {required ? (
        <span className="service-field-badge is-required" title={L(language, 'E detyrueshme', 'Required', 'Pflicht')}>
          {L(language, 'E detyrueshme', 'Required', 'Pflicht')}
        </span>
      ) : null}
      {optional ? (
        <span className="service-field-badge is-optional">
          {L(language, 'Opsionale', 'Optional', 'Optional')}
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

const REVIEW_STEP = 4

/** Matches the native number-input rules the form relied on: min 0, step 1. */
function isWholeAmount(value: string) {
  const amount = Number(value)
  return value.trim() !== '' && Number.isInteger(amount) && amount >= 0
}

function isValidUrl(value: string) {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function WizardStepper({
  labels,
  current,
  maxReachable,
  onSelect,
  language,
}: {
  labels: string[]
  current: number
  maxReachable: number
  onSelect: (index: number) => void
  language: UiLang
}) {
  const next = labels[current + 1]
  return (
    <nav className="ds-stepper" aria-label={L(language, 'Hapat e formularit', 'Form steps', 'Formularschritte')}>
      <ol className="ds-stepper-list">
        {labels.map((label, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo'
          return (
            <li key={label} className={`ds-step is-${state}`}>
              <button
                type="button"
                className="ds-step-btn"
                disabled={index === current || index > maxReachable}
                aria-current={index === current ? 'step' : undefined}
                onClick={() => onSelect(index)}
              >
                <span className="ds-step-dot" aria-hidden>
                  {state === 'done' ? <Check size={14} strokeWidth={2.5} /> : index + 1}
                </span>
                <span className="ds-step-label">{label}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className="ds-stepper-compact">
        <div className="ds-stepper-compact-top">
          <strong>
            {L(language, `Hapi ${current + 1} nga ${labels.length}`, `Step ${current + 1} of ${labels.length}`, `Schritt ${current + 1} von ${labels.length}`)}
          </strong>
          {next ? <span>{L(language, `Tjetër: ${next}`, `Next: ${next}`, `Weiter: ${next}`)}</span> : null}
        </div>
        <ProgressBar
          aria-label={L(language, 'Përparimi i formularit', 'Form progress', 'Formularfortschritt')}
          value={((current + 1) / labels.length) * 100}
          className="uo-progress"
        >
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      </div>
    </nav>
  )
}

function ReviewSection({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string
  onEdit: () => void
  editLabel: string
  children: ReactNode
}) {
  return (
    <section className="ds-review-section">
      <header className="ds-review-head">
        <h4>{title}</h4>
        <Button size="sm" variant="ghost" onPress={onEdit}>
          <Pencil size={14} aria-hidden />
          {editLabel}
        </Button>
      </header>
      <dl className="ds-review-list">{children}</dl>
    </section>
  )
}

function ReviewItem({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`ds-review-item${wide ? ' is-wide' : ''}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export default function ProviderServicesPanel() {
  const formRef = useRef<HTMLFormElement>(null)
  const editingCatalogRef = useRef<{ categoryId?: string; subcategoryId?: string; subcategory?: string } | null>(null)
  const routeLocation = useLocation()
  const isCompany = routeLocation.pathname.includes('/dashboard/company')
  const [plan, setPlan] = useState<'basic' | 'pro' | null>(null)
  useEffect(() => {
    let active = true
    void fetchMyPlan(isCompany ? 'company' : 'provider')
      .then((mine) => { if (active) setPlan(mine.plan) })
      .catch(() => { if (active) setPlan(null) })
    return () => { active = false }
  }, [isCompany])
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
  const { page, setPage, pagination, receivePagination } = usePagination()
  const [listRevision, setListRevision] = useState(0)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [catalogLanguage, setCatalogLanguage] = useState(currentCatalogLanguage)
  const [uiLang, setUiLang] = useState<UiLang>(() => (document.documentElement.lang || 'sq').toLowerCase().startsWith('de') ? 'de' : (document.documentElement.lang || 'sq').toLowerCase().startsWith('en') ? 'en' : 'sq')
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
  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [offerOwner, setOfferOwner] = useState<OfferOwner>('company')
  const [businessId, setBusinessId] = useState('')
  const [businessName, setBusinessName] = useState('')
  const teamPaging = usePagination()
  const [teamExperts, setTeamExperts] = useState<TeamPerson[]>([])
  const [expertProviderId, setExpertProviderId] = useState('')
  const [responsibleExpertId, setResponsibleExpertId] = useState('')
  const [companyContextLoading, setCompanyContextLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [step, setStep] = useState(0)
  const wizardRef = useRef<HTMLDivElement>(null)

  const showForm = formOpen || editingId !== null || (!loading && services.length === 0)
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

  const availabilityHelp: Record<string, { sq: string; en: string; de: string }> = {
    request: {
      sq: 'Klienti dërgon kërkesë; ti përgjigjesh kur je i lirë.',
      en: 'Clients send a request; you reply when available.',
      de: 'Der Kunde sendet eine Anfrage; du antwortest, wenn du Zeit hast.',
    },
    by_arrangement: {
      sq: 'Koha e takimit caktohet së bashku pas kontaktit.',
      en: 'Meeting time is agreed together after contact.',
      de: 'Die Terminzeit wird nach dem Kontakt gemeinsam vereinbart.',
    },
    slots: {
      sq: 'Klienti zgjedh nga oraret e lira që ke hapur te Disponueshmëria.',
      en: 'Clients pick from open slots you manage under Availability.',
      de: 'Der Kunde wählt aus freien Terminen, die du unter Verfügbarkeit öffnest.',
    },
  }

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setCatalogLanguage(currentCatalogLanguage())
      const lang = (document.documentElement.lang || 'sq').toLowerCase()
      setUiLang(lang.startsWith('de') ? 'de' : lang.startsWith('en') ? 'en' : 'sq')
    })
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
        const team = await fetchBusinessTeam(business._id, { page: teamPaging.page, limit: 20 })
        if (cancelled) return
        const people = [...team.owners, ...team.members]
        const unique = new Map<string, TeamPerson>()
        for (const person of people) unique.set(person.id, person)
        if (team.pagination) teamPaging.receivePagination(team.pagination)
        setTeamExperts((previous) => [...unique.values(), ...previous.filter((person) => !unique.has(person.id) && (person.id === responsibleExpertId || person.providerProfileId === expertProviderId))])
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
  }, [isCompany, teamPaging.page])

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
    setLoading(true)
    fetchMyServices({ page, limit: 20 })
      .then((items) => {
        if (!cancelled) { setServices(items); receivePagination(items.pagination) }
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
  }, [page, listRevision])

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
    setStep(0)
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
    setStep(0)
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
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function openNewForm() {
    if (editingId) resetForm()
    setError('')
    setFormOpen(true)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function closeForm() {
    resetForm()
    setError('')
    setFormOpen(false)
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
      toast.success(L(uiLang, 'Fotoja u ngarkua.', 'Photo uploaded.', 'Foto hochgeladen.'))
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
      setError(L(uiLang, 'Zgjidh kategorinë dhe nënkategorinë.', 'Choose a category and subcategory.', 'Wähle eine Kategorie und eine Unterkategorie.'))
      return
    }
    if (!location) {
      setError(L(uiLang, 'Zgjidh lokacionin nga lista e qyteteve.', 'Choose a location from the city list.', 'Wähle einen Ort aus der Städteliste.'))
      return
    }
    if (pricingMode === 'from' && !priceFrom.trim()) {
      setError(L(uiLang, 'Shkruaj çmimin fillestar ose zgjidh “Me marrëveshje”.', 'Enter a starting price or choose “By agreement”.', 'Gib einen Startpreis ein oder wähle „Nach Vereinbarung“.'))
      return
    }
    if (pricingMode === 'fixed' && !priceFrom.trim()) {
      setError(L(uiLang, 'Shkruaj çmimin fiks në euro.', 'Enter the fixed price in euros.', 'Gib den Festpreis in Euro ein.'))
      return
    }
    if (pricingMode === 'range') {
      if (!priceFrom.trim() || !priceTo.trim()) {
        setError(L(uiLang, 'Plotëso çmimin nga dhe deri.', 'Fill in both the from and to prices.', 'Fülle den Preis von und bis aus.'))
        return
      }
      if (Number(priceTo) < Number(priceFrom)) {
        setError(L(uiLang, 'Çmimi “deri” duhet të jetë më i madh ose i barabartë me “nga”.', '“Price to” must be greater than or equal to “price from”.', '„Preis bis“ muss größer oder gleich „Preis von“ sein.'))
        return
      }
    }
    if (isCompany) {
      if (!businessId) {
        setError(L(uiLang, 'Krijo kompaninë para se të ofrosh shërbime.', 'Create the company before offering services.', 'Lege das Unternehmen an, bevor du Dienste anbietest.'))
        return
      }
      if (offerOwner === 'expert' && !expertProviderId) {
        setError(L(uiLang, 'Zgjidh ekspertin e ekipit që e ofron shërbimin.', 'Choose the team expert who offers this service.', 'Wähle den Experten im Team, der diesen Dienst anbietet.'))
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
      location: locationLabel(location, catalogLanguage),
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
        setFormOpen(false)
        toast.success(L(uiLang, 'Shërbimi u përditësua.', 'Service updated.', 'Dienst aktualisiert.'))
      } else {
        await createService(payload)
        setPage(1)
        setListRevision((value) => value + 1)
        resetForm()
        setFormOpen(false)
        toast.success(L(uiLang, 'Shërbimi u publikua dhe shfaqet te ofertat.', 'Service published and visible in offers.', 'Dienst veröffentlicht und in den Angeboten sichtbar.'))
      }
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete() {
    const id = deleteTarget?.id
    if (!id || deletingId) return
    setError('')
    setDeletingId(id)
    try {
      await deleteService(id)
      setListRevision((value) => value + 1)
      if (editingId === id) resetForm()
      toast.success(L(uiLang, 'Shërbimi u fshi.', 'Service deleted.', 'Dienst gelöscht.'))
      setDeleteTarget(null)
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

  const companyOwned = isCompany && offerOwner === 'company'
  const stepLabels = uiLang === 'de'
    ? ['Grunddaten', 'Beschreibung', 'Dienstdetails', 'Fotos und Portfolio', 'Überblick']
    : uiLang === 'en'
      ? ['Basic information', 'Description', 'Service details', 'Photos & portfolio', 'Review']
      : ['Informacioni bazë', 'Përshkrimi', 'Detajet e shërbimit', 'Foto dhe portofol', 'Përmbledhje']
  const stepIntros = uiLang === 'de'
    ? [
      'Name des Dienstes und die Kategorie, in der Kunden ihn finden.',
      'Erkläre, was du anbietest, für wen es ist und was enthalten ist.',
      'Wie der Dienst erbracht wird, wo, zu welchem Preis und wie Kunden buchen.',
      'Optional: Arbeitsbeispiele, die das Angebot überzeugender machen.',
      'Prüfe alles vor der Veröffentlichung. Du kannst zu jedem Schritt zurück.',
    ]
    : uiLang === 'en'
      ? [
      'The service name and the category where clients will find it.',
      'Explain what you offer, who it is for and what is included.',
      'How the service is delivered, where, at what price and how clients book.',
      'Optional: work samples that make the offer more convincing.',
      'Check everything before publishing. You can return to any step to change it.',
    ]
      : [
      'Emri i shërbimit dhe kategoria ku do ta gjejnë klientët.',
      'Shpjego çfarë ofron, për kë është dhe çfarë përfshihet.',
      'Si ofrohet shërbimi, ku, me çfarë çmimi dhe si rezervojnë klientët.',
      'Opsionale: shembuj pune që e bëjnë ofertën më bindëse.',
      'Kontrollo të dhënat para publikimit. Mund të kthehesh te çdo hap për ta ndryshuar.',
    ]

  const basicIssues: string[] = []
  if (isCompany && !businessId) {
    basicIssues.push(companyContextLoading
      ? (L(uiLang, 'Duke ngarkuar kompaninë…', 'Loading the company…', 'Unternehmen wird geladen…'))
      : (L(uiLang, 'Krijo kompaninë para se të ofrosh shërbime.', 'Create the company before offering services.', 'Lege das Unternehmen an, bevor du Dienste anbietest.')))
  }
  if (isCompany && offerOwner === 'expert' && !expertProviderId) {
    basicIssues.push(L(uiLang, 'Zgjidh ekspertin e ekipit që e ofron shërbimin.', 'Choose the team expert who offers this service.', 'Wähle den Experten im Team, der diesen Dienst anbietet.'))
  }
  if (!title.trim()) basicIssues.push(L(uiLang, 'Shkruaj titullin e shërbimit.', 'Enter the service title.', 'Gib den Diensttitel ein.'))
  if (!categoryId) basicIssues.push(L(uiLang, 'Zgjidh kategorinë.', 'Choose a category.', 'Wähle eine Kategorie.'))
  if (categoryId && (!subcategoryId || !selectedSubcategory)) {
    basicIssues.push(subcategoriesLoading
      ? (L(uiLang, 'Duke ngarkuar nënkategoritë…', 'Loading subcategories…', 'Unterkategorien werden geladen…'))
      : (L(uiLang, 'Zgjidh nënkategorinë.', 'Choose a subcategory.', 'Wähle eine Unterkategorie.')))
  }

  const descriptionIssues: string[] = []
  if (!description.trim()) descriptionIssues.push(L(uiLang, 'Shkruaj përshkrimin e shërbimit.', 'Enter the service description.', 'Gib die Dienstbeschreibung ein.'))

  const detailIssues: string[] = []
  if (!location) detailIssues.push(L(uiLang, 'Zgjidh lokacionin nga lista e qyteteve.', 'Choose a location from the city list.', 'Wähle einen Ort aus der Städteliste.'))
  if (pricingMode === 'from' && !priceFrom.trim()) {
    detailIssues.push(L(uiLang, 'Shkruaj çmimin fillestar ose zgjidh “Me marrëveshje”.', 'Enter a starting price or choose “By agreement”.', 'Gib einen Startpreis ein oder wähle „Nach Vereinbarung“.'))
  }
  if (pricingMode === 'fixed' && !priceFrom.trim()) {
    detailIssues.push(L(uiLang, 'Shkruaj çmimin fiks në euro.', 'Enter the fixed price in euros.', 'Gib den Festpreis in Euro ein.'))
  }
  if (pricingMode === 'range') {
    if (!priceFrom.trim() || !priceTo.trim()) {
      detailIssues.push(L(uiLang, 'Plotëso çmimin nga dhe deri.', 'Fill in both the from and to prices.', 'Fülle den Preis von und bis aus.'))
    } else if (Number(priceTo) < Number(priceFrom)) {
      detailIssues.push(L(uiLang, 'Çmimi “deri” duhet të jetë më i madh ose i barabartë me “nga”.', '“Price to” must be greater than or equal to “price from”.', '„Preis bis“ muss größer oder gleich „Preis von“ sein.'))
    }
  }
  if (
    pricingMode !== 'agreement'
    && [priceFrom, pricingMode === 'range' ? priceTo : ''].some((value) => value.trim() && !isWholeAmount(value))
  ) {
    detailIssues.push(L(uiLang, 'Çmimi duhet të jetë numër i plotë, 0 ose më shumë.', 'The price must be a whole number, 0 or more.', 'Der Preis muss eine ganze Zahl ab 0 sein.'))
  }
  if (showCategoryFields) {
    for (const field of categorySpecificFields(extensionFields)) {
      const label = fieldLabel(field, catalogLanguage)
      const value = extensionValues[field.key]
      const required = Boolean(field.required || field.mustBeTrue)
      if (field.type === 'boolean') {
        if (required && !value) detailIssues.push(L(uiLang, `Konfirmo “${label}”.`, `Confirm “${label}”.`, `Bestätige „${label}“.`))
        continue
      }
      if (field.type === 'stringArray' && field.allowedValues?.length) continue
      if (required && (value == null || String(value).trim() === '')) {
        detailIssues.push(L(uiLang, `Plotëso “${label}”.`, `Fill in “${label}”.`, `Fülle „${label}“ aus.`))
      } else if (field.type === 'number' && value != null && value !== '' && !(Number.isInteger(value) && Number(value) >= 0)) {
        detailIssues.push(L(uiLang, `“${label}” duhet të jetë numër i plotë, 0 ose më shumë.`, `“${label}” must be a whole number, 0 or more.`, `„${label}“ muss eine ganze Zahl ab 0 sein.`))
      }
    }
  }

  const mediaIssues: string[] = []
  if (uploadingPhoto) mediaIssues.push(L(uiLang, 'Prit sa të ngarkohet fotoja.', 'Wait for the photo to finish uploading.', 'Warte, bis das Foto hochgeladen ist.'))
  if (portfolioUrl.trim() && !isValidUrl(portfolioUrl.trim())) {
    mediaIssues.push(L(uiLang, 'Shkruaj një URL të vlefshme, p.sh. https://…', 'Enter a valid URL, e.g. https://…', 'Gib eine gültige URL ein, z. B. https://…'))
  }

  const stepIssues = [basicIssues, descriptionIssues, detailIssues, mediaIssues, []]
  const firstInvalidStep = stepIssues.findIndex((issues) => issues.length > 0)
  const maxReachableStep = firstInvalidStep === -1 ? REVIEW_STEP : firstInvalidStep
  const currentIssues = stepIssues[step]

  function goToStep(index: number) {
    setStep(index)
    requestAnimationFrame(() => {
      const top = wizardRef.current?.getBoundingClientRect().top ?? 0
      if (top < 0) wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function goNext() {
    if (currentIssues.length || step >= REVIEW_STEP) return
    goToStep(step + 1)
  }

  function onFormSubmit(e: FormEvent) {
    if (step < REVIEW_STEP) {
      e.preventDefault()
      goNext()
      return
    }
    void onSubmit(e)
  }

  const notFilled = <span className="ds-review-empty">{L(uiLang, 'Nuk është plotësuar', 'Not provided', 'Nicht angegeben')}</span>
  const reviewPrice =
    pricingMode === 'agreement'
      ? (L(uiLang, 'Me marrëveshje', 'By agreement', 'Nach Vereinbarung'))
      : pricingMode === 'fixed'
        ? `€${priceFrom}`
        : pricingMode === 'range'
          ? `€${priceFrom} – €${priceTo}`
          : (L(uiLang, `nga €${priceFrom}`, `from €${priceFrom}`, `ab €${priceFrom}`))
  const reviewModes = deliveryModes.map(
    (mode) => deliveryModeOptions.find((item) => item.value === mode)?.label || mode,
  )
  const reviewLanguages = supportLanguages.map(
    (code) => languages.find((item) => item.value === code)?.label || code,
  )
  const reviewAvailability = availabilityOptions.find((item) => item.value === availabilityMode)?.label || availabilityMode
  const selectedExpert = expertsWithProfiles.find((person) => person.providerProfileId === expertProviderId)
  const responsibleExpert = teamExperts.find((person) => person.id === responsibleExpertId)

  function extensionReviewValue(value: unknown) {
    if (typeof value === 'boolean') return value ? (L(uiLang, 'Po', 'Yes', 'Ja')) : (L(uiLang, 'Jo', 'No', 'Nein'))
    if (Array.isArray(value)) {
      return value.length ? value.map((item) => optionLabel(String(item), catalogOptions, catalogLanguage)).join(', ') : notFilled
    }
    if (value == null || String(value).trim() === '') return notFilled
    return optionLabel(String(value), catalogOptions, catalogLanguage)
  }

  return (
    <section className="uo ds">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>{L(uiLang, 'Shërbimet', 'Services', 'Dienste')}</h1>
          <p>
            {isCompany
              ? (L(uiLang, 'Menaxho shërbimet që kompania dhe ekspertët e saj ofrojnë. Shërbimet aktive shfaqen te ofertat publike.', 'Manage the services your company and its experts offer. Active services appear in public offers.', 'Verwalte die Dienste, die dein Unternehmen und seine Experten anbieten. Aktive Dienste erscheinen in den öffentlichen Angeboten.'))
              : (L(uiLang, 'Menaxho shërbimet që ofron. Shërbimet aktive shfaqen te ofertat publike dhe në profilin tënd.', 'Manage the services you offer. Active services appear in public offers and on your profile.', 'Verwalte die Dienste, die du anbietest. Aktive Dienste erscheinen in den öffentlichen Angeboten und in deinem Profil.'))}
          </p>
          {plan === 'basic' ? (
            <p>
              <Link to={isCompany ? '/dashboard/company/plans' : '/dashboard/provider/plans'}>
                {L(uiLang, 'Shërbimet publikohen vetëm me planin Pro.', 'Services are published only on the Pro plan.', 'Dienste werden nur mit dem Pro-Tarif veröffentlicht.')}
              </Link>
            </p>
          ) : null}
        </div>
        {services.length > 0 ? (
          <Button variant="primary" className="uo-primary" onPress={openNewForm}>
            <Plus size={16} aria-hidden />
            {L(uiLang, 'Shto shërbim', 'Add service', 'Dienst hinzufügen')}
          </Button>
        ) : null}
      </header>

      {loading ? (
        <Card className="uo-card">
          <SectionHead title={L(uiLang, 'Shërbimet e mia', 'My services', 'Meine Dienste')} />
          <Card.Content className="uo-card-body">
            <RowsSkeleton rows={3} />
          </Card.Content>
        </Card>
      ) : services.length === 0 ? (
        <Card className="uo-card ur-empty">
          <span className="ur-empty-icon" aria-hidden>
            <Briefcase size={22} />
          </span>
          <h2>{L(uiLang, 'Ende nuk ke publikuar asnjë shërbim', 'No services published yet', 'Noch keine Dienste veröffentlicht')}</h2>
          <p>
            {L(uiLang, 'Krijo shërbimin e parë më poshtë. Pasi ta publikosh, klientët mund ta gjejnë te ofertat dhe të të dërgojnë kërkesë.', 'Create your first service below. Once published, clients can find it in offers and send you a request.', 'Erstelle unten deinen ersten Dienst. Nach der Veröffentlichung finden Kunden ihn in den Angeboten und können eine Anfrage senden.')}
          </p>
          <div className="ur-empty-actions">
            <Button variant="primary" onPress={openNewForm}>
              <Plus size={16} aria-hidden />
              {L(uiLang, 'Krijo shërbimin e parë', 'Create your first service', 'Erstelle deinen ersten Dienst')}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="uo-card ur-card">
          <SectionHead
            title={L(uiLang, 'Shërbimet e mia', 'My services', 'Meine Dienste')}
            meta={<span className="uo-card-meta">{pagination.total}</span>}
          />
          <ul className="ur-list ds-divided">
            {services.map((service) => {
              const photo = service.details?.photos?.[0]
              const price = formatServicePrice(service)
              const modes = (service.details?.deliveryModes || []).map(
                (mode) => deliveryModeOptions.find((item) => item.value === mode || item.id === mode)?.label || mode,
              )
              const langs = (service.details?.supportLanguages || []).map(
                (code) => languages.find((item) => item.value === code || item.id === code)?.label || code,
              )
              const category = [service.categoryLabel || service.category, service.subcategory].filter(Boolean).join(' › ')
              const editing = editingId === service.id
              return (
                <li key={service.id} className={`ds-service${editing ? ' is-editing' : ''}${photo ? ' has-photo' : ''}`}>
                  {photo ? <img className="ds-service-photo" src={mediaUrl(photo)} alt="" loading="lazy" /> : null}
                  <div className="ur-main">
                    <div className="ur-top">
                      <div className="ur-titles">
                        <h3 className="ur-title">{service.title}</h3>
                        {category ? <p className="ds-service-cat">{category}</p> : null}
                      </div>
                      <div className="ur-chips">
                        {editing ? (
                          <Chip size="sm" variant="soft" color="accent">
                            <Chip.Label>{L(uiLang, 'Në ndryshim', 'Editing', 'Bearbeitung')}</Chip.Label>
                          </Chip>
                        ) : null}
                        <Chip size="sm" variant="soft" color={service.active ? 'success' : 'default'}>
                          <Chip.Label>{service.active ? (L(uiLang, 'Aktiv', 'Active', 'Aktiv')) : (L(uiLang, 'Joaktiv', 'Inactive', 'Inaktiv'))}</Chip.Label>
                        </Chip>
                      </div>
                    </div>

                    {service.description ? <p className="ur-message ds-clamp-2">{service.description}</p> : null}

                    <ul className="ur-facts">
                      {price ? (
                        <li className="is-strong">
                          <Wallet size={14} aria-hidden />
                          {price}
                        </li>
                      ) : null}
                      {service.location ? (
                        <li>
                          <MapPin size={14} aria-hidden />
                          {service.location}
                        </li>
                      ) : null}
                      {modes.length ? (
                        <li>
                          <Monitor size={14} aria-hidden />
                          {modes.join(' · ')}
                        </li>
                      ) : null}
                      {langs.length ? (
                        <li>
                          <Languages size={14} aria-hidden />
                          {langs.join(' · ')}
                        </li>
                      ) : null}
                      {isCompany && service.providerName ? (
                        <li>
                          <UserRound size={14} aria-hidden />
                          {service.providerName}
                        </li>
                      ) : null}
                      {isCompany && service.responsibleExpert ? (
                        <li>
                          <UserRound size={14} aria-hidden />
                          {L(uiLang, 'Përgjegjës', 'Responsible', 'Verantwortlich')}: {service.responsibleExpert.name}
                        </li>
                      ) : null}
                    </ul>

                    <div className="ur-actions is-wrap ds-service-actions">
                      <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={servicePath(service)}>
                        <Eye size={14} aria-hidden />
                        {L(uiLang, 'Shiko', 'View', 'Ansehen')}
                      </Link>
                      <Button size="sm" variant="outline" onPress={() => startEdit(service)} isDisabled={editing}>
                        <Pencil size={14} aria-hidden />
                        {L(uiLang, 'Ndrysho', 'Edit', 'Bearbeiten')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ds-danger-btn"
                        isPending={deletingId === service.id}
                        onPress={() => setDeleteTarget(service)}
                      >
                        <Trash2 size={14} aria-hidden />
                        {deletingId === service.id ? (L(uiLang, 'Duke fshirë…', 'Deleting…', 'Löschen…')) : (L(uiLang, 'Fshi', 'Delete', 'Löschen'))}
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <KeshillaPagination pagination={pagination} onPageChange={setPage} isDisabled={loading} />
        </Card>
      )}

      {showForm ? (
      <Card className="uo-card ds-form-card">
        <SectionHead
          title={editingId ? (L(uiLang, 'Ndrysho shërbimin', 'Edit service', 'Dienst bearbeiten')) : (L(uiLang, 'Shto shërbim të ri', 'Add a new service', 'Neuen Dienst hinzufügen'))}
          meta={
            <span className="uo-card-meta">
              {L(uiLang, `Hapi ${step + 1} nga ${stepLabels.length}`, `Step ${step + 1} of ${stepLabels.length}`, `Schritt ${step + 1} von ${stepLabels.length}`)}
            </span>
          }
          action={
            services.length > 0 ? (
              <Button size="sm" variant="ghost" onPress={closeForm} isDisabled={submitting}>
                {L(uiLang, 'Mbyll', 'Close', 'Schließen')}
              </Button>
            ) : null
          }
        />
        <Card.Content className="uo-card-body">
          <div ref={wizardRef} className="ds-wizard">
          <WizardStepper
            labels={stepLabels}
            current={step}
            maxReachable={maxReachableStep}
            onSelect={goToStep}
            language={uiLang}
          />

          <header className="ds-step-head">
            <h3>{stepLabels[step]}</h3>
            <p>{stepIntros[step]}</p>
          </header>

      <form
        id="service-form"
        ref={formRef}
        onSubmit={onFormSubmit}
        noValidate
        className={step < REVIEW_STEP ? 'service-form ds-service-form' : 'ds-review'}
      >
        {step === 0 ? (
          <>
        {isCompany ? (
          <FormSection
            title={L(uiLang, 'Kush e ofron këtë shërbim?', 'Who offers this service?', 'Wer bietet diesen Dienst an?')}
            description={L(uiLang, 'Zgjidh nëse oferta publikohet në emër të kompanisë ose të një eksperti të ekipit. Profili përkatës përdoret për përvojën dhe verifikimin.', 'Choose whether the offer is published under the company or a team expert. The matching profile supplies experience and verification.', 'Wähle, ob das Angebot unter dem Unternehmen oder einem Team-Experten veröffentlicht wird. Das passende Profil liefert Erfahrung und Verifizierung.')}
          >
            <div className="service-radio-list" role="radiogroup" aria-label={L(uiLang, 'Kush e ofron këtë shërbim?', 'Who offers this service?', 'Wer bietet diesen Dienst an?')}>
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
                  <strong>{L(uiLang, 'Kompania', 'Company', 'Unternehmen')}</strong>
                  <em>
                    {L(uiLang, `Publikohet nën ${businessName || 'kompaninë'} dhe përdor profilin e kompanisë.`, `Published under ${businessName || 'the company'} using the company profile.`, `Veröffentlicht unter ${businessName || 'dem Unternehmen'} mit dem Unternehmensprofil.`)}
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
                  <strong>{L(uiLang, 'Ekspert i ekipit', 'Team expert', 'Team-Experte')}</strong>
                  <em>
                    {L(uiLang, 'Publikohet nën ekspertin e zgjedhur dhe përdor profilin e tij.', 'Published under the selected expert using their profile.', 'Veröffentlicht unter dem gewählten Experten mit dessen Profil.')}
                  </em>
                </span>
              </label>
            </div>

            {offerOwner === 'expert' ? (
              <label>
                <FieldLabel required language={uiLang}>{L(uiLang, 'Zgjidh ekspertin', 'Choose expert', 'Experten wählen')}</FieldLabel>
                <select
                  value={expertProviderId}
                  required
                  disabled={Boolean(editingId) || companyContextLoading || expertsWithProfiles.length === 0}
                  onChange={(e) => setExpertProviderId(e.target.value)}
                >
                  {companyContextLoading ? (
                    <option value="">{L(uiLang, 'Duke u ngarkuar...', 'Loading...', 'Laden...')}</option>
                  ) : null}
                  {!companyContextLoading && expertsWithProfiles.length === 0 ? (
                    <option value="">{L(uiLang, 'Nuk ka ekspertë me profil', 'No experts with a profile', 'Keine Experten mit Profil')}</option>
                  ) : null}
                  {expertsWithProfiles.map((person) => (
                    <option key={person.id} value={person.providerProfileId || ''}>
                      {person.name}{person.headline ? ` — ${person.headline}` : ''}
                    </option>
                  ))}
                </select>
                <FieldHint>
                  {L(uiLang, 'Vetëm anëtarët e ekipit me profil eksperti mund të zgjidhen.', 'Only team members with an expert profile can be selected.', 'Nur Teammitglieder mit Expertenprofil können gewählt werden.')}
                </FieldHint>
              </label>
            ) : null}

            {offerOwner === 'company' ? (
              <label>
                <FieldLabel optional language={uiLang}>{L(uiLang, 'Eksperti përgjegjës', 'Responsible expert', 'Verantwortlicher Experte')}</FieldLabel>
                <select
                  value={responsibleExpertId}
                  disabled={companyContextLoading || teamExperts.length === 0}
                  onChange={(e) => setResponsibleExpertId(e.target.value)}
                >
                  <option value="">{L(uiLang, 'Pa caktuar (opsionale)', 'Unassigned (optional)', 'Nicht zugewiesen (optional)')}</option>
                  {teamExperts.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}{person.headline ? ` — ${person.headline}` : ''}
                    </option>
                  ))}
                </select>
                <FieldHint>
                  {L(uiLang, 'Mund ta caktosh tani ose më vonë pasi të krijosh shërbimin. Nuk zëvendëson profilin e kompanisë.', 'Assign now or later after creating the service. This does not replace the company profile.', 'Jetzt oder später nach dem Erstellen zuweisen. Das ersetzt nicht das Unternehmensprofil.')}
                </FieldHint>
              </label>
            ) : null}

            <KeshillaPagination pagination={teamPaging.pagination} onPageChange={teamPaging.setPage} isDisabled={companyContextLoading || Boolean(editingId)} />

            {!businessId && !companyContextLoading ? (
              <FieldHint>
                {uiLang === 'de' ? (
                  <>Noch kein verwaltbares Unternehmen. <Link to="/dashboard/company/create">Unternehmen anlegen</Link>.</>
                ) : uiLang === 'en' ? (
                  <>No manageable company yet. <Link to="/dashboard/company/create">Create the company</Link>.</>
                ) : (
                  <>Nuk ke kompani të menaxhueshme. <Link to="/dashboard/company/create">Krijo kompaninë</Link>.</>
                )}
              </FieldHint>
            ) : null}
          </FormSection>
        ) : null}

        <FormSection
          title={L(uiLang, 'Emri i shërbimit', 'Service name', 'Dienstname')}
          description={L(uiLang, 'Titulli shfaqet te klientët në ofertat publike.', 'The title is shown to clients in public offers.', 'Der Titel wird Kunden in den öffentlichen Angeboten angezeigt.')}
        >
          <label className="full">
            <FieldLabel required language={uiLang}>{L(uiLang, 'Titulli i shërbimit', 'Service title', 'Diensttitel')}</FieldLabel>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder={L(uiLang, 'P.sh. Ndërtim website për biznese të vogla', 'E.g. Website build for small businesses', 'z. B. Website für kleine Unternehmen')}
            />
            <FieldHint>{L(uiLang, 'I shkurtër dhe specifike — jo vetëm emri i kategorisë.', 'Keep it short and specific — not just the category name.', 'Kurz und konkret — nicht nur der Kategoriename.')}</FieldHint>
          </label>
        </FormSection>

        <FormSection
          title={L(uiLang, 'Kategoria e shërbimit', 'Service category', 'Dienstkategorie')}
          description={L(uiLang, 'Zgjidh fushën e përgjithshme, pastaj nënkategorinë konkrete që e përshkruan më mirë ofertën.', 'Pick the general field first, then the specific subcategory that best describes the offer.', 'Wähle zuerst das allgemeine Feld, dann die Unterkategorie, die das Angebot am besten beschreibt.')}
        >
          <label>
            <FieldLabel required language={uiLang}>{L(uiLang, 'Kategoria', 'Category', 'Kategorie')}</FieldLabel>
            <select
              value={categoryId}
              required
              onChange={(e) => {
                setCategoryId(e.target.value)
                setSubcategoryId('')
              }}
            >
              {categories.length === 0 ? <option value="">{L(uiLang, 'Duke u ngarkuar...', 'Loading...', 'Laden...')}</option> : null}
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {catalogLabel(category, catalogLanguage)}
                </option>
              ))}
            </select>
            <FieldHint>{L(uiLang, 'P.sh. IT, Ligj, Marketing.', 'E.g. IT, Law, Marketing.', 'z. B. IT, Recht, Marketing.')}</FieldHint>
          </label>

          <label>
            <FieldLabel required language={uiLang}>{L(uiLang, 'Nënkategoria', 'Subcategory', 'Unterkategorie')}</FieldLabel>
            <select
              value={subcategoryId}
              required
              disabled={!categoryId || subcategoriesLoading || subcategories.length === 0}
              onChange={(e) => setSubcategoryId(e.target.value)}
            >
              {subcategoriesLoading ? <option value="">{L(uiLang, 'Duke u ngarkuar...', 'Loading...', 'Laden...')}</option> : null}
              {!subcategoriesLoading && subcategories.length === 0 ? (
                <option value="">{L(uiLang, 'Nuk ka nënkategori', 'No subcategories', 'Keine Unterkategorien')}</option>
              ) : null}
              {subcategories.map((subcategory) => (
                <option key={subcategory._id} value={subcategory._id}>
                  {catalogLabel(subcategory, catalogLanguage)}
                </option>
              ))}
            </select>
            <FieldHint>
              {selectedCategory
                ? (L(uiLang, `Nënkategoritë për “${catalogLabel(selectedCategory, catalogLanguage)}”.`, `Subcategories for “${catalogLabel(selectedCategory, catalogLanguage)}”.`, `Unterkategorien für „${catalogLabel(selectedCategory, catalogLanguage)}“.`))
                : (L(uiLang, 'Zgjidh kategorinë më parë.', 'Choose a category first.', 'Wähle zuerst eine Kategorie.'))}
            </FieldHint>
          </label>
        </FormSection>

          </>
        ) : null}

        {step === 1 ? (
          <>
        <FormSection
          title={L(uiLang, 'Përshkrimi i ofertës', 'Offer description', 'Angebotsbeschreibung')}
          description={L(uiLang, 'Përshkrimi shfaqet te klientët. Shkruaj qartë çfarë ofron dhe çfarë përfshihet.', 'The description is shown to clients. Be clear about what you offer and what is included.', 'Die Beschreibung sehen die Kunden. Erkläre klar, was du anbietest und was enthalten ist.')}
        >
          <label className="full">
            <FieldLabel required language={uiLang}>{L(uiLang, 'Përshkrimi', 'Description', 'Beschreibung')}</FieldLabel>
            <textarea
              value={description}
              rows={4}
              required
              onChange={(e) => setDescription(e.target.value)}
              placeholder={L(uiLang, 'Çfarë përfshihet, për kë është, sa zgjat dhe çfarë duhet të dije klienti.', 'What is included, who it is for, how long it takes, and what the client should know.', 'Was enthalten ist, für wen es ist, wie lange es dauert und was der Kunde wissen sollte.')}
            />
          </label>
        </FormSection>

        {guidelines ? (
          <div className="full ds-tip">
            <Info size={16} aria-hidden />
            <p>{guidelines}</p>
          </div>
        ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
        <FormSection
          title={L(uiLang, 'Si ofrohet shërbimi', 'How the service is delivered', 'Wie der Dienst erbracht wird')}
          description={L(uiLang, 'Thuaj nëse punon online, fizikisht ose në grup, dhe në cilat gjuhë komunikoni.', 'Say whether you work online, in person, or in groups, and which languages you use.', 'Sag, ob du online, vor Ort oder in Gruppen arbeitest und welche Sprachen du nutzt.')}
        >
          <fieldset className="full checkbox-fieldset">
            <legend>
              <FieldLabel optional language={uiLang}>{L(uiLang, 'Mënyra e ofrimit', 'Delivery mode', 'Erbringungsart')}</FieldLabel>
            </legend>
            <FieldHint>{L(uiLang, 'Mund të zgjedhësh më shumë se një.', 'You can select more than one.', 'Du kannst mehr als eine wählen.')}</FieldHint>
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
              <FieldLabel optional language={uiLang}>{L(uiLang, 'Gjuhët e shërbimit', 'Service languages', 'Dienstsprachen')}</FieldLabel>
            </legend>
            <FieldHint>{L(uiLang, 'Zgjidh gjuhët në të cilat mund të komunikosh me klientin.', 'Select the languages you can use with clients.', 'Wähle die Sprachen, die du mit Kunden nutzen kannst.')}</FieldHint>
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
            <FieldLabel required language={uiLang}>
              {needsPhysicalLocation
                ? (L(uiLang, 'Qyteti ku ofron shërbimin', 'City where you offer the service', 'Stadt, in der du den Dienst anbietest'))
                : onlineOnly
                  ? (L(uiLang, 'Qyteti ku bazohesh', 'City you are based in', 'Stadt, in der du ansässig bist'))
                  : (L(uiLang, 'Lokacioni', 'Location', 'Ort'))}
            </FieldLabel>
            <LocationSelector value={location} onChange={setLocation} />
            <FieldHint>
              {needsPhysicalLocation
                ? (L(uiLang, 'Duhet për shërbime fizike ose në grup, që klientët të të gjejnë pranë tyre.', 'Needed for in-person or group services so clients can find you nearby.', 'Für Vor-Ort- oder Gruppendienste, damit Kunden dich in der Nähe finden.'))
                : onlineOnly
                  ? (L(uiLang, 'Edhe për shërbime online, zgjidh qytetin ku bazohesh — përdoret për kërkim dhe filtra.', 'Even for online services, pick your base city — it is used for search and filters.', 'Auch bei Online-Diensten wähle deine Basisstadt — sie wird für Suche und Filter genutzt.'))
                  : (L(uiLang, 'Zgjidh qytetin nga lista. Mos shkruaj tekst të lirë.', 'Pick a city from the list. Do not type free text.', 'Wähle eine Stadt aus der Liste. Kein freier Text.'))}
            </FieldHint>
          </div>
        </FormSection>

        <FormSection
          title={L(uiLang, 'Çmimi', 'Pricing', 'Preis')}
          description={L(uiLang, 'Trego nëse çmimi është fiks, fillon nga një vlerë, është interval, ose caktohet me marrëveshje.', 'Say whether the price is fixed, starts from an amount, is a range, or is agreed later.', 'Sag, ob der Preis fest ist, ab einem Betrag startet, eine Spanne ist oder später vereinbart wird.')}
        >
          <fieldset className="full checkbox-fieldset service-pricing-modes">
            <legend>
              <FieldLabel required language={uiLang}>{L(uiLang, 'Lloji i çmimit', 'Pricing type', 'Preisart')}</FieldLabel>
            </legend>
            <div className="service-radio-list">
              {([
                {
                  id: 'agreement' as const,
                  label: L(uiLang, 'Me marrëveshje', 'By agreement', 'Nach Vereinbarung'),
                  hint: L(uiLang, 'Nuk shfaqet shumë fikse; çmimi diskutohen me klientin.', 'No fixed amount; price is discussed with the client.', 'Kein Festbetrag; der Preis wird mit dem Kunden besprochen.'),
                },
                {
                  id: 'from' as const,
                  label: L(uiLang, 'Nga (çmim fillestar)', 'Starting from', 'Ab'),
                  hint: L(uiLang, 'Shfaqet “nga €X”. Ideale kur çmimi varet nga rasti.', 'Shows “from €X”. Ideal when price depends on the case.', 'Zeigt „ab €X“. Wenn der Preis vom Fall abhängt.'),
                },
                {
                  id: 'fixed' as const,
                  label: L(uiLang, 'Çmim fiks', 'Fixed price', 'Festpreis'),
                  hint: L(uiLang, 'Një shumë e qartë për të gjithë klientët.', 'One clear amount for all clients.', 'Ein klarer Betrag für alle Kunden.'),
                },
                {
                  id: 'range' as const,
                  label: L(uiLang, 'Interval çmimi', 'Price range', 'Preisspanne'),
                  hint: L(uiLang, 'Shfaqet “nga €X deri €Y”.', 'Shows “from €X to €Y”.', 'Zeigt „von €X bis €Y“.'),
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
              <FieldLabel required language={uiLang}>
                {pricingMode === 'fixed' ? (L(uiLang, 'Çmimi (€)', 'Price (€)', 'Preis (€)')) : (L(uiLang, 'Çmimi nga (€)', 'Price from (€)', 'Preis von (€)'))}
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
                placeholder={L(uiLang, 'p.sh. 50', 'e.g. 50', 'z. B. 50')}
              />
              <FieldHint>
                {pricingMode === 'fixed'
                  ? (L(uiLang, 'Shuma që paguan klienti për këtë shërbim.', 'The amount the client pays for this service.', 'Der Betrag, den der Kunde für diesen Dienst zahlt.'))
                  : (L(uiLang, 'Çmimi minimal; mund të jetë më i lartë sipas rastit.', 'Minimum price; it may be higher depending on the case.', 'Mindestpreis; je nach Fall kann er höher sein.'))}
              </FieldHint>
            </label>
          ) : null}

          {pricingMode === 'range' ? (
            <>
              <label>
                <FieldLabel required language={uiLang}>{L(uiLang, 'Çmimi nga (€)', 'Price from (€)', 'Preis von (€)')}</FieldLabel>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={priceFrom}
                  required
                  onChange={(e) => setPriceFrom(e.target.value)}
                  placeholder={L(uiLang, 'p.sh. 40', 'e.g. 40', 'z. B. 40')}
                />
              </label>
              <label>
                <FieldLabel required language={uiLang}>{L(uiLang, 'Çmimi deri (€)', 'Price to (€)', 'Preis bis (€)')}</FieldLabel>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={priceTo}
                  required
                  onChange={(e) => setPriceTo(e.target.value)}
                  placeholder={L(uiLang, 'p.sh. 120', 'e.g. 120', 'z. B. 120')}
                />
                <FieldHint>{L(uiLang, 'Duhet të jetë ≥ çmimit “nga”.', 'Must be ≥ the “from” price.', 'Muss ≥ dem Preis „von“ sein.')}</FieldHint>
              </label>
            </>
          ) : null}

          {pricingMode === 'agreement' ? (
            <p className="muted full">
              {L(uiLang, 'Nuk do të shfaqet shumë në euro. Klienti do të kontaktojë për ofertë.', 'No euro amount will be shown. Clients will contact you for a quote.', 'Es wird kein Euro-Betrag angezeigt. Kunden kontaktieren dich für ein Angebot.')}
            </p>
          ) : null}
        </FormSection>

        <FormSection
          title={L(uiLang, 'Disponueshmëria', 'Availability', 'Verfügbarkeit')}
          description={L(uiLang, 'Si i pret klientët për takim ose punë. Nëse zgjedh orare fikse, hap slotet te Disponueshmëria.', 'How clients book time with you. If you choose fixed slots, open them under Availability.', 'Wie Kunden Zeit bei dir buchen. Bei festen Terminen öffne sie unter Verfügbarkeit.')}
        >
          <fieldset className="full checkbox-fieldset">
            <legend>
              <FieldLabel required language={uiLang}>{L(uiLang, 'Si rezervojnë klientët', 'How clients book', 'Wie Kunden buchen')}</FieldLabel>
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
                      {help ? <em>{L(uiLang, help.sq, help.en, help.de)}</em> : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          {isSlotsAvailability ? (
            <p className="full service-inline-note">
              {L(uiLang, 'Hap oraret e lira te ', 'Open your free slots under ', 'Öffne freie Termine unter ')}
              <Link to={availabilityPath}>{L(uiLang, 'Disponueshmëria', 'Availability', 'Verfügbarkeit')}</Link>
              {L(uiLang, ', përndryshe klientët nuk kanë termine për të zgjedhur.', ', otherwise clients will have no slots to choose.', ', sonst haben Kunden keine Termine zur Auswahl.')}
            </p>
          ) : null}
        </FormSection>

        {showCategoryFields ? (
          <FormSection
            title={L(uiLang, 'Detaje sipas kategorisë', 'Category-specific details', 'Kategoriespezifische Angaben')}
            description={L(uiLang, `Fusha shtesë për “${catalogLabel(selectedCategory!, catalogLanguage)}”. Plotësoji sipas kërkesës.`, `Extra fields for “${catalogLabel(selectedCategory!, catalogLanguage)}”. Fill them as required.`, `Zusatzfelder für „${catalogLabel(selectedCategory!, catalogLanguage)}“. Fülle sie wie verlangt aus.`)}
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
          </>
        ) : null}

        {step === 3 ? (
          <>
        <FormSection
          title={companyOwned
            ? L(uiLang, 'Punët e këtij shërbimi', 'Work for this service', 'Arbeit für diesen Dienst')
            : L(uiLang, 'Punët dhe portofoli', 'Work and portfolio', 'Arbeit und Portfolio')}
          description={
            isCompany && offerOwner === 'company'
              ? (L(uiLang, 'Shto vetëm materiale specifike për këtë shërbim. Informacioni i kompanisë merret automatikisht nga profili i kompanisë.', 'Add only materials specific to this service. Company information comes automatically from the company profile.', 'Füge nur Material zu diesem Dienst hinzu. Unternehmensangaben kommen automatisch aus dem Unternehmensprofil.'))
              : (L(uiLang, 'Shto vetëm materiale të lidhura me këtë shërbim. Përvoja, kualifikimet dhe certifikimet merren nga profili i ekspertit.', 'Add only materials related to this service. Experience, qualifications, and certifications come from the expert profile.', 'Füge nur Material zu diesem Dienst hinzu. Erfahrung, Qualifikationen und Zertifikate kommen aus dem Expertenprofil.'))
          }
        >
          {isCompany && offerOwner === 'company' ? (
            <p className="full service-inline-note">
              {L(uiLang, 'Emri, përshkrimi dhe detajet e kompanisë shfaqen automatikisht nga ', 'Company name, description, and details are shown automatically from ', 'Name, Beschreibung und Angaben des Unternehmens kommen automatisch aus ')}
              <Link to={profilePath}>{L(uiLang, 'profili i kompanisë', 'the company profile', 'dem Unternehmensprofil')}</Link>
              {L(uiLang, '.', '.', '.')}
            </p>
          ) : (
            <p className="full service-inline-note">
              {L(uiLang, 'Vitet e përvojës, përvoja profesionale, kualifikimet, licencat/certifikimet dhe statusi i verifikimit shfaqen automatikisht nga ', 'Years of experience, professional background, qualifications, licenses/certifications, and verification status are shown automatically from ', 'Jahre Erfahrung, beruflicher Hintergrund, Qualifikationen, Lizenzen/Zertifikate und der Verifizierungsstatus kommen automatisch aus ')}
              <Link to={profilePath}>
                {L(uiLang, 'profili i ekspertit', 'the expert profile', 'dem Expertenprofil')}
              </Link>
              {L(uiLang, '.', '.', '.')}
            </p>
          )}

          <div className="full service-photo-picker">
            <FieldLabel optional language={uiLang}>
              {L(uiLang, `Foto të punës (deri ${MAX_SERVICE_PHOTOS})`, `Work photos (up to ${MAX_SERVICE_PHOTOS})`, `Arbeitsfotos (bis zu ${MAX_SERVICE_PHOTOS})`)}
            </FieldLabel>
            <FieldHint>
              {L(uiLang, `Shembuj vizualë për këtë shërbim. ${IMAGE_ACCEPT_HINT}. Opsionale.`, `Visual samples for this service. ${IMAGE_ACCEPT_HINT}. Optional.`, `Visuelle Beispiele für diesen Dienst. ${IMAGE_ACCEPT_HINT}. Optional.`)}
            </FieldHint>
            <div className="service-photo-grid">
              {photos.map((url) => (
                <div key={url} className="service-photo-tile">
                  <img src={mediaUrl(url)} alt="" />
                  <button
                    type="button"
                    className="service-photo-remove"
                    aria-label={L(uiLang, 'Hiq foton', 'Remove photo', 'Foto entfernen')}
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
            <FieldLabel optional language={uiLang}>{L(uiLang, 'Portfolio URL', 'Portfolio URL', 'Portfolio-URL')}</FieldLabel>
            <input
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              placeholder="https://..."
            />
            <FieldHint>
              {L(uiLang, 'Linku i portofolit ose faqes me punë të ngjashme me këtë shërbim.', 'Link to a portfolio or page with work similar to this service.', 'Link zu einem Portfolio oder einer Seite mit ähnlicher Arbeit.')}
            </FieldHint>
          </label>

          <label className="full">
            <FieldLabel optional language={uiLang}>
              {L(uiLang, 'Shembuj pune / projekte të ngjashme', 'Work samples / similar projects', 'Arbeitsproben / ähnliche Projekte')}
            </FieldLabel>
            <textarea
              value={workSamples}
              rows={3}
              onChange={(e) => setWorkSamples(e.target.value)}
              placeholder={
                isCompany && offerOwner === 'company'
                  ? (L(uiLang, 'Përshkruaj shkurt projekte ose rezultate të ngjashme me këtë ofertë.', 'Briefly describe projects or results similar to this offer.', 'Beschreibe kurz Projekte oder Ergebnisse, die diesem Angebot ähneln.'))
                  : (L(uiLang, 'Përshkruaj shkurt projekte ose rezultate të ngjashme me këtë ofertë (jo CV-në e plotë).', 'Briefly describe projects or results similar to this offer (not your full CV).', 'Beschreibe kurz ähnliche Projekte oder Ergebnisse (nicht deinen ganzen Lebenslauf).'))
              }
            />
            <FieldHint>
              {isCompany && offerOwner === 'company'
                ? (L(uiLang, 'Vetëm shembuj për këtë shërbim.', 'Only samples for this service.', 'Nur Beispiele für diesen Dienst.'))
                : (L(uiLang, 'Vetëm shembuj për këtë shërbim. CV-ja dhe certifikimet qëndrojnë te profili.', 'Only samples for this service. CV and certifications stay on the profile.', 'Nur Beispiele für diesen Dienst. Lebenslauf und Zertifikate bleiben im Profil.'))}
            </FieldHint>
          </label>
        </FormSection>
          </>
        ) : null}

        {step === REVIEW_STEP ? (
          <>
            <ReviewSection title={stepLabels[0]} editLabel={L(uiLang, 'Ndrysho', 'Edit', 'Bearbeiten')} onEdit={() => goToStep(0)}>
              {isCompany ? (
                <ReviewItem label={L(uiLang, 'Ofruesi', 'Offered by', 'Angeboten von')}>
                  {offerOwner === 'company'
                    ? businessName || (L(uiLang, 'Kompania', 'Company', 'Unternehmen'))
                    : selectedExpert?.name || notFilled}
                </ReviewItem>
              ) : null}
              {companyOwned ? (
                <ReviewItem label={L(uiLang, 'Eksperti përgjegjës', 'Responsible expert', 'Verantwortlicher Experte')}>
                  {responsibleExpert?.name || (L(uiLang, 'Pa caktuar', 'Unassigned', 'Nicht zugewiesen'))}
                </ReviewItem>
              ) : null}
              <ReviewItem label={L(uiLang, 'Titulli', 'Title', 'Titel')} wide>
                <strong>{title}</strong>
              </ReviewItem>
              <ReviewItem label={L(uiLang, 'Kategoria', 'Category', 'Kategorie')}>
                {selectedCategory ? catalogLabel(selectedCategory, catalogLanguage) : notFilled}
              </ReviewItem>
              <ReviewItem label={L(uiLang, 'Nënkategoria', 'Subcategory', 'Unterkategorie')}>
                {selectedSubcategory ? catalogLabel(selectedSubcategory, catalogLanguage) : notFilled}
              </ReviewItem>
            </ReviewSection>

            <ReviewSection title={stepLabels[1]} editLabel={L(uiLang, 'Ndrysho', 'Edit', 'Bearbeiten')} onEdit={() => goToStep(1)}>
              <ReviewItem label={L(uiLang, 'Përshkrimi', 'Description', 'Beschreibung')} wide>
                <span className="ds-review-text">{description}</span>
              </ReviewItem>
            </ReviewSection>

            <ReviewSection title={L(uiLang, 'Detajet', 'Details', 'Details')} editLabel={L(uiLang, 'Ndrysho', 'Edit', 'Bearbeiten')} onEdit={() => goToStep(2)}>
              <ReviewItem label={L(uiLang, 'Mënyra e ofrimit', 'Delivery mode', 'Erbringungsart')}>
                {reviewModes.length ? (
                  <span className="ds-review-chips">
                    {reviewModes.map((mode) => (
                      <Chip key={mode} size="sm" variant="soft">
                        <Chip.Label>{mode}</Chip.Label>
                      </Chip>
                    ))}
                  </span>
                ) : notFilled}
              </ReviewItem>
              <ReviewItem label={L(uiLang, 'Gjuhët', 'Languages', 'Sprachen')}>
                {reviewLanguages.length ? reviewLanguages.join(', ') : notFilled}
              </ReviewItem>
              <ReviewItem label={L(uiLang, 'Lokacioni', 'Location', 'Ort')}>
                {location ? locationLabel(location, catalogLanguage) : notFilled}
              </ReviewItem>
              <ReviewItem label={L(uiLang, 'Çmimi', 'Price', 'Preis')}>
                <strong>{reviewPrice}</strong>
              </ReviewItem>
              <ReviewItem label={L(uiLang, 'Rezervimi', 'Booking', 'Buchung')}>{reviewAvailability}</ReviewItem>
              {showCategoryFields
                ? categorySpecificFields(extensionFields).map((field) => (
                  <ReviewItem key={field.key} label={fieldLabel(field, catalogLanguage)}>
                    {extensionReviewValue(extensionValues[field.key])}
                  </ReviewItem>
                ))
                : null}
            </ReviewSection>

            <ReviewSection
              title={L(uiLang, 'Foto dhe portofol', 'Photos & portfolio', 'Fotos & Portfolio')}
              editLabel={L(uiLang, 'Ndrysho', 'Edit', 'Bearbeiten')}
              onEdit={() => goToStep(3)}
            >
              <ReviewItem label={L(uiLang, 'Foto', 'Photos', 'Fotos')} wide>
                {photos.length ? (
                  <span className="ds-review-photos">
                    {photos.map((url) => (
                      <img key={url} src={mediaUrl(url)} alt="" />
                    ))}
                  </span>
                ) : (
                  <span className="ds-review-empty">{L(uiLang, 'Pa foto (opsionale)', 'No photos (optional)', 'Keine Fotos (optional)')}</span>
                )}
              </ReviewItem>
              <ReviewItem label="Portfolio URL" wide>
                {portfolioUrl.trim() ? <span className="ds-review-url">{portfolioUrl.trim()}</span> : notFilled}
              </ReviewItem>
              <ReviewItem label={L(uiLang, 'Shembuj pune', 'Work samples', 'Arbeitsproben')} wide>
                {workSamples.trim() ? <span className="ds-review-text">{workSamples}</span> : notFilled}
              </ReviewItem>
            </ReviewSection>
          </>
        ) : null}
      </form>

          <div className="ds-wizard-nav">
            {currentIssues.length > 0 ? (
              <div className="ds-wizard-todo" role="status">
                <Info size={16} aria-hidden />
                <div>
                  <strong>{L(uiLang, 'Për të vazhduar:', 'To continue:', 'Zum Fortfahren:')}</strong>
                  <ul>
                    {currentIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            {step === REVIEW_STEP && firstInvalidStep !== -1 ? (
              <p className="ds-error">
                {L(uiLang, `Plotëso hapin “${stepLabels[firstInvalidStep]}” para publikimit.`, `Complete the “${stepLabels[firstInvalidStep]}” step before publishing.`, `Schließe den Schritt „${stepLabels[firstInvalidStep]}“ ab, bevor du veröffentlichst.`)}
              </p>
            ) : null}
            {error ? <p className="ds-error">{error}</p> : null}

            <div className="ds-wizard-buttons">
              {step > 0 ? (
                <Button variant="outline" onPress={() => goToStep(step - 1)} isDisabled={submitting}>
                  <ArrowLeft size={16} aria-hidden />
                  {L(uiLang, 'Mbrapa', 'Back', 'Zurück')}
                </Button>
              ) : editingId || services.length > 0 ? (
                <Button variant="outline" onPress={() => setConfirmCancel(true)} isDisabled={submitting}>
                  {L(uiLang, 'Anulo', 'Cancel', 'Abbrechen')}
                </Button>
              ) : (
                <span />
              )}
              {step < REVIEW_STEP ? (
                <Button variant="primary" onPress={goNext} isDisabled={currentIssues.length > 0}>
                  {L(uiLang, 'Vazhdo', 'Continue', 'Weiter')}
                  <ArrowRight size={16} aria-hidden />
                </Button>
              ) : (
                <Button
                  type="submit"
                  form="service-form"
                  variant="primary"
                  isPending={submitting}
                  isDisabled={uploadingPhoto || firstInvalidStep !== -1}
                >
                  {submitting
                    ? editingId
                      ? (L(uiLang, 'Duke ruajtur…', 'Saving…', 'Speichern…'))
                      : (L(uiLang, 'Duke publikuar…', 'Publishing…', 'Veröffentlichen…'))
                    : editingId
                      ? (L(uiLang, 'Ruaj ndryshimet', 'Save changes', 'Änderungen speichern'))
                      : (L(uiLang, 'Publiko shërbimin', 'Publish service', 'Dienst veröffentlichen'))}
                </Button>
              )}
            </div>
          </div>
          </div>
        </Card.Content>
      </Card>
      ) : null}
      <ConfirmActionDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => void onDelete()} pending={Boolean(deletingId)} title={L(uiLang, 'Fshi ofertën?', 'Delete this offer?', 'Dieses Angebot löschen?')} description={L(uiLang, `“${deleteTarget?.title ?? ''}” do të fshihet përgjithmonë. Ky veprim nuk mund të zhbëhet.`, `“${deleteTarget?.title ?? ''}” will be permanently deleted. This cannot be undone.`, `„${deleteTarget?.title ?? ''}“ wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.`)} confirmLabel={L(uiLang, 'Fshi', 'Delete', 'Löschen')} />
      <ConfirmActionDialog isOpen={confirmCancel} onClose={() => setConfirmCancel(false)} onConfirm={() => { closeForm(); setConfirmCancel(false) }} title={L(uiLang, 'Hidh ndryshimet?', 'Discard changes?', 'Änderungen verwerfen?')} description={L(uiLang, 'Ndryshimet e paruajtura në ofertë do të humbasin.', 'Unsaved changes to this offer will be lost.', 'Ungespeicherte Änderungen an diesem Angebot gehen verloren.')} confirmLabel={L(uiLang, 'Hidh ndryshimet', 'Discard changes', 'Änderungen verwerfen')} />
    </section>
  )
}
