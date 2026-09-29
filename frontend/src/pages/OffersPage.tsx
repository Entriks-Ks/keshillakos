import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Input, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import {
  ArrowUpDown,
  BadgeCheck,
  Building2,
  ChevronDown,
  Globe,
  Search,
  SearchX,
  SlidersHorizontal,
  Star,
  UserRound,
  X,
} from 'lucide-react'
import { Drawer } from 'vaul'
import {
  fetchCategories,
  fetchSubcategories,
  type CatalogCategory,
  type CatalogSubcategory,
} from '../api/catalog'
import { fetchMarketplaceProviders, type MarketplaceProvider } from '../api/providerProfiles'
import CompanyCard from '../components/CompanyCard'
import { isProviderVerified } from '../components/providerCardUtils'
import ExpertCard from '../components/ExpertCard'
import LocationSelector from '../components/LocationSelector'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import { useCatalogOptions } from '../hooks/useCatalogOptions'
import { useSavedLocation } from '../hooks/useSavedLocation'
import { getErrorMessage } from '../utils/errors'
import { withCategoryLabels } from '../utils/marketplaceProvider'
import {
  filterMarketplaceProviders,
  serviceDiscoveryRequest,
  sortProviders,
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
  if (value === 'experts') return 'experts'
  return 'companies'
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

function ResultSkeleton() {
  return (
    <div className="of-skeleton" aria-hidden>
      <div className="of-skeleton-row">
        <span className="of-skeleton-block is-avatar" />
        <div className="of-skeleton-lines">
          <span className="of-skeleton-block is-title" />
          <span className="of-skeleton-block is-line" />
          <span className="of-skeleton-block is-line is-short" />
        </div>
      </div>
      <span className="of-skeleton-block is-action" />
    </div>
  )
}

type ActiveChip = { key: string; label: string; clear: () => void }

export default function OffersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { languages } = useCatalogOptions()
  const [providers, setProviders] = useState<MarketplaceProvider[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [subcategories, setSubcategories] = useState<CatalogSubcategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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
    setLoading(true)
    setError('')
    fetchMarketplaceProviders(serviceDiscoveryRequest(cityId), controller.signal)
      .then((providerItems) => {
        if (!controller.signal.aborted) setProviders(providerItems)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setProviders([])
        setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [cityId, locationLoading])

  useEffect(() => {
    const next = new URLSearchParams()
    if (tab !== 'companies' || searchParams.has('tab')) next.set('tab', tab)
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
  const filteredExperts = useMemo(
    () => sortProviders(filterMarketplaceProviders(labeledProviders, filters, 'experts'), sort, query),
    [labeledProviders, filters, sort, query],
  )
  const filteredCompanies = useMemo(
    () => sortProviders(filterMarketplaceProviders(labeledProviders, filters, 'companies'), sort, query),
    [labeledProviders, filters, sort, query],
  )

  const results = tab === 'experts' ? filteredExperts : filteredCompanies
  const resultCount = results.length
  const resultLabel = tab === 'experts'
    ? (resultCount === 1 ? 'ekspert' : 'ekspertë')
    : 'kompani'

  const tabStats = useMemo(() => {
    const type = tab === 'experts' ? 'individual' : 'business'
    const ofType = providers.filter((item) => item.providerType === type)
    return {
      total: ofType.length,
      verified: ofType.filter(isProviderVerified).length,
      online: ofType.filter((item) => item.modes.includes('online')).length,
    }
  }, [providers, tab])

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

  function onEntityChange(keys: Set<string | number | bigint>) {
    const next = [...keys][0]
    if (next === 'experts' || next === 'companies') setTab(next)
  }

  const sortSelect = (
    <select
      value={sort}
      onChange={(e) => setSort(e.target.value as MarketplaceSort)}
      aria-label="Rendit rezultatet"
    >
      {SORT_OPTIONS.map((item) => (
        <option key={item.id} value={item.id}>{item.label}</option>
      ))}
    </select>
  )

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
              {item.id ? <Star size={14} aria-hidden className="of-chip-star" /> : null}
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
          <BadgeCheck size={16} aria-hidden />
          Vetëm profilet e verifikuara
        </ToggleButton>
      </FilterSection>
    </>
  )

  return (
    <div className="tt-shell">
      <SiteNav />

      <main className="of-page">
        <section className="of-hero" aria-labelledby="offers-heading">
          <div className="of-hero-inner">
            <p className="of-eyebrow">
              Ofertat · KëshillaKos
            </p>
            <h1 id="offers-heading">
              Gjej profesionistin e duhur, <span>pa humbur kohë.</span>
            </h1>
            <p className="of-hero-lead">
              Krahaso kompani dhe ekspertë sipas fushës, vlerësimeve dhe lokacionit — pastaj kontakto direkt.
            </p>

            <div className="of-searchbar" role="search">
              <div className="of-searchbar-field">
                <Search size={20} aria-hidden />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tab === 'experts'
                    ? 'Kërko ekspert, profesion ose specialitet…'
                    : 'Kërko kompani ose fushë…'}
                  aria-label="Kërko oferta"
                  fullWidth
                />
                {query ? (
                  <button
                    type="button"
                    className="of-searchbar-clear"
                    aria-label="Pastro kërkimin"
                    onClick={() => setQuery('')}
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
              <span className="of-searchbar-divider" aria-hidden />
              <div className="of-searchbar-location">
                <LocationSelector
                  value={selectedLocation}
                  onChange={(value) => { void changeLocation(value) }}
                  disabled={locationLoading || locationSaving}
                  className="tt-location-selector--hero of-location"
                />
              </div>
            </div>

            <ul className="of-hero-stats" aria-label="Përmbledhje">
              <li>
                {tab === 'experts' ? <UserRound size={16} aria-hidden /> : <Building2 size={16} aria-hidden />}
                <strong>{loading ? '—' : tabStats.total}</strong>
                {tab === 'experts' ? 'ekspertë' : 'kompani'}
              </li>
              <li>
                <BadgeCheck size={16} aria-hidden />
                <strong>{loading ? '—' : tabStats.verified}</strong>
                {tab === 'experts' ? 'të verifikuar' : 'të verifikuara'}
              </li>
              <li>
                <Globe size={16} aria-hidden />
                <strong>{loading ? '—' : tabStats.online}</strong>
                ofrojnë online
              </li>
            </ul>

          </div>
        </section>

        <section className="of-body">
          <div className="of-body-inner">
            <aside className="of-sidebar" aria-label="Filtrat">
              <div className="of-sidebar-card">
                <div className="of-sidebar-head">
                  <h2>
                    <SlidersHorizontal size={18} aria-hidden />
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
              <div className="tt-offers-filter-panel">
                <p className="tt-offers-filter-label">Filtro sipas</p>
                <ToggleButtonGroup
                  className="tt-offers-entity-switch"
                  selectionMode="single"
                  selectedKeys={new Set([tab])}
                  onSelectionChange={onEntityChange}
                  disallowEmptySelection
                  fullWidth
                  size="lg"
                  aria-label="Filtro sipas kompanive ose ekspertëve"
                >
                  <ToggleButton id="companies" className="tt-offers-entity-option">
                    <span>Kompani</span>
                    <span className="tt-offers-entity-icon" aria-hidden>
                      <Building2 size={18} />
                    </span>
                  </ToggleButton>
                  <ToggleButton id="experts" className="tt-offers-entity-option">
                    <span>Ekspertë</span>
                    <span className="tt-offers-entity-icon" aria-hidden>
                      <UserRound size={18} />
                    </span>
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>

              <p className="sr-only" aria-live="polite">
                {loading ? 'Duke kërkuar…' : `${resultCount} ${resultLabel}${cityName ? ` në ${cityName}` : ''}`}
              </p>

              <div className="of-toolbar">
                <label className="of-sort">
                  <ArrowUpDown size={16} aria-hidden />
                  {sortSelect}
                  <ChevronDown size={16} aria-hidden className="of-sort-caret" />
                </label>
              </div>

              <div className="of-mobile-bar">
                <label className="of-sort is-mobile">
                  <ArrowUpDown size={16} aria-hidden />
                  {sortSelect}
                  <ChevronDown size={16} aria-hidden className="of-sort-caret" />
                </label>
                <Button className="of-mobile-filter" onPress={() => setFiltersOpen(true)}>
                  <SlidersHorizontal size={16} aria-hidden />
                  Filtro
                  {sheetFilterCount > 0 ? <span className="of-badge">{sheetFilterCount}</span> : null}
                </Button>
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
                      <X size={14} aria-hidden />
                    </button>
                  ))}
                  <button type="button" className="of-link-btn" onClick={clearFilters}>
                    Pastro të gjitha
                  </button>
                </div>
              ) : null}

              {locationError ? <p className="error" role="alert">{locationError}</p> : null}
              {error ? <p className="error" role="alert">{error}</p> : null}

              <div className="of-list tt-results-list">
                {loading ? (
                  <>
                    <ResultSkeleton />
                    <ResultSkeleton />
                    <ResultSkeleton />
                  </>
                ) : null}

                {!loading && resultCount === 0 && !error ? (
                  <div className="of-empty">
                    <span className="of-empty-icon" aria-hidden>
                      <SearchX size={26} />
                    </span>
                    <h2>
                      {hasActiveFilters ? 'Asnjë rezultat me këto filtra' : 'Ende nuk ka rezultate'}
                    </h2>
                    <p>
                      {hasActiveFilters
                        ? 'Provo të heqësh disa filtra ose të kërkosh me fjalë të tjera.'
                        : cityId
                          ? 'Nuk ka rezultate të publikuara në qytetin e zgjedhur.'
                          : 'Profilet do të shfaqen këtu sapo të publikohen.'}
                    </p>
                    {hasActiveFilters ? (
                      <Button className="of-empty-action" onPress={clearFilters}>
                        Pastro filtrat
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {!loading && tab === 'experts'
                  ? filteredExperts.map((provider) => (
                    <ExpertCard key={provider.id} provider={provider} />
                  ))
                  : null}
                {!loading && tab === 'companies'
                  ? filteredCompanies.map((provider) => (
                    <CompanyCard key={provider.id} provider={provider} />
                  ))
                  : null}
              </div>
            </div>
          </div>
        </section>

        <Drawer.Root open={filtersOpen} onOpenChange={setFiltersOpen} repositionInputs={false}>
          <Drawer.Portal>
            <Drawer.Overlay className="tt-offers-drawer-overlay" />
            <Drawer.Content className="tt-offers-drawer-content" aria-describedby={undefined}>
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
