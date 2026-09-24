import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Button,
  Dropdown,
  Header,
  Input,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react'
import { Building2, ChevronDown, MapPin, Search, SlidersHorizontal, UserRound, X } from 'lucide-react'
import { Drawer } from 'vaul'
import {
  fetchCategories,
  fetchSubcategories,
  type CatalogCategory,
  type CatalogSubcategory,
} from '../api/catalog'
import { fetchMarketplaceProviders, type MarketplaceProvider } from '../api/providerProfiles'
import {
  fetchCities,
  fetchCountries,
  locationLabel,
  type LocationSelection,
} from '../api/locations'
import CompanyCard from '../components/CompanyCard'
import ExpertCard from '../components/ExpertCard'
import LocationSelector from '../components/LocationSelector'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import { useCatalogOptions } from '../hooks/useCatalogOptions'
import { useSavedLocation } from '../hooks/useSavedLocation'
import { getErrorMessage } from '../utils/errors'
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

const SORT_OPTIONS: Array<{ id: MarketplaceSort; label: string }> = [
  { id: 'relevance', label: 'Relevanca' },
  { id: 'newest', label: 'Më të rejat' },
  { id: 'rating', label: 'Vlerësimi më i lartë' },
  { id: 'reviews', label: 'Më të vlerësuarat' },
]

const RATING_FILTERS = [
  { id: 'all', label: 'Të gjitha' },
  { id: '4', label: '4+ yje' },
  { id: '4.5', label: '4.5+ yje' },
]

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

function pillLabel(active: boolean, base: string, value?: string) {
  if (!active || !value) return base
  return `${base}: ${value}`
}

