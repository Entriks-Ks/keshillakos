import KeshillaPagination from '../components/KeshillaPagination'
import { emptyPagination, type PaginationMeta } from '../api/pagination'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, SearchField, Tabs, ToggleButton } from '@heroui/react'
import {
  AlertCircle,
  ArrowUpDown,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  Scale,
  SearchX,
  SlidersHorizontal,
  Star,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Drawer } from 'vaul'
import {
  fetchCategories,
  fetchSubcategories,
  type CatalogCategory,
  type CatalogSubcategory,
} from '../api/catalog'
import { fetchMarketplaceProviders, type MarketplaceProvider } from '../api/providerProfiles'
import { fetchActiveServices, type ServiceItem } from '../api/services'
import CompanyCard from '../components/CompanyCard'
import ExpertCard from '../components/ExpertCard'
import LocationSelector from '../components/LocationSelector'
import { CardSkeleton } from '../components/ProviderCardParts'
import ServiceOfferCard from '../components/ServiceOfferCard'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import { useCatalogOptions } from '../hooks/useCatalogOptions'
import { useSavedLocation } from '../hooks/useSavedLocation'
import { catalogLanguage } from '../i18n'
import { getErrorMessage } from '../utils/errors'
import { withCategoryLabels } from '../utils/marketplaceProvider'
import {
  type DeliveryFilter,
  type MarketplaceFilters,
  type MarketplaceSort,
  type MarketplaceTab,
  type VerificationFilter,
} from '../utils/serviceDiscovery'
import './OffersPage.css'

const SORT_OPTIONS: Array<{ id: MarketplaceSort; label: string }> = [
  { id: 'relevance', label: 'Relevanca' },
  { id: 'newest', label: 'Më të rejat' },
  { id: 'rating', label: 'Vlerësimi më i lartë' },
  { id: 'reviews', label: 'Më të vlerësuarat' },
]

const RATING_FILTERS = [
  { id: '', label: 'Të gjitha' },
  { id: '4', label: '4+ yje' },
  { id: '4.5', label: '4.5+ yje' },
]

const VISIBLE_CATEGORY_COUNT = 8

function catalogLabel(item: { name: { sq: string; en: string } }, language: 'sq' | 'en') {
  return item.name[language] || item.name.sq
}

function parseTab(value: string | null): MarketplaceTab {
  if (value === 'experts' || value === 'companies') return value
  return 'services'
}

const TABS: Array<{ id: MarketplaceTab; icon: LucideIcon }> = [
  { id: 'services', icon: BriefcaseBusiness },
  { id: 'companies', icon: Building2 },
  { id: 'experts', icon: UserRound },
]

function parseSort(value: string | null): MarketplaceSort {
  if (value === 'newest' || value === 'rating' || value === 'reviews' || value === 'relevance') return value
  return 'relevance'
}

