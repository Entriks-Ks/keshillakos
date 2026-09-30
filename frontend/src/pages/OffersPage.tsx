import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, SearchField, Tabs, ToggleButton } from '@heroui/react'
import {
  AlertCircle,
  ArrowUpDown,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
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
import { getErrorMessage } from '../utils/errors'
import { withCategoryLabels } from '../utils/marketplaceProvider'
import {
  filterMarketplaceProviders,
  filterVisibleServices,
  serviceDiscoveryRequest,
  sortProviders,
  sortServices,
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

function catalogLabel(item: { name: { sq: string; en: string } }) {
  return item.name.sq || item.name.en
}

function parseTab(value: string | null): MarketplaceTab {
  if (value === 'experts' || value === 'companies') return value
  return 'services'
}

const TABS: Array<{ id: MarketplaceTab; label: string; icon: LucideIcon }> = [
  { id: 'services', label: 'Shërbime', icon: BriefcaseBusiness },
  { id: 'companies', label: 'Kompani', icon: Building2 },
  { id: 'experts', label: 'Ekspertë', icon: UserRound },
]

const TAB_COPY: Record<MarketplaceTab, {
  placeholder: string
  empty: string
  error: string
  result: (count: number) => string
}> = {
  services: {
    placeholder: 'Kërko shërbim, fushë ose ofrues…',
    empty: 'Shërbimet do të shfaqen këtu sapo të publikohen.',
    error: 'Shërbimet nuk u ngarkuan',
    result: (count) => (count === 1 ? 'shërbim' : 'shërbime'),
  },
  companies: {
    placeholder: 'Kërko kompani ose fushë…',
    empty: 'Kompanitë do të shfaqen këtu sapo të publikohen.',
    error: 'Kompanitë nuk u ngarkuan',
    result: () => 'kompani',
  },
  experts: {
    placeholder: 'Kërko ekspert, profesion ose specialitet…',
    empty: 'Ekspertët do të shfaqen këtu sapo të publikohen.',
    error: 'Ekspertët nuk u ngarkuan',
    result: (count) => (count === 1 ? 'ekspert' : 'ekspertë'),
  },
}

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
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || 'all')
  const [subcategoryId, setSubcategoryId] = useState(searchParams.get('subcategoryId') || 'all')
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
    if (locationLoading) return
    const controller = new AbortController()
    const request = serviceDiscoveryRequest(cityId)
    setProvidersLoading(true)
    setProvidersError('')
    setServicesLoading(true)
    setServicesError('')
    fetchMarketplaceProviders(request, controller.signal)
      .then((providerItems) => {
        if (!controller.signal.aborted) setProviders(providerItems)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setProviders([])
        setProvidersError(getErrorMessage(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setProvidersLoading(false)
      })
    fetchActiveServices(request, controller.signal)
      .then((serviceItems) => {
        if (!controller.signal.aborted) setServices(Array.isArray(serviceItems) ? serviceItems : [])
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
  }, [cityId, locationLoading, reloadKey])

  useEffect(() => {
    const next = new URLSearchParams()
    if (tab !== 'services' || searchParams.has('tab')) next.set('tab', tab)
    if (sort !== 'relevance') next.set('sort', sort)
    if (query.trim()) next.set('q', query.trim())
    if (categoryId !== 'all') next.set('categoryId', categoryId)
    if (subcategoryId !== 'all') next.set('subcategoryId', subcategoryId)
    const upcoming = next.toString()
    if (searchParams.toString() !== upcoming) setSearchParams(next, { replace: true })
  }, [tab, sort, query, categoryId, subcategoryId, setSearchParams])

  const labeledProviders = useMemo(
    () => providers.map((provider) => withCategoryLabels(provider, categories)),
    [providers, categories],
  )
  const providersByUid = useMemo(
    () => new Map(providers.map((provider) => [provider.uid, provider])),
    [providers],
  )
  const filteredExperts = useMemo(
    () => sortProviders(filterMarketplaceProviders(labeledProviders, filters, 'experts'), sort, query),
    [labeledProviders, filters, sort, query],
  )
  const filteredCompanies = useMemo(
    () => sortProviders(filterMarketplaceProviders(labeledProviders, filters, 'companies'), sort, query),
    [labeledProviders, filters, sort, query],
  )

  const filteredServices = useMemo(
    () => sortServices(filterVisibleServices(services, filters), sort, query),
    [services, filters, sort, query],
  )

  const copy = TAB_COPY[tab]
  const loading = tab === 'services' ? servicesLoading : providersLoading
  const error = tab === 'services' ? servicesError : providersError
  const tabCounts: Record<MarketplaceTab, number | null> = {
    services: servicesLoading ? null : filteredServices.length,
    companies: providersLoading ? null : filteredCompanies.length,
    experts: providersLoading ? null : filteredExperts.length,
  }
  const resultCount = tabCounts[tab] ?? 0
  const resultLabel = copy.result(resultCount)

  const languageLabel = languages.find((item) => item.value === language)?.label ?? language
  const ratingLabel = RATING_FILTERS.find((item) => item.id === minRating)?.label

  const activeChips: ActiveChip[] = []
  if (query.trim()) activeChips.push({ key: 'q', label: `“${query.trim()}”`, clear: () => setQuery('') })
  if (selectedCategory) {
    activeChips.push({
      key: 'category',
      label: catalogLabel(selectedCategory),
      clear: () => {
        setCategoryId('all')
        setSubcategoryId('all')
      },
    })
  }
  if (selectedSubcategory) {
    activeChips.push({ key: 'subcategory', label: catalogLabel(selectedSubcategory), clear: () => setSubcategoryId('all') })
  }
  if (minRating && ratingLabel) activeChips.push({ key: 'rating', label: ratingLabel, clear: () => setMinRating('') })
  if (selectedLocation && cityName) activeChips.push({ key: 'city', label: cityName, clear: () => { void changeLocation(null) } })
  if (delivery !== 'all') {
    activeChips.push({ key: 'delivery', label: delivery === 'online' ? 'Online' : 'Fizikisht', clear: () => setDelivery('all') })
  }
  if (language !== 'all') activeChips.push({ key: 'language', label: languageLabel, clear: () => setLanguage('all') })
  if (verification === 'verified') {
    activeChips.push({ key: 'verified', label: 'Të verifikuara', clear: () => setVerification('all') })
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
      <FilterSection title="Kategoria">
        <div className="of-chip-list">
          <ToggleButton
            className="of-chip"
            isSelected={!selectedCategory}
            onChange={() => selectCategory('all')}
          >
            Të gjitha
          </ToggleButton>
          {visibleCategories.map((category) => (
            <ToggleButton
              key={category._id}
              className="of-chip"
              isSelected={selectedCategory?._id === category._id}
              onChange={(selected) => selectCategory(selected ? category._id : 'all')}
            >
              {catalogLabel(category)}
            </ToggleButton>
          ))}
        </div>
        {categories.length > VISIBLE_CATEGORY_COUNT ? (
          <button type="button" className="of-link-btn" onClick={() => setShowAllCategories((value) => !value)}>
            {showAllCategories ? 'Shfaq më pak' : `Shfaq të gjitha (${categories.length})`}
          </button>
        ) : null}
      </FilterSection>

      {selectedCategory && subcategories.length > 0 ? (
        <FilterSection title="Nënkategoria">
          <div className="of-chip-list">
            <ToggleButton
              className="of-chip"
              isSelected={subcategoryId === 'all'}
              onChange={() => setSubcategoryId('all')}
            >
              Të gjitha
            </ToggleButton>
            {subcategories.map((subcategory) => (
              <ToggleButton
                key={subcategory._id}
                className="of-chip"
                isSelected={subcategoryId === subcategory._id}
                onChange={(selected) => setSubcategoryId(selected ? subcategory._id : 'all')}
              >
                {catalogLabel(subcategory)}
              </ToggleButton>
            ))}
          </div>
        </FilterSection>
      ) : null}

      <FilterSection title="Vlerësimi">
        <div className="of-chip-list">
          {RATING_FILTERS.map((item) => (
            <ToggleButton
              key={item.id || 'all'}
              className="of-chip"
              isSelected={minRating === item.id}
              onChange={() => setMinRating(item.id)}
            >
              {item.id ? <Star size={13} aria-hidden className="of-chip-star" /> : null}
              {item.label}
            </ToggleButton>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Mënyra e punës">
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
            Fizikisht
          </ToggleButton>
        </div>
      </FilterSection>

      {languages.length > 0 ? (
        <FilterSection title="Gjuha">
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

      <FilterSection title="Besueshmëria">
        <ToggleButton
          className="of-chip is-wide"
          isSelected={verification === 'verified'}
          onChange={(selected) => setVerification(selected ? 'verified' : 'all')}
        >
          <BadgeCheck size={15} aria-hidden />
          Vetëm profilet e verifikuara
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
              Provo përsëri
            </Button>
          )}
        />
      )
    }
    if (resultCount === 0) {
      return (
        <ResultsState
          icon={SearchX}
          title={hasActiveFilters ? 'Asnjë rezultat me këto filtra' : 'Ende nuk ka rezultate'}
          text={hasActiveFilters
            ? 'Provo të heqësh disa filtra ose të kërkosh me fjalë të tjera.'
            : cityId
              ? 'Nuk ka rezultate të publikuara në qytetin e zgjedhur.'
              : copy.empty}
          action={hasActiveFilters ? (
            <Button variant="primary" onPress={clearFilters}>Pastro filtrat</Button>
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
        aria-label="Rendit rezultatet"
      >
        {SORT_OPTIONS.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
      <ChevronDown size={15} aria-hidden className="of-sort-caret" />
    </label>
  )

  return (
    <div className="tt-shell">
      <SiteNav />

      <main className="of-page">
        <Tabs selectedKey={tab} onSelectionChange={onTabChange} className="of-tabs">
          <header className="of-head">
            <div className="of-inner">
              <h1 id="offers-heading">Ofertat</h1>
              <p className="of-lead">
                Zbulo shërbime, kompani dhe ekspertë në KëshillaKos. Krahaso sipas fushës, vlerësimeve dhe lokacionit,
                pastaj kontakto direkt.
              </p>
              <Tabs.ListContainer className="of-tabs-bar">
                <Tabs.List aria-label="Lloji i ofertave">
                  {TABS.map(({ id, label, icon: Icon }) => (
                    <Tabs.Tab key={id} id={id} className="of-tab">
                      <Icon size={16} aria-hidden className="of-tab-icon" />
                      {label}
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
                aria-label="Kërko oferta"
                value={query}
                onChange={setQuery}
                fullWidth
                className="of-search-field"
              >
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder={copy.placeholder} />
                  <SearchField.ClearButton aria-label="Pastro kërkimin" />
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
                Filtrat
                {sheetFilterCount > 0 ? <span className="of-badge">{sheetFilterCount}</span> : null}
              </Button>
            </div>

            <div className="of-layout">
              <aside className="of-sidebar" aria-label="Filtrat">
                <div className="of-sidebar-card">
                  <div className="of-sidebar-head">
                    <h2>
                      <SlidersHorizontal size={16} aria-hidden />
                      Filtrat
                    </h2>
                    {hasActiveFilters ? (
                      <button type="button" className="of-link-btn" onClick={clearFilters}>
                        Pastro
                      </button>
                    ) : null}
                  </div>
                  {filterSections}
                </div>
              </aside>

              <div className="of-results">
                <div className="of-results-head">
                  <p className="of-count" aria-live="polite">
                    {loading ? 'Duke kërkuar…' : (
                      <>
                        <strong>{resultCount}</strong> {resultLabel}
                        {cityName ? ` në ${cityName}` : ''}
                      </>
                    )}
                  </p>
                  {sortSelect}
                </div>

                {hasActiveFilters ? (
                  <div className="of-active-chips" aria-label="Filtrat aktivë">
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
                      Pastro të gjitha
                    </button>
                  </div>
                ) : null}

                {locationError ? <p className="of-inline-error" role="alert">{locationError}</p> : null}

                {TABS.map(({ id }) => (
                  <Tabs.Panel key={id} id={id} className="of-list">
                    {renderResults(id)}
                  </Tabs.Panel>
                ))}
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
                <Drawer.Title className="tt-offers-drawer-title">Filtrat</Drawer.Title>
                <button
                  type="button"
                  className="tt-offers-drawer-close"
                  aria-label="Mbyll"
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
                    Pastro
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