export default function OffersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { languages } = useCatalogOptions()
  const [providers, setProviders] = useState<MarketplaceProvider[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [subcategories, setSubcategories] = useState<CatalogSubcategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<MarketplaceTab>(() => parseTab(searchParams.get('tab')))
  const [sort, setSort] = useState<MarketplaceSort>(() => parseSort(searchParams.get('sort')))
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || 'all')
  const [subcategoryId, setSubcategoryId] = useState(searchParams.get('subcategoryId') || 'all')
  const [delivery, setDelivery] = useState<DeliveryFilter>('all')
  const [language, setLanguage] = useState('all')
  const [minRating, setMinRating] = useState('')
  const [verification, setVerification] = useState<VerificationFilter>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sheetLocations, setSheetLocations] = useState<LocationSelection[]>([])
  const [sheetLocationsStatus, setSheetLocationsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
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
    if (!filtersOpen) return
    if (sheetLocations.length > 0) {
      setSheetLocationsStatus('ready')
      return
    }
    const controller = new AbortController()
    setSheetLocationsStatus('loading')
    fetchCountries(controller.signal)
      .then(async (countries) => {
        const active = countries.filter((country) => country.isActive).sort((a, b) => a.order - b.order)
        const groups = await Promise.all(active.map(async (country) => ({
          country,
          cities: await fetchCities(country.slug, controller.signal),
        })))
        if (controller.signal.aborted) return
        setSheetLocations(groups.flatMap(({ country, cities }) => cities
          .filter((city) => city.isActive)
          .sort((a, b) => a.order - b.order)
          .map((city) => ({ city, country }))))
        setSheetLocationsStatus('ready')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setSheetLocations([])
        setSheetLocationsStatus('error')
      })
    return () => controller.abort()
  }, [filtersOpen, sheetLocations.length])

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
    if (tab !== 'companies') next.set('tab', tab)
    if (sort !== 'relevance') next.set('sort', sort)
    if (query.trim()) next.set('q', query.trim())
    if (categoryId !== 'all') next.set('categoryId', categoryId)
    if (subcategoryId !== 'all') next.set('subcategoryId', subcategoryId)
    const upcoming = next.toString()
    if (searchParams.toString() !== upcoming) setSearchParams(next, { replace: true })
  }, [tab, sort, query, categoryId, subcategoryId, setSearchParams])

  const filteredExperts = useMemo(
    () => sortProviders(filterMarketplaceProviders(providers, filters, 'experts'), sort, query),
    [providers, filters, sort, query],
  )
  const filteredCompanies = useMemo(
    () => sortProviders(filterMarketplaceProviders(providers, filters, 'companies'), sort, query),
    [providers, filters, sort, query],
  )

  const results = tab === 'experts' ? filteredExperts : filteredCompanies
  const resultCount = results.length
  const resultLabel = tab === 'experts'
    ? (resultCount === 1 ? 'ekspert' : 'ekspertë')
    : (resultCount === 1 ? 'kompani' : 'kompani')

  const verifiedCount = useMemo(
    () => providers.filter((item) => {
      const v = item.verification
      return v && (v.identity === 'verified' || v.business === 'verified' || v.qualification === 'verified')
        && item.providerType === (tab === 'experts' ? 'individual' : 'business')
    }).length,
    [providers, tab],
  )

  const hasActiveFilters = Boolean(
    query.trim()
    || categoryId !== 'all'
    || subcategoryId !== 'all'
    || delivery !== 'all'
    || language !== 'all'
    || minRating
    || verification !== 'all'
    || Boolean(cityId),
  )

  const categoryPillValue = selectedCategory
    ? (selectedSubcategory ? `${catalogLabel(selectedCategory)} · ${catalogLabel(selectedSubcategory)}` : catalogLabel(selectedCategory))
    : undefined
  const ratingPillValue = minRating
    ? RATING_FILTERS.find((item) => item.id === minRating)?.label
    : undefined
  const moreActiveCount = [
    language !== 'all',
    subcategoryId !== 'all' && Boolean(selectedCategory),
    Boolean(cityId),
  ].filter(Boolean).length

  const sheetLocationOptions = useMemo(() => {
    if (!selectedLocation) return sheetLocations
    if (sheetLocations.some((item) => item.city._id === selectedLocation.city._id)) return sheetLocations
    return [selectedLocation, ...sheetLocations]
  }, [selectedLocation, sheetLocations])

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

  function onSheetLocationChange(nextCityId: string) {
    if (!nextCityId) {
      void changeLocation(null)
      return
    }
    const next = sheetLocationOptions.find((item) => item.city._id === nextCityId) ?? null
    void changeLocation(next)
  }

  const filterForm = (
    <>
      <label className="tt-offers-sheet-field">
        <span>Kategoria</span>
        <select
          className="tt-offers-select"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
            setSubcategoryId('all')
          }}
        >
          <option value="all">Të gjitha</option>
          {categories.map((category) => (
            <option key={category._id} value={category._id}>
              {catalogLabel(category)}
            </option>
          ))}
        </select>
      </label>

      <label className="tt-offers-sheet-field">
        <span>Vlerësimet</span>
        <select
          className="tt-offers-select"
          value={minRating || 'all'}
          onChange={(e) => setMinRating(e.target.value === 'all' ? '' : e.target.value)}
        >
          {RATING_FILTERS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>

      <label className="tt-offers-sheet-field">
        <span>Lokacioni</span>
        <select
          className="tt-offers-select"
          value={cityId || ''}
          onChange={(e) => onSheetLocationChange(e.target.value)}
          disabled={locationLoading || locationSaving || sheetLocationsStatus === 'loading'}
          data-vaul-no-drag=""
        >
          <option value="">
            {sheetLocationsStatus === 'loading'
              ? 'Duke ngarkuar…'
              : sheetLocationsStatus === 'error'
                ? 'Nuk u ngarkuan lokacionet'
                : 'Të gjitha'}
          </option>
          {sheetLocationOptions.map((item) => (
            <option key={item.city._id} value={item.city._id}>
              {locationLabel(item, 'sq')}
            </option>
          ))}
        </select>
      </label>

      {selectedCategory && subcategories.length > 0 ? (
        <label className="tt-offers-sheet-field">
          <span>Nënkategoria</span>
          <select
            className="tt-offers-select"
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
          >
            <option value="all">Të gjitha</option>
            {subcategories.map((subcategory) => (
              <option key={subcategory._id} value={subcategory._id}>
                {catalogLabel(subcategory)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {languages.length > 0 ? (
        <label className="tt-offers-sheet-field">
          <span>Gjuhët</span>
          <select
            className="tt-offers-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="all">Të gjitha</option>
            {languages.map((item) => (
              <option key={item.id} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="tt-offers-sheet-toggles" role="group" aria-label="Filtra shtesë">
        <ToggleButton
          isSelected={delivery === 'online'}
          onChange={(selected) => setDelivery(selected ? 'online' : 'all')}
          className="tt-offers-filter-pill"
        >
          Online
        </ToggleButton>
        <ToggleButton
          isSelected={delivery === 'physical'}
          onChange={(selected) => setDelivery(selected ? 'physical' : 'all')}
          className="tt-offers-filter-pill"
        >
          Fizikisht
        </ToggleButton>
        <ToggleButton
          isSelected={verification === 'verified'}
          onChange={(selected) => setVerification(selected ? 'verified' : 'all')}
          className="tt-offers-filter-pill"
        >
          Të verifikuara
        </ToggleButton>
      </div>
    </>
  )

  return (
    <div className="tt-shell">
      <SiteNav />

      <main>
        <section className="tt-section tt-offers-page" aria-labelledby="offers-heading">
          <div className="tt-section-inner">
            <header className="tt-offers-intro">
              <h1 id="offers-heading">Ofertat</h1>
              <p>
                {loading
                  ? 'Duke kërkuar…'
                  : `${resultCount} ${resultLabel}${cityName ? ` në ${cityName}` : ''}`}
              </p>
            </header>

            <div className="tt-offers-bar">
              <div className="tt-offers-search">
                <Search size={18} aria-hidden />
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    className="tt-offers-clear-q"
                    aria-label="Pastro kërkimin"
                    onPress={() => setQuery('')}
                  >
                    <X size={15} />
                  </Button>
                ) : null}
              </div>

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

              {verifiedCount > 0 ? (
                <div className="tt-offers-context-banner" role="note">
                  <span className="tt-offers-context-badge" aria-hidden>
                    ✓
                  </span>
                  <div>
                    <strong>
                      {tab === 'companies'
                        ? `${verifiedCount} kompani të verifikuara`
                        : `${verifiedCount} ekspertë të verifikuar`}
                    </strong>
                    <p>
                      Statusi i verifikimit merret nga profili publik dhe përditësohet automatikisht.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="tt-offers-mobile-tools">
                <label className="tt-offers-mobile-tool">
                  <span>Rendit</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as MarketplaceSort)}
                    aria-label="Rendit rezultatet"
                  >
                    {SORT_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} aria-hidden />
                </label>
                <Button
                  variant="outline"
                  className={`tt-offers-mobile-tool-btn${hasActiveFilters ? ' is-active' : ''}`}
                  onPress={() => setFiltersOpen(true)}
                >
                  <SlidersHorizontal size={16} aria-hidden />
                  Filtro
                </Button>
              </div>

              <Drawer.Root open={filtersOpen} onOpenChange={setFiltersOpen} repositionInputs={false}>
                <Drawer.Portal>
                  <Drawer.Overlay className="tt-offers-drawer-overlay" />
                  <Drawer.Content className="tt-offers-drawer-content" aria-describedby={undefined}>
                    <div className="tt-offers-drawer-handle" aria-hidden />
                    <div className="tt-offers-drawer-head">
                      <Drawer.Title className="tt-offers-drawer-title">Filtro</Drawer.Title>
                      <button
                        type="button"
                        className="tt-offers-drawer-close"
                        aria-label="Mbyll"
                        onClick={() => setFiltersOpen(false)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="tt-offers-drawer-body">
                      {filterForm}
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

              <div className="tt-offers-advanced" aria-label="Filtra të avancuara">
                <Dropdown>
                  <Dropdown.Trigger>
                    <Button
                      variant="outline"
                      className={`tt-offers-filter-pill${categoryId !== 'all' ? ' is-active' : ''}`}
                    >
                      {pillLabel(categoryId !== 'all', 'Kategoria', categoryPillValue)}
                      <ChevronDown size={16} aria-hidden />
                    </Button>
                  </Dropdown.Trigger>
                  <Dropdown.Popover placement="bottom start" className="tt-offers-filter-popover">
                    <Dropdown.Menu
                      aria-label="Kategoria"
                      selectionMode="single"
                      selectedKeys={new Set([categoryId])}
                      onSelectionChange={(keys) => {
                        const next = String([...keys][0] ?? 'all')
                        setCategoryId(next)
                        setSubcategoryId('all')
                      }}
                    >
                      <Dropdown.Item id="all" textValue="Të gjitha">
                        Të gjitha
                        <Dropdown.ItemIndicator />
                      </Dropdown.Item>
                      {categories.map((category) => (
                        <Dropdown.Item key={category._id} id={category._id} textValue={catalogLabel(category)}>
                          {catalogLabel(category)}
                          <Dropdown.ItemIndicator />
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>

                <Dropdown>
                  <Dropdown.Trigger>
                    <Button
                      variant="outline"
                      className={`tt-offers-filter-pill${minRating ? ' is-active' : ''}`}
                    >
                      {pillLabel(Boolean(minRating), 'Vlerësimet', ratingPillValue)}
                      <ChevronDown size={16} aria-hidden />
                    </Button>
                  </Dropdown.Trigger>
                  <Dropdown.Popover placement="bottom start" className="tt-offers-filter-popover">
                    <Dropdown.Menu
                      aria-label="Vlerësimet"
                      selectionMode="single"
                      selectedKeys={new Set([minRating || 'all'])}
                      onSelectionChange={(keys) => {
                        const next = String([...keys][0] ?? 'all')
                        setMinRating(next === 'all' ? '' : next)
                      }}
                    >
                      {RATING_FILTERS.map((item) => (
                        <Dropdown.Item key={item.id} id={item.id} textValue={item.label}>
                          {item.label}
                          <Dropdown.ItemIndicator />
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>

                <Dropdown>
                  <Dropdown.Trigger>
                    <Button
                      variant="outline"
                      className={`tt-offers-filter-pill${moreActiveCount > 0 ? ' is-active' : ''}`}
                    >
                      {moreActiveCount > 0 ? `Më shumë filtra (${moreActiveCount})` : 'Më shumë filtra'}
                      <ChevronDown size={16} aria-hidden />
                    </Button>
                  </Dropdown.Trigger>
                  <Dropdown.Popover placement="bottom start" className="tt-offers-filter-popover is-wide">
                    <div className="tt-offers-more-panel">
                      <Header>Lokacioni</Header>
                      <LocationSelector
                        value={selectedLocation}
                        onChange={(value) => { void changeLocation(value) }}
                        disabled={locationLoading || locationSaving}
                        className="tt-offers-location"
                      />

                      {selectedCategory && subcategories.length > 0 ? (
                        <>
                          <Header>Nënkategoria</Header>
                          <select
                            className="tt-offers-select"
                            value={subcategoryId}
                            onChange={(e) => setSubcategoryId(e.target.value)}
                          >
                            <option value="all">Të gjitha</option>
                            {subcategories.map((subcategory) => (
                              <option key={subcategory._id} value={subcategory._id}>
                                {catalogLabel(subcategory)}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : null}

                      {languages.length > 0 ? (
                        <>
                          <Header>Gjuhët</Header>
                          <select
                            className="tt-offers-select"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                          >
                            <option value="all">Të gjitha</option>
                            {languages.map((item) => (
                              <option key={item.id} value={item.value}>{item.label}</option>
                            ))}
                          </select>
                        </>
                      ) : null}
                    </div>
                  </Dropdown.Popover>
                </Dropdown>

                <ToggleButton
                  isSelected={delivery === 'online'}
                  onChange={(selected) => setDelivery(selected ? 'online' : 'all')}
                  className="tt-offers-filter-pill"
                >
                  Online
                </ToggleButton>

                <ToggleButton
                  isSelected={delivery === 'physical'}
                  onChange={(selected) => setDelivery(selected ? 'physical' : 'all')}
                  className="tt-offers-filter-pill"
                >
                  Fizikisht
                </ToggleButton>

                <ToggleButton
                  isSelected={verification === 'verified'}
                  onChange={(selected) => setVerification(selected ? 'verified' : 'all')}
                  className="tt-offers-filter-pill"
                >
                  Të verifikuara
                </ToggleButton>

                {hasActiveFilters ? (
                  <Button variant="ghost" className="tt-offers-reset-inline" onPress={clearFilters}>
                    Pastro
                  </Button>
                ) : null}
              </div>
            </div>

            {locationError ? <p className="error" role="alert">{locationError}</p> : null}
            {error ? <p className="error" role="alert">{error}</p> : null}

            <div className="tt-offers-results">
              <div className="tt-offers-toolbar">
                <p className="tt-offers-meta-count">
                  {loading ? 'Duke u ngarkuar…' : `${resultCount} ${resultLabel}`}
                </p>
                <label className="tt-offers-sort">
                  <span>Rendit</span>
                  <select
                    className="tt-offers-select"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as MarketplaceSort)}
                  >
                    {SORT_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="tt-results-list">
                {!loading && resultCount === 0 && !error ? (
                  <div className="tt-offers-empty">
                    <MapPin size={20} aria-hidden />
                    <p>
                      {hasActiveFilters
                        ? 'Nuk u gjet asnjë rezultat me këto filtra.'
                        : cityId
                          ? 'Nuk ka rezultate të disponueshme në qytetin e zgjedhur.'
                          : 'Ende nuk ka rezultate të publikuara.'}
                    </p>
                    {hasActiveFilters ? (
                      <Button variant="outline" onPress={clearFilters}>
                        Pastro filtrat
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {tab === 'experts'
                  ? filteredExperts.map((provider) => (
                    <ExpertCard key={provider.id} provider={provider} />
                  ))
                  : filteredCompanies.map((provider) => (
                    <CompanyCard key={provider.id} provider={provider} />
                  ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
