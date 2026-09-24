import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapPin, Search, X } from 'lucide-react'
import { fetchActiveServices, type ServiceItem } from '../api/services'
import ServiceCard from '../components/ServiceCard'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import LocationSelector from '../components/LocationSelector'
import { useSavedLocation } from '../hooks/useSavedLocation'
import { getErrorMessage } from '../utils/errors'
import { filterVisibleServices, serviceDiscoveryRequest } from '../utils/serviceDiscovery'

const DELIVERY_FILTERS = [
  { id: 'all', label: 'Të gjitha' },
  { id: 'online', label: 'Online' },
  { id: 'physical', label: 'Fizikisht' },
] as const

type DeliveryFilter = (typeof DELIVERY_FILTERS)[number]['id']

function uniqueSorted(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, 'sq'))
}

export default function OffersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const catalogCategoryId = searchParams.get('categoryId') || undefined
  const catalogSubcategoryId = searchParams.get('subcategoryId') || undefined
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [category, setCategory] = useState('all')
  const [delivery, setDelivery] = useState<DeliveryFilter>('all')
  const [error, setError] = useState('')
  const { selectedLocation, changeLocation, locationLoading, locationSaving, locationError } = useSavedLocation()
  const cityId = selectedLocation?.city._id
  const cityName = selectedLocation?.city.name.sq

  useEffect(() => {
    if (locationLoading) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetchActiveServices({
      ...serviceDiscoveryRequest(cityId),
      categoryId: catalogCategoryId,
      subcategoryId: catalogSubcategoryId,
    }, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setServices(items)
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) { setServices([]); setError(getErrorMessage(err)) }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [cityId, locationLoading, catalogCategoryId, catalogSubcategoryId])

  const categories = useMemo(
    () =>
      uniqueSorted(services.map((s) => s.categoryLabel || s.category || s.categoryId)),
    [services],
  )

  const filtered = useMemo(() => filterVisibleServices(services, { query, category, delivery }), [services, query, category, delivery])

  const hasActiveFilters =
    query.trim().length > 0 || category !== 'all' || delivery !== 'all' || Boolean(catalogCategoryId || catalogSubcategoryId)

  function clearFilters() {
    setQuery('')
    setCategory('all')
    setDelivery('all')
    if (searchParams.has('q') || searchParams.has('categoryId') || searchParams.has('subcategoryId')) {
      setSearchParams({})
    }
  }

  return (
    <div className="tt-shell">
      <SiteNav />

      <main>
        <section className="tt-section tt-offers-page" aria-labelledby="offers-heading">
          <div className="tt-section-inner">
            <header className="tt-offers-intro">
              <h1 id="offers-heading">Ofruesit e gjetur</h1>
              <p>
                {loading
                  ? 'Duke kërkuar ofrues…'
                  : `${filtered.length} ${filtered.length === 1 ? 'ofrues' : 'ofrues'}${cityName ? ` në ${cityName}` : ''}`}
              </p>
            </header>

            <div className="tt-offers-bar">
              <label className="tt-offers-search">
                <Search size={18} aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Kërko shërbim ose ofrues…"
                  aria-label="Kërko oferta"
                />
                {query ? (
                  <button
                    type="button"
                    className="tt-offers-clear-q"
                    onClick={() => setQuery('')}
                    aria-label="Pastro kërkimin"
                  >
                    <X size={15} />
                  </button>
                ) : null}
              </label>
            </div>
            {locationError ? <p className="error" role="alert">{locationError}</p> : null}
            {error ? <p className="error" role="alert">{error}</p> : null}

            <div className="tt-results-layout">
              <aside className="tt-results-filters">
                <h2>Filtro</h2>

                <fieldset>
                  <legend>Mënyra e ofrimit</legend>
                  <div className="tt-offers-delivery" role="group" aria-label="Mënyra e ofrimit">
                    {DELIVERY_FILTERS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`tt-offers-pill${delivery === item.id ? ' is-active' : ''}`}
                        onClick={() => setDelivery(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {categories.length > 0 ? (
                  <fieldset>
                    <legend>Kategoria</legend>
                    <div className="tt-results-cats">
                      <button
                        type="button"
                        className={`tt-results-cat${category === 'all' ? ' is-active' : ''}`}
                        onClick={() => setCategory('all')}
                      >
                        Të gjitha
                      </button>
                      {categories.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`tt-results-cat${category === item ? ' is-active' : ''}`}
                          onClick={() => setCategory(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                <fieldset>
                  <legend>Lokacioni</legend>
                  <LocationSelector
                    value={selectedLocation}
                    onChange={(value) => { void changeLocation(value) }}
                    disabled={locationLoading || locationSaving}
                    className="tt-offers-location"
                  />
                </fieldset>

                {hasActiveFilters ? (
                  <button type="button" className="tt-offers-reset" onClick={clearFilters}>
                    Pastro filtrat
                  </button>
                ) : null}
              </aside>

              <div className="tt-results-list">
                {loading ? <p className="muted">Duke u ngarkuar…</p> : null}

                {!loading && services.length === 0 && !error ? (
                  <div className="tt-offers-empty">
                    <p>{cityId ? 'Nuk ka oferta të disponueshme në qytetin e zgjedhur.' : 'Ende nuk ka oferta të publikuara.'}</p>
                  </div>
                ) : null}

                {!loading && services.length > 0 && filtered.length === 0 ? (
                  <div className="tt-offers-empty">
                    <MapPin size={20} aria-hidden />
                    <p>Nuk u gjet asnjë ofrues me këto filtra.</p>
                    <button type="button" className="ghost" onClick={clearFilters}>
                      Pastro filtrat
                    </button>
                  </div>
                ) : null}

                {filtered.map((service) => (
                  <ServiceCard key={service.id} service={service} mode="compact" />
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
