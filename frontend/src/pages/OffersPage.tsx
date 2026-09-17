import { useEffect, useMemo, useState } from 'react'
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
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [delivery, setDelivery] = useState<DeliveryFilter>('all')
  const [error, setError] = useState('')
  const { selectedLocation, changeLocation, locationLoading, locationSaving, locationError } = useSavedLocation()
  const cityId = selectedLocation?.city._id

  useEffect(() => {
    if (locationLoading) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetchActiveServices(serviceDiscoveryRequest(cityId), controller.signal)
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
  }, [cityId, locationLoading])

  const categories = useMemo(
    () =>
      uniqueSorted(services.map((s) => s.categoryLabel || s.category || s.categoryId)),
    [services],
  )

  const filtered = useMemo(() => filterVisibleServices(services, { query, category, delivery }), [services, query, category, delivery])

  const hasActiveFilters =
    query.trim().length > 0 || category !== 'all' || delivery !== 'all'

  function clearFilters() {
    setQuery('')
    setCategory('all')
    setDelivery('all')
  }

  return (
    <div className="tt-shell">
      <SiteNav />

      <main>
        <section className="tt-section tt-offers-page" aria-labelledby="offers-heading">
          <div className="tt-section-inner">
            <header className="tt-offers-intro">
              <h1 id="offers-heading">Ofertat</h1>
              <p>Gjej shërbimin, shiko profilin dhe dërgo kërkesë me një hap.</p>
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

              <div className="tt-offers-row">
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

                <select
                  className="tt-offers-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-label="Kategoria"
                >
                  <option value="all">Kategoria</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <LocationSelector value={selectedLocation} onChange={(value) => { void changeLocation(value) }} disabled={locationLoading || locationSaving} className="tt-offers-location" />

                {hasActiveFilters ? (
                  <button type="button" className="tt-offers-reset" onClick={clearFilters}>
                    Pastro
                  </button>
                ) : null}
              </div>
            </div>
            {locationError ? <p className="error" role="alert">{locationError}</p> : null}
            {error ? <p className="error" role="alert">{error}</p> : null}

            <div className="tt-offers-meta">
              {!loading ? (
                <p>
                  {filtered.length === 0
                    ? 'Asnjë rezultat'
                    : `${filtered.length} ${filtered.length === 1 ? 'ofertë' : 'oferta'}`}
                </p>
              ) : null}
            </div>

            {loading ? <p className="muted">Duke u ngarkuar…</p> : null}

            {!loading && services.length === 0 && !error ? (
              <div className="tt-offers-empty">
                <p>{cityId ? 'Nuk ka oferta të disponueshme në qytetin e zgjedhur.' : 'Ende nuk ka oferta të publikuara.'}</p>
              </div>
            ) : null}

            {!loading && services.length > 0 && filtered.length === 0 ? (
              <div className="tt-offers-empty">
                <MapPin size={20} aria-hidden />
                <p>Nuk u gjet asnjë ofertë me këto filtra.</p>
                <button type="button" className="ghost" onClick={clearFilters}>
                  Pastro filtrat
                </button>
              </div>
            ) : null}

            <div className="tt-offers-grid">
              {filtered.map((service) => (
                <ServiceCard key={service.id} service={service} mode="compact" />
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
