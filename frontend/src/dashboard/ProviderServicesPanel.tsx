import KeshillaPagination from '../components/KeshillaPagination'
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
  language: 'sq' | 'en'
}) {
  const next = labels[current + 1]
  return (
    <nav className="ds-stepper" aria-label={language === 'sq' ? 'Hapat e formularit' : 'Form steps'}>
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
            {language === 'sq' ? `Hapi ${current + 1} nga ${labels.length}` : `Step ${current + 1} of ${labels.length}`}
          </strong>
          {next ? <span>{language === 'sq' ? `Tjetër: ${next}` : `Next: ${next}`}</span> : null}
        </div>
        <ProgressBar
          aria-label={language === 'sq' ? 'Përparimi i formularit' : 'Form progress'}
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

  const sq = catalogLanguage === 'sq'
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
        setFormOpen(false)
        toast.success(sq ? 'Shërbimi u përditësua.' : 'Service updated.')
      } else {
        await createService(payload)
        setPage(1)
        setListRevision((value) => value + 1)
        resetForm()
        setFormOpen(false)
        toast.success(sq ? 'Shërbimi u publikua dhe shfaqet te ofertat.' : 'Service published and visible in offers.')
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
      toast.success(sq ? 'Shërbimi u fshi.' : 'Service deleted.')
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
  const stepLabels = sq
    ? ['Informacioni bazë', 'Përshkrimi', 'Detajet e shërbimit', 'Foto dhe portofol', 'Përmbledhje']
    : ['Basic information', 'Description', 'Service details', 'Photos & portfolio', 'Review']
  const stepIntros = sq
    ? [
      'Emri i shërbimit dhe kategoria ku do ta gjejnë klientët.',
      'Shpjego çfarë ofron, për kë është dhe çfarë përfshihet.',
      'Si ofrohet shërbimi, ku, me çfarë çmimi dhe si rezervojnë klientët.',
      'Opsionale: shembuj pune që e bëjnë ofertën më bindëse.',
      'Kontrollo të dhënat para publikimit. Mund të kthehesh te çdo hap për ta ndryshuar.',
    ]
    : [
      'The service name and the category where clients will find it.',
      'Explain what you offer, who it is for and what is included.',
      'How the service is delivered, where, at what price and how clients book.',
      'Optional: work samples that make the offer more convincing.',
      'Check everything before publishing. You can return to any step to change it.',
    ]

  const basicIssues: string[] = []
  if (isCompany && !businessId) {
    basicIssues.push(companyContextLoading
      ? (sq ? 'Duke ngarkuar kompaninë…' : 'Loading the company…')
      : (sq ? 'Krijo kompaninë para se të ofrosh shërbime.' : 'Create the company before offering services.'))
  }
  if (isCompany && offerOwner === 'expert' && !expertProviderId) {
    basicIssues.push(sq ? 'Zgjidh ekspertin e ekipit që e ofron shërbimin.' : 'Choose the team expert who offers this service.')
  }
  if (!title.trim()) basicIssues.push(sq ? 'Shkruaj titullin e shërbimit.' : 'Enter the service title.')
  if (!categoryId) basicIssues.push(sq ? 'Zgjidh kategorinë.' : 'Choose a category.')
  if (categoryId && (!subcategoryId || !selectedSubcategory)) {
    basicIssues.push(subcategoriesLoading
      ? (sq ? 'Duke ngarkuar nënkategoritë…' : 'Loading subcategories…')
      : (sq ? 'Zgjidh nënkategorinë.' : 'Choose a subcategory.'))
  }

  const descriptionIssues: string[] = []
  if (!description.trim()) descriptionIssues.push(sq ? 'Shkruaj përshkrimin e shërbimit.' : 'Enter the service description.')

  const detailIssues: string[] = []
  if (!location) detailIssues.push(sq ? 'Zgjidh lokacionin nga lista e qyteteve.' : 'Choose a location from the city list.')
  if (pricingMode === 'from' && !priceFrom.trim()) {
    detailIssues.push(sq ? 'Shkruaj çmimin fillestar ose zgjidh “Me marrëveshje”.' : 'Enter a starting price or choose “By agreement”.')
  }
  if (pricingMode === 'fixed' && !priceFrom.trim()) {
    detailIssues.push(sq ? 'Shkruaj çmimin fiks në euro.' : 'Enter the fixed price in euros.')
  }
  if (pricingMode === 'range') {
    if (!priceFrom.trim() || !priceTo.trim()) {
      detailIssues.push(sq ? 'Plotëso çmimin nga dhe deri.' : 'Fill in both the from and to prices.')
    } else if (Number(priceTo) < Number(priceFrom)) {
      detailIssues.push(sq ? 'Çmimi “deri” duhet të jetë më i madh ose i barabartë me “nga”.' : '“Price to” must be greater than or equal to “price from”.')
    }
  }
  if (
    pricingMode !== 'agreement'
    && [priceFrom, pricingMode === 'range' ? priceTo : ''].some((value) => value.trim() && !isWholeAmount(value))
  ) {
    detailIssues.push(sq ? 'Çmimi duhet të jetë numër i plotë, 0 ose më shumë.' : 'The price must be a whole number, 0 or more.')
  }
  if (showCategoryFields) {
    for (const field of categorySpecificFields(extensionFields)) {
      const label = fieldLabel(field, catalogLanguage)
      const value = extensionValues[field.key]
      const required = Boolean(field.required || field.mustBeTrue)
      if (field.type === 'boolean') {
        if (required && !value) detailIssues.push(sq ? `Konfirmo “${label}”.` : `Confirm “${label}”.`)
        continue
      }
      if (field.type === 'stringArray' && field.allowedValues?.length) continue
      if (required && (value == null || String(value).trim() === '')) {
        detailIssues.push(sq ? `Plotëso “${label}”.` : `Fill in “${label}”.`)
      } else if (field.type === 'number' && value != null && value !== '' && !(Number.isInteger(value) && Number(value) >= 0)) {
        detailIssues.push(sq ? `“${label}” duhet të jetë numër i plotë, 0 ose më shumë.` : `“${label}” must be a whole number, 0 or more.`)
      }
    }
  }

  const mediaIssues: string[] = []
  if (uploadingPhoto) mediaIssues.push(sq ? 'Prit sa të ngarkohet fotoja.' : 'Wait for the photo to finish uploading.')
  if (portfolioUrl.trim() && !isValidUrl(portfolioUrl.trim())) {
    mediaIssues.push(sq ? 'Shkruaj një URL të vlefshme, p.sh. https://…' : 'Enter a valid URL, e.g. https://…')
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

  const notFilled = <span className="ds-review-empty">{sq ? 'Nuk është plotësuar' : 'Not provided'}</span>
  const reviewPrice =
    pricingMode === 'agreement'
      ? (sq ? 'Me marrëveshje' : 'By agreement')
      : pricingMode === 'fixed'
        ? `€${priceFrom}`
        : pricingMode === 'range'
          ? `€${priceFrom} – €${priceTo}`
          : (sq ? `nga €${priceFrom}` : `from €${priceFrom}`)
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
    if (typeof value === 'boolean') return value ? (sq ? 'Po' : 'Yes') : (sq ? 'Jo' : 'No')
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
          <h1>{sq ? 'Shërbimet' : 'Services'}</h1>
          <p>
            {isCompany
              ? (sq
                ? 'Menaxho shërbimet që kompania dhe ekspertët e saj ofrojnë. Shërbimet aktive shfaqen te ofertat publike.'
                : 'Manage the services your company and its experts offer. Active services appear in public offers.')
              : (sq
                ? 'Menaxho shërbimet që ofron. Shërbimet aktive shfaqen te ofertat publike dhe në profilin tënd.'
                : 'Manage the services you offer. Active services appear in public offers and on your profile.')}
          </p>
        </div>
        {services.length > 0 ? (
          <Button variant="primary" className="uo-primary" onPress={openNewForm}>
            <Plus size={16} aria-hidden />
            {sq ? 'Shto shërbim' : 'Add service'}
          </Button>
        ) : null}
      </header>

      {loading ? (
        <Card className="uo-card">
          <SectionHead title={sq ? 'Shërbimet e mia' : 'My services'} />
          <Card.Content className="uo-card-body">
            <RowsSkeleton rows={3} />
          </Card.Content>
        </Card>
      ) : services.length === 0 ? (
        <Card className="uo-card ur-empty">
          <span className="ur-empty-icon" aria-hidden>
            <Briefcase size={22} />
          </span>
          <h2>{sq ? 'Ende nuk ke publikuar asnjë shërbim' : 'No services published yet'}</h2>
          <p>
            {sq
              ? 'Krijo shërbimin e parë më poshtë. Pasi ta publikosh, klientët mund ta gjejnë te ofertat dhe të të dërgojnë kërkesë.'
              : 'Create your first service below. Once published, clients can find it in offers and send you a request.'}
          </p>
          <div className="ur-empty-actions">
            <Button variant="primary" onPress={openNewForm}>
              <Plus size={16} aria-hidden />
              {sq ? 'Krijo shërbimin e parë' : 'Create your first service'}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="uo-card ur-card">
          <SectionHead
            title={sq ? 'Shërbimet e mia' : 'My services'}
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
                            <Chip.Label>{sq ? 'Në ndryshim' : 'Editing'}</Chip.Label>
                          </Chip>
                        ) : null}
                        <Chip size="sm" variant="soft" color={service.active ? 'success' : 'default'}>
                          <Chip.Label>{service.active ? (sq ? 'Aktiv' : 'Active') : (sq ? 'Joaktiv' : 'Inactive')}</Chip.Label>
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
                          {sq ? 'Përgjegjës' : 'Responsible'}: {service.responsibleExpert.name}
                        </li>
                      ) : null}
                    </ul>

                    <div className="ur-actions is-wrap ds-service-actions">
                      <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={servicePath(service)}>
                        <Eye size={14} aria-hidden />
                        {sq ? 'Shiko' : 'View'}
                      </Link>
                      <Button size="sm" variant="outline" onPress={() => startEdit(service)} isDisabled={editing}>
                        <Pencil size={14} aria-hidden />
                        {sq ? 'Ndrysho' : 'Edit'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ds-danger-btn"
                        isPending={deletingId === service.id}
                        onPress={() => setDeleteTarget(service)}
                      >
                        <Trash2 size={14} aria-hidden />
                        {deletingId === service.id ? (sq ? 'Duke fshirë…' : 'Deleting…') : (sq ? 'Fshi' : 'Delete')}
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
          title={editingId ? (sq ? 'Ndrysho shërbimin' : 'Edit service') : (sq ? 'Shto shërbim të ri' : 'Add a new service')}
          meta={
            <span className="uo-card-meta">
              {sq ? `Hapi ${step + 1} nga ${stepLabels.length}` : `Step ${step + 1} of ${stepLabels.length}`}
            </span>
          }
          action={
            services.length > 0 ? (
              <Button size="sm" variant="ghost" onPress={closeForm} isDisabled={submitting}>
                {sq ? 'Mbyll' : 'Close'}
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
            language={catalogLanguage}
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
            title={sq ? 'Kush e ofron këtë shërbim?' : 'Who offers this service?'}
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

            <KeshillaPagination pagination={teamPaging.pagination} onPageChange={teamPaging.setPage} isDisabled={companyContextLoading || Boolean(editingId)} />

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
          title={sq ? 'Emri i shërbimit' : 'Service name'}
          description={sq
            ? 'Titulli shfaqet te klientët në ofertat publike.'
            : 'The title is shown to clients in public offers.'}
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
        </FormSection>

        <FormSection
          title={sq ? 'Kategoria e shërbimit' : 'Service category'}
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

          </>
        ) : null}

        {step === 1 ? (
          <>
        <FormSection
          title={sq ? 'Përshkrimi i ofertës' : 'Offer description'}
          description={sq
            ? 'Përshkrimi shfaqet te klientët. Shkruaj qartë çfarë ofron dhe çfarë përfshihet.'
            : 'The description is shown to clients. Be clear about what you offer and what is included.'}
        >
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
          title={sq ? 'Si ofrohet shërbimi' : 'How the service is delivered'}
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
          title={sq ? 'Çmimi' : 'Pricing'}
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
          title={sq ? 'Disponueshmëria' : 'Availability'}
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

        {showCategoryFields ? (
          <FormSection
            title={sq ? 'Detaje sipas kategorisë' : 'Category-specific details'}
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
          </>
        ) : null}

        {step === 3 ? (
          <>
        <FormSection
          title={sq
            ? (companyOwned ? 'Punët e këtij shërbimi' : 'Punët dhe portofoli')
            : (companyOwned ? 'Work for this service' : 'Work and portfolio')}
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
          </>
        ) : null}

        {step === REVIEW_STEP ? (
          <>
            <ReviewSection title={stepLabels[0]} editLabel={sq ? 'Ndrysho' : 'Edit'} onEdit={() => goToStep(0)}>
              {isCompany ? (
                <ReviewItem label={sq ? 'Ofruesi' : 'Offered by'}>
                  {offerOwner === 'company'
                    ? businessName || (sq ? 'Kompania' : 'Company')
                    : selectedExpert?.name || notFilled}
                </ReviewItem>
              ) : null}
              {companyOwned ? (
                <ReviewItem label={sq ? 'Eksperti përgjegjës' : 'Responsible expert'}>
                  {responsibleExpert?.name || (sq ? 'Pa caktuar' : 'Unassigned')}
                </ReviewItem>
              ) : null}
              <ReviewItem label={sq ? 'Titulli' : 'Title'} wide>
                <strong>{title}</strong>
              </ReviewItem>
              <ReviewItem label={sq ? 'Kategoria' : 'Category'}>
                {selectedCategory ? catalogLabel(selectedCategory, catalogLanguage) : notFilled}
              </ReviewItem>
              <ReviewItem label={sq ? 'Nënkategoria' : 'Subcategory'}>
                {selectedSubcategory ? catalogLabel(selectedSubcategory, catalogLanguage) : notFilled}
              </ReviewItem>
            </ReviewSection>

            <ReviewSection title={stepLabels[1]} editLabel={sq ? 'Ndrysho' : 'Edit'} onEdit={() => goToStep(1)}>
              <ReviewItem label={sq ? 'Përshkrimi' : 'Description'} wide>
                <span className="ds-review-text">{description}</span>
              </ReviewItem>
            </ReviewSection>

            <ReviewSection title={sq ? 'Detajet' : 'Details'} editLabel={sq ? 'Ndrysho' : 'Edit'} onEdit={() => goToStep(2)}>
              <ReviewItem label={sq ? 'Mënyra e ofrimit' : 'Delivery mode'}>
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
              <ReviewItem label={sq ? 'Gjuhët' : 'Languages'}>
                {reviewLanguages.length ? reviewLanguages.join(', ') : notFilled}
              </ReviewItem>
              <ReviewItem label={sq ? 'Lokacioni' : 'Location'}>
                {location ? locationLabel(location, 'sq') : notFilled}
              </ReviewItem>
              <ReviewItem label={sq ? 'Çmimi' : 'Price'}>
                <strong>{reviewPrice}</strong>
              </ReviewItem>
              <ReviewItem label={sq ? 'Rezervimi' : 'Booking'}>{reviewAvailability}</ReviewItem>
              {showCategoryFields
                ? categorySpecificFields(extensionFields).map((field) => (
                  <ReviewItem key={field.key} label={fieldLabel(field, catalogLanguage)}>
                    {extensionReviewValue(extensionValues[field.key])}
                  </ReviewItem>
                ))
                : null}
            </ReviewSection>

            <ReviewSection
              title={sq ? 'Foto dhe portofol' : 'Photos & portfolio'}
              editLabel={sq ? 'Ndrysho' : 'Edit'}
              onEdit={() => goToStep(3)}
            >
              <ReviewItem label={sq ? 'Foto' : 'Photos'} wide>
                {photos.length ? (
                  <span className="ds-review-photos">
                    {photos.map((url) => (
                      <img key={url} src={mediaUrl(url)} alt="" />
                    ))}
                  </span>
                ) : (
                  <span className="ds-review-empty">{sq ? 'Pa foto (opsionale)' : 'No photos (optional)'}</span>
                )}
              </ReviewItem>
              <ReviewItem label="Portfolio URL" wide>
                {portfolioUrl.trim() ? <span className="ds-review-url">{portfolioUrl.trim()}</span> : notFilled}
              </ReviewItem>
              <ReviewItem label={sq ? 'Shembuj pune' : 'Work samples'} wide>
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
                  <strong>{sq ? 'Për të vazhduar:' : 'To continue:'}</strong>
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
                {sq
                  ? `Plotëso hapin “${stepLabels[firstInvalidStep]}” para publikimit.`
                  : `Complete the “${stepLabels[firstInvalidStep]}” step before publishing.`}
              </p>
            ) : null}
            {error ? <p className="ds-error">{error}</p> : null}

            <div className="ds-wizard-buttons">
              {step > 0 ? (
                <Button variant="outline" onPress={() => goToStep(step - 1)} isDisabled={submitting}>
                  <ArrowLeft size={16} aria-hidden />
                  {sq ? 'Mbrapa' : 'Back'}
                </Button>
              ) : editingId || services.length > 0 ? (
                <Button variant="outline" onPress={() => setConfirmCancel(true)} isDisabled={submitting}>
                  {sq ? 'Anulo' : 'Cancel'}
                </Button>
              ) : (
                <span />
              )}
              {step < REVIEW_STEP ? (
                <Button variant="primary" onPress={goNext} isDisabled={currentIssues.length > 0}>
                  {sq ? 'Vazhdo' : 'Continue'}
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
                      ? (sq ? 'Duke ruajtur…' : 'Saving…')
                      : (sq ? 'Duke publikuar…' : 'Publishing…')
                    : editingId
                      ? (sq ? 'Ruaj ndryshimet' : 'Save changes')
                      : (sq ? 'Publiko shërbimin' : 'Publish service')}
                </Button>
              )}
            </div>
          </div>
          </div>
        </Card.Content>
      </Card>
      ) : null}
      <ConfirmActionDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => void onDelete()} pending={Boolean(deletingId)} title={sq ? 'Fshi ofertën?' : 'Delete this offer?'} description={sq ? `“${deleteTarget?.title ?? ''}” do të fshihet përgjithmonë. Ky veprim nuk mund të zhbëhet.` : `“${deleteTarget?.title ?? ''}” will be permanently deleted. This cannot be undone.`} confirmLabel={sq ? 'Fshi' : 'Delete'} />
      <ConfirmActionDialog isOpen={confirmCancel} onClose={() => setConfirmCancel(false)} onConfirm={() => { closeForm(); setConfirmCancel(false) }} title={sq ? 'Hidh ndryshimet?' : 'Discard changes?'} description={sq ? 'Ndryshimet e paruajtura në ofertë do të humbasin.' : 'Unsaved changes to this offer will be lost.'} confirmLabel={sq ? 'Hidh ndryshimet' : 'Discard changes'} />
    </section>
  )
}