function categoryKey(category: CatalogCategory) {
  return category.stableId || category.slug || category._id
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="of-filter-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function ResultsState({
  icon: Icon,
  tone = 'neutral',
  title,
  text,
  action,
}: {
  icon: LucideIcon
  tone?: 'neutral' | 'danger'
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className={`of-state is-${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <span className="of-state-icon" aria-hidden>
        <Icon size={22} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  )
}

type ActiveChip = { key: string; label: string; clear: () => void }

export default function OffersPage() {
  const { t, i18n } = useTranslation()
  const namesLang = catalogLanguage(i18n.language)
  const [searchParams, setSearchParams] = useSearchParams()
  const { languages } = useCatalogOptions()
  const [providers, setProviders] = useState<MarketplaceProvider[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [subcategories, setSubcategories] = useState<CatalogSubcategory[]>([])
  const [providersLoading, setProvidersLoading] = useState(true)
  const [providersError, setProvidersError] = useState('')
  const [servicesLoading, setServicesLoading] = useState(true)
  const [servicesError, setServicesError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const tabParam = searchParams.get('tab')
  const [tab, setTab] = useState<MarketplaceTab>(() => parseTab(tabParam))
  const [syncedTabParam, setSyncedTabParam] = useState(tabParam)
  if (tabParam !== syncedTabParam) {
    setSyncedTabParam(tabParam)
    setTab(parseTab(tabParam))
  }
  const [sort, setSort] = useState<MarketplaceSort>(() => parseSort(searchParams.get('sort')))
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(timer)
  }, [query])
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || 'all')
  const [subcategoryId, setSubcategoryId] = useState(searchParams.get('subcategoryId') || 'all')
  const urlFilters = JSON.stringify([searchParams.get('q'), searchParams.get('sort'), searchParams.get('categoryId'), searchParams.get('subcategoryId')])
  const [syncedUrlFilters, setSyncedUrlFilters] = useState(urlFilters)
  if (urlFilters !== syncedUrlFilters) {
    setSyncedUrlFilters(urlFilters)
    setQuery(searchParams.get('q') ?? '')
    setSort(parseSort(searchParams.get('sort')))
    setCategoryId(searchParams.get('categoryId') || 'all')
    setSubcategoryId(searchParams.get('subcategoryId') || 'all')
  }
  const [delivery, setDelivery] = useState<DeliveryFilter>('all')
  const [language, setLanguage] = useState('all')
  const [minRating, setMinRating] = useState('')
  const [verification, setVerification] = useState<VerificationFilter>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const { selectedLocation, changeLocation, locationLoading, locationSaving, locationError } = useSavedLocation()
  const cityId = selectedLocation?.city._id
  const cityName = selectedLocation?.city.name.sq

  const selectedCategory = useMemo(
    () => categories.find((item) => item._id === categoryId || categoryKey(item) === categoryId) ?? null,
    [categories, categoryId],
  )
  const categoryFilterKey = selectedCategory ? categoryKey(selectedCategory) : categoryId
  const selectedSubcategory = useMemo(
    () => subcategories.find((item) => item._id === subcategoryId) ?? null,
    [subcategories, subcategoryId],
  )

  const filters: MarketplaceFilters = useMemo(() => ({
    query,
    categoryId: categoryFilterKey,
    subcategoryId,
    delivery,
    language,
    priceMin: '',
    priceMax: '',
    minRating,
    verification,
    availability: 'all',
  }), [query, categoryFilterKey, subcategoryId, delivery, language, minRating, verification])

  const limitFromUrl = Number(searchParams.get('limit') || 12)
  const limit = Number.isSafeInteger(limitFromUrl) && limitFromUrl > 0 ? Math.min(limitFromUrl, 100) : 12
  const pageFromUrl = Number(searchParams.get('page') || 1)
  const requestedPage = Number.isSafeInteger(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1
  const extraFiltersKey = JSON.stringify([delivery, language, minRating, verification, cityId, limit])
  const previousExtraFilters = useRef(extraFiltersKey)
  const filtersChanged = previousExtraFilters.current !== extraFiltersKey
    || query.trim() !== (searchParams.get('q') ?? '')
    || sort !== parseSort(searchParams.get('sort'))
    || tab !== parseTab(searchParams.get('tab'))
    || categoryId !== (searchParams.get('categoryId') || 'all')
    || subcategoryId !== (searchParams.get('subcategoryId') || 'all')
  const page = filtersChanged ? 1 : requestedPage
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination)
  const [counts, setCounts] = useState({ services: 0, experts: 0, companies: 0 })
  function changePage(nextPage: number) {
    const next = new URLSearchParams(searchParams)
    if (nextPage > 1) next.set('page', String(nextPage)); else next.delete('page')
    setSearchParams(next)
  }

  useEffect(() => {
    let cancelled = false
    fetchCategories()
      .then((items) => {
        if (!cancelled) {
          setCategories(items.filter((item) => item.isActive).sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug)))
        }
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const catalogCategoryId = selectedCategory?._id
    if (!catalogCategoryId) {
      setSubcategories([])
      return
    }
    let cancelled = false
    fetchSubcategories(catalogCategoryId)
      .then((items) => {
        if (!cancelled) {
          setSubcategories(items.filter((item) => item.isActive).sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug)))
        }
      })
      .catch(() => {
        if (!cancelled) setSubcategories([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedCategory?._id])

  useEffect(() => {
    if (locationLoading || query !== debouncedQuery) return
    const controller = new AbortController()
    const request = { cityId, page, limit, tab, q: query.trim() || undefined,
      categoryId: categoryFilterKey === 'all' ? undefined : categoryFilterKey,
      subcategoryId: subcategoryId === 'all' ? undefined : subcategoryId,
      delivery, language, minRating, verification, sort }
    if (tab === 'services') { setServicesLoading(true); setServicesError('') }
    else { setProvidersLoading(true); setProvidersError('') }
    if (tab !== 'services') fetchMarketplaceProviders(request, controller.signal)
      .then((providerItems) => {
        if (!controller.signal.aborted) {
          setProviders(providerItems)
          setCounts((current) => ({ ...current, ...providerItems.counts }))
          setPagination(providerItems.pagination)
          if (providerItems.pagination.page !== page) changePage(providerItems.pagination.page)
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setProviders([])
        setProvidersError(getErrorMessage(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setProvidersLoading(false)
      })
    if (tab === 'services') fetchActiveServices(request, controller.signal)
      .then((serviceItems) => {
        if (!controller.signal.aborted) {
          setServices(serviceItems)
          setCounts((current) => ({ ...current, services: serviceItems.pagination.total }))
          setPagination(serviceItems.pagination)
          if (serviceItems.pagination.page !== page) changePage(serviceItems.pagination.page)
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setServices([])
        setServicesError(getErrorMessage(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setServicesLoading(false)
      })
    return () => controller.abort()
  }, [cityId, locationLoading, reloadKey, page, limit, filters, sort, tab, debouncedQuery])

  // Counts do not depend on page/limit/sort. Do not reload inactive rows on pagination.
  useEffect(() => {
    if (locationLoading || query !== debouncedQuery) return
    const controller = new AbortController()
    const request = { cityId, q: debouncedQuery.trim() || undefined,
      categoryId: categoryFilterKey === 'all' ? undefined : categoryFilterKey,
      subcategoryId: subcategoryId === 'all' ? undefined : subcategoryId,
      delivery, language, minRating, verification, countsOnly: true }
    if (tab === 'services') {
      setProvidersLoading(true)
      void fetchMarketplaceProviders(request, controller.signal)
        .then((items) => { if (!controller.signal.aborted) setCounts((current) => ({ ...current, ...items.counts })) })
        .catch(() => undefined)
        .finally(() => { if (!controller.signal.aborted) setProvidersLoading(false) })
    } else {
      setServicesLoading(true)
      void fetchActiveServices(request, controller.signal)
        .then((items) => { if (!controller.signal.aborted) setCounts((current) => ({ ...current, services: items.pagination.total })) })
        .catch(() => undefined)
        .finally(() => { if (!controller.signal.aborted) setServicesLoading(false) })
    }
    return () => controller.abort()
  }, [cityId, locationLoading, reloadKey, debouncedQuery, query, categoryFilterKey, subcategoryId, delivery, language, minRating, verification, tab])

  useEffect(() => {
    previousExtraFilters.current = extraFiltersKey
    const next = new URLSearchParams(searchParams)
    for (const key of ['tab', 'sort', 'q', 'categoryId', 'subcategoryId', 'page']) next.delete(key)
    if (page > 1) next.set('page', String(page))
    if (tab !== 'services' || searchParams.has('tab')) next.set('tab', tab)
    if (sort !== 'relevance') next.set('sort', sort)
    if (query.trim()) next.set('q', query.trim())
    if (categoryId !== 'all') next.set('categoryId', categoryId)
    if (subcategoryId !== 'all') next.set('subcategoryId', subcategoryId)
    if (query.trim() || categoryId !== 'all' || subcategoryId !== 'all') next.delete('approx')
    const upcoming = next.toString()
    if (searchParams.toString() !== upcoming) setSearchParams(next, { replace: true })
  }, [tab, sort, query, categoryId, subcategoryId, page, extraFiltersKey, searchParams, setSearchParams])

  const labeledProviders = useMemo(
    () => providers.map((provider) => withCategoryLabels(provider, categories)),
    [providers, categories],
  )
  const providersByUid = useMemo(
    () => new Map(providers.map((provider) => [provider.uid, provider])),
    [providers],
  )
  const filteredExperts = labeledProviders.filter((provider) => provider.providerType === 'individual')
  const filteredCompanies = labeledProviders.filter((provider) => provider.providerType === 'business')
  const filteredServices = services

  const loading = tab === 'services' ? servicesLoading : providersLoading
  const error = tab === 'services' ? servicesError : providersError
  const tabCounts: Record<MarketplaceTab, number | null> = {
    services: servicesLoading ? null : counts.services,
    companies: providersLoading ? null : counts.companies,
    experts: providersLoading ? null : counts.experts,
  }
  const resultCount = tabCounts[tab] ?? 0
  const offerKey = tab === 'services' ? 'Services' : tab === 'companies' ? 'Companies' : 'Experts'
  const copy = {
    placeholder: t(`offers.placeholder${offerKey}`),
    empty: t(`offers.empty${offerKey}`),
    error: t(`offers.error${offerKey}`),
  }
  const resultLabel = tab === 'companies'
    ? t('offers.nounCompany')
    : resultCount === 1
      ? t(tab === 'services' ? 'offers.nounService' : 'offers.nounExpert')
      : t(tab === 'services' ? 'offers.nounServices' : 'offers.nounExperts')

  const languageLabel = languages.find((item) => item.value === language)?.label ?? language
  const ratingLabel = minRating === '4' ? t('offers.stars4') : minRating === '4.5' ? t('offers.stars45') : ''

  const activeChips: ActiveChip[] = []
  if (query.trim()) activeChips.push({ key: 'q', label: `“${query.trim()}”`, clear: () => setQuery('') })
  if (selectedCategory) {
    activeChips.push({
      key: 'category',
      label: catalogLabel(selectedCategory, namesLang),
      clear: () => {
        setCategoryId('all')
        setSubcategoryId('all')
      },
    })
  }
  if (selectedSubcategory) {
    activeChips.push({ key: 'subcategory', label: catalogLabel(selectedSubcategory, namesLang), clear: () => setSubcategoryId('all') })
  }
  if (minRating && ratingLabel) activeChips.push({ key: 'rating', label: ratingLabel, clear: () => setMinRating('') })
  if (selectedLocation && cityName) activeChips.push({ key: 'city', label: cityName, clear: () => { void changeLocation(null) } })
  if (delivery !== 'all') {
    activeChips.push({ key: 'delivery', label: delivery === 'online' ? 'Online' : t('offers.inPerson'), clear: () => setDelivery('all') })
  }
  if (language !== 'all') activeChips.push({ key: 'language', label: languageLabel, clear: () => setLanguage('all') })
  if (verification === 'verified') {
    activeChips.push({ key: 'verified', label: t('offers.verified'), clear: () => setVerification('all') })
  }
  const hasActiveFilters = activeChips.length > 0
  const sheetFilterCount = activeChips.filter((chip) => chip.key !== 'q' && chip.key !== 'city').length

  const visibleCategories = useMemo(() => {
    if (showAllCategories || categories.length <= VISIBLE_CATEGORY_COUNT) return categories
    const head = categories.slice(0, VISIBLE_CATEGORY_COUNT)
    if (selectedCategory && !head.some((item) => item._id === selectedCategory._id)) return [...head, selectedCategory]
    return head
  }, [categories, showAllCategories, selectedCategory])

  function selectCategory(nextId: string) {
    setCategoryId(nextId)
    setSubcategoryId('all')
  }

  function clearFilters() {
    setQuery('')
    setCategoryId('all')
    setSubcategoryId('all')
    setDelivery('all')
    setLanguage('all')
    setMinRating('')
    setVerification('all')
    if (selectedLocation) void changeLocation(null)
  }

  function onTabChange(key: string | number) {
    if (key === 'services' || key === 'experts' || key === 'companies') setTab(key)
  }

  const filterSections = (
    <>
      <FilterSection title={t('offers.category')}>
        <div className="of-chip-list">
          <ToggleButton
            className="of-chip"
            isSelected={!selectedCategory}
            onChange={() => selectCategory('all')}
          >
            {t('offers.all')}
          </ToggleButton>
          {visibleCategories.map((category) => (
            <ToggleButton
              key={category._id}
              className="of-chip"
              isSelected={selectedCategory?._id === category._id}
              onChange={(selected) => selectCategory(selected ? category._id : 'all')}
            >
              {catalogLabel(category, namesLang)}
            </ToggleButton>
          ))}
        </div>
        {categories.length > VISIBLE_CATEGORY_COUNT ? (
          <button type="button" className="of-link-btn" onClick={() => setShowAllCategories((value) => !value)}>
            {showAllCategories ? t('offers.showLess') : t('offers.showAll', { count: categories.length })}
          </button>
        ) : null}
      </FilterSection>

      {selectedCategory && subcategories.length > 0 ? (
        <FilterSection title={t('offers.subcategory')}>
          <div className="of-chip-list">
            <ToggleButton
              className="of-chip"
              isSelected={subcategoryId === 'all'}
              onChange={() => setSubcategoryId('all')}
            >
              {t('offers.all')}
            </ToggleButton>
            {subcategories.map((subcategory) => (
              <ToggleButton
                key={subcategory._id}
                className="of-chip"
                isSelected={subcategoryId === subcategory._id}
                onChange={(selected) => setSubcategoryId(selected ? subcategory._id : 'all')}
              >
                {catalogLabel(subcategory, namesLang)}
              </ToggleButton>
            ))}
          </div>
        </FilterSection>
      ) : null}

      <FilterSection title={t('offers.ratingTitle')}>
        <div className="of-chip-list">
          {RATING_FILTERS.map((item) => (
            <ToggleButton
              key={item.id || 'all'}
              className="of-chip"
              isSelected={minRating === item.id}
              onChange={() => setMinRating(item.id)}
            >
              {item.id ? <Star size={13} aria-hidden className="of-chip-star" /> : null}
              {item.id === '4' ? t('offers.stars4') : item.id === '4.5' ? t('offers.stars45') : t('offers.all')}
            </ToggleButton>
          ))}
        </div>
      </FilterSection>

      <FilterSection title={t('offers.delivery')}>
        <div className="of-chip-list">
          <ToggleButton
            className="of-chip"
            isSelected={delivery === 'online'}
            onChange={(selected) => setDelivery(selected ? 'online' : 'all')}
          >
            Online
          </ToggleButton>
          <ToggleButton
            className="of-chip"
            isSelected={delivery === 'physical'}
            onChange={(selected) => setDelivery(selected ? 'physical' : 'all')}
          >
            {t('offers.inPerson')}
          </ToggleButton>
        </div>
      </FilterSection>

      {languages.length > 0 ? (
        <FilterSection title={t('offers.language')}>
          <div className="of-chip-list">
            {languages.map((item) => (
              <ToggleButton
                key={item.id}
                className="of-chip"
                isSelected={language === item.value}
                onChange={(selected) => setLanguage(selected ? item.value : 'all')}
              >
                {item.label}
              </ToggleButton>
            ))}
          </div>
        </FilterSection>
      ) : null}

      <FilterSection title={t('offers.trust')}>
        <ToggleButton
          className="of-chip is-wide"
          isSelected={verification === 'verified'}
          onChange={(selected) => setVerification(selected ? 'verified' : 'all')}
        >
          <BadgeCheck size={15} aria-hidden />
          {t('offers.verifiedOnly')}
        </ToggleButton>
      </FilterSection>
    </>
  )

  function renderResults(panel: MarketplaceTab) {
    if (loading) {
      return (
        <>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </>
      )
    }
    if (error) {
      return (
        <ResultsState
          icon={AlertCircle}
          tone="danger"
          title={copy.error}
          text={error}
          action={(
            <Button variant="outline" onPress={() => setReloadKey((value) => value + 1)}>
              {t('offers.retry')}
            </Button>
          )}
        />
      )
    }
    if (resultCount === 0) {
      return (
        <ResultsState
          icon={SearchX}
          title={hasActiveFilters ? t('offers.noFilter') : t('offers.emptyTitle')}
          text={hasActiveFilters
            ? t('offers.noFilterText')
            : cityName
              ? t('offers.emptyCity')
              : copy.empty}
          action={hasActiveFilters ? (
            <Button variant="primary" onPress={clearFilters}>{t('offers.clearFilters')}</Button>
          ) : undefined}
        />
      )
    }
    if (panel === 'services') {
      return filteredServices.map((service) => (
        <ServiceOfferCard
          key={service.id}
          service={service}
          provider={providersByUid.get(service.provider?.uid || service.providerUid)}
        />
      ))
    }
    if (panel === 'experts') {
      return filteredExperts.map((provider) => <ExpertCard key={provider.id} provider={provider} />)
    }
    return filteredCompanies.map((provider) => <CompanyCard key={provider.id} provider={provider} />)
  }

  const sortSelect = (
    <label className="of-sort">
      <ArrowUpDown size={15} aria-hidden />
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value as MarketplaceSort)}
        aria-label={t('offers.sort')}
      >
        {SORT_OPTIONS.map((item) => (
          <option key={item.id} value={item.id}>{t(`offers.${item.id}`)}</option>
        ))}
      </select>
      <ChevronDown size={15} aria-hidden className="of-sort-caret" />
    </label>
  )

  return (
    <div className="tt-shell of-marketplace">
      <SiteNav />

      <main className="of-page">
        <Tabs selectedKey={tab} onSelectionChange={onTabChange} className="of-tabs">
          <header className="of-head">
            <div className="of-inner">
              <h1 id="offers-heading">{t('offers.title')}</h1>
              <p className="of-lead">{t('offers.lead')}</p>
              <div className="of-compare-banner">
                <Scale size={15} aria-hidden />
                <span>Po krahasoni specialistët ligjorë?</span>
                <Link to="/krahaso" className="of-compare-banner-link">
                  Krahaso deri në 3 avokatë në një ekran të vetëm →
                </Link>
              </div>
              <Tabs.ListContainer className="of-tabs-bar">
                <Tabs.List aria-label={t('offers.kinds')}>
                  {TABS.map(({ id, icon: Icon }) => (
                    <Tabs.Tab key={id} id={id} className="of-tab">
                      <Icon size={16} aria-hidden className="of-tab-icon" />
                      {t(`offers.${id}`)}
                      {tabCounts[id] != null ? <span className="of-tab-count">{tabCounts[id]}</span> : null}
                      <Tabs.Indicator className="of-tab-indicator" />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
            </div>
          </header>

          <div className="of-inner of-body">
            <div className="of-search" role="search">
              <SearchField
                aria-label={t('offers.search')}
                value={query}
                onChange={setQuery}
                fullWidth
                className="of-search-field"
              >
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder={copy.placeholder} />
                  <SearchField.ClearButton aria-label={t('offers.clearSearch')} />
                </SearchField.Group>
              </SearchField>
              <div className="of-search-location">
                <LocationSelector
                  value={selectedLocation}
                  onChange={(value) => { void changeLocation(value) }}
                  disabled={locationLoading || locationSaving}
                  className="of-location"
                />
              </div>
              <Button variant="outline" className="of-filter-btn" onPress={() => setFiltersOpen(true)}>
                <SlidersHorizontal size={16} aria-hidden />
                {t('offers.filters')}
                {sheetFilterCount > 0 ? <span className="of-badge">{sheetFilterCount}</span> : null}
              </Button>
            </div>

            <div className="of-layout">
              <aside className="of-sidebar" aria-label={t('offers.filters')}>
                <div className="of-sidebar-card">
                  <div className="of-sidebar-head">
                    <h2>
                      <SlidersHorizontal size={16} aria-hidden />
                      {t('offers.filters')}
                    </h2>
                    {hasActiveFilters ? (
                      <button type="button" className="of-link-btn" onClick={clearFilters}>
                        {t('offers.clear')}
                      </button>
                    ) : null}
                  </div>
                  {filterSections}
                </div>
              </aside>

              <div className="of-results">
                {searchParams.get('approx') === '1' ? (
                  <p className="of-approx" role="status">{t('offers.approx')}</p>
                ) : null}
                <div className="of-results-head">
                  <p className="of-count" aria-live="polite">
                    {loading ? t('offers.searching') : (
                      <>
                        <strong>{resultCount}</strong> {resultLabel}
                        {cityName ? ` ${t('offers.inCity', { city: cityName })}` : ''}
                      </>
                    )}
                  </p>
                  {sortSelect}
                </div>

                {hasActiveFilters ? (
                  <div className="of-active-chips" aria-label={t('offers.active')}>
                    {activeChips.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        className="of-active-chip"
                        onClick={chip.clear}
                        aria-label={`Hiq filtrin ${chip.label}`}
                      >
                        {chip.label}
                        <X size={13} aria-hidden />
                      </button>
                    ))}
                    <button type="button" className="of-link-btn" onClick={clearFilters}>
                      {t('offers.clearAll')}
                    </button>
                  </div>
                ) : null}

                {locationError ? <p className="of-inline-error" role="alert">{locationError}</p> : null}

                {TABS.map(({ id }) => (
                  <Tabs.Panel key={id} id={id} className="of-list">
                    {renderResults(id)}
                  </Tabs.Panel>
                ))}
                {!loading && !error ? <KeshillaPagination pagination={pagination} onPageChange={changePage} /> : null}
              </div>
            </div>
          </div>
        </Tabs>

        <Drawer.Root open={filtersOpen} onOpenChange={setFiltersOpen} repositionInputs={false}>
          <Drawer.Portal>
            <Drawer.Overlay className="tt-offers-drawer-overlay" />
            <Drawer.Content className="tt-offers-drawer-content of-drawer" aria-describedby={undefined}>
              <div className="tt-offers-drawer-handle" aria-hidden />
              <div className="tt-offers-drawer-head">
                <Drawer.Title className="tt-offers-drawer-title">{t('offers.filters')}</Drawer.Title>
                <button
                  type="button"
                  className="tt-offers-drawer-close"
                  aria-label={t('offers.close')}
                  onClick={() => setFiltersOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="tt-offers-drawer-body of-sheet-body">
                {filterSections}
              </div>
              <div className="tt-offers-drawer-footer">
                {hasActiveFilters ? (
                  <Button variant="ghost" onPress={clearFilters}>
                    {t('offers.clear')}
                  </Button>
                ) : <span />}
                <Button className="tt-offers-drawer-apply" onPress={() => setFiltersOpen(false)}>
                  Shiko {resultCount} {resultLabel}
                </Button>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </main>

      <SiteFooter />
    </div>
  )
}
