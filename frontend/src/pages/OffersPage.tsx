import { useEffect, useMemo, useState } from 'react'
import { Button, Input } from '@heroui/react'
import { MapPin, Search, X } from 'lucide-react'
import { fetchActiveServices, type ServiceItem } from '../api/services'
import ServiceCard from '../components/ServiceCard'
import SiteNav from '../components/SiteNav'

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
  const [location, setLocation] = useState('all')
  const [delivery, setDelivery] = useState<DeliveryFilter>('all')

  useEffect(() => {
    let cancelled = false
    fetchActiveServices()
      .then((items) => {
        if (!cancelled) setServices(items)
      })
      .catch(() => {
        if (!cancelled) setServices([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const categories = useMemo(
    () =>
      uniqueSorted(
        services.map((s) => s.categoryLabel || s.category || s.categoryId),
      ),
    [services],
  )

  const locations = useMemo(
    () => uniqueSorted(services.map((s) => s.location)),
    [services],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return services.filter((service) => {
      const categoryLabel = service.categoryLabel || service.category || ''
      if (category !== 'all' && categoryLabel !== category) return false
      if (location !== 'all' && service.location !== location) return false
      if (delivery !== 'all') {
        const modes = service.details?.deliveryModes || []
        if (!modes.includes(delivery)) return false
      }
      if (!q) return true
      const haystack = [
        service.title,
        service.description,
        service.subcategory,
        categoryLabel,
        service.location,
        service.providerName,
        service.provider?.name,
        service.provider?.headline,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [services, query, category, location, delivery])

  const hasActiveFilters =
    query.trim().length > 0 || category !== 'all' || location !== 'all' || delivery !== 'all'

  function clearFilters() {
    setQuery('')
    setCategory('all')
    setLocation('all')
    setDelivery('all')
  }

  return (
    <div className="tt-shell">
      <SiteNav />

      <main>
        <section className="tt-section tt-offers-page" aria-labelledby="offers-heading">
          <div className="tt-section-inner">
            <div className="tt-section-head tt-offers-head">
              <h1 id="offers-heading">Ofertat</h1>
              <p>Kërko dhe filtro ofruesit — pastaj shiko profilin ose dërgo mesazh.</p>
            </div>

            <div className="tt-offers-toolbar">
              <form
                className="tt-offers-search"
                onSubmit={(e) => e.preventDefault()}
                role="search"
              >
                <label className="tt-offers-search-field">
                  <Search size={18} aria-hidden />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Kërko ofertë, kategori ose ofrues..."
                    fullWidth
                    aria-label="Kërko oferta"
                  />
                </label>
                {query ? (
                  <button
                    type="button"
                    className="tt-offers-clear-q"
                    onClick={() => setQuery('')}
                    aria-label="Pastro kërkimin"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </form>

              <div className="tt-offers-filters">
                <label className="tt-offers-filter">
                  <span>Kategoria</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    aria-label="Filtro sipas kategorisë"
                  >
                    <option value="all">Të gjitha</option>
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="tt-offers-filter">
                  <span>
                    <MapPin size={13} aria-hidden /> Lokacioni
                  </span>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    aria-label="Filtro sipas lokacionit"
                  >
                    <option value="all">Të gjitha</option>
                    {locations.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

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

                {hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="tt-offers-reset"
                    onPress={clearFilters}
                  >
                    Pastro
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="tt-offers-meta">
              {!loading ? (
                <p>
                  <strong>{filtered.length}</strong>{' '}
                  {filtered.length === 1 ? 'ofertë' : 'oferta'}
                  {hasActiveFilters ? ' sipas filtrave' : ''}
                </p>
              ) : null}
            </div>

            {loading ? <p className="muted">Duke u ngarkuar...</p> : null}
            {!loading && services.length === 0 ? (
              <p className="muted">Ende nuk ka oferta të publikuara.</p>
            ) : null}
            {!loading && services.length > 0 && filtered.length === 0 ? (
              <div className="tt-offers-empty">
                <p>Nuk u gjet asnjë ofertë me këto filtra.</p>
                <Button type="button" variant="outline" size="sm" onPress={clearFilters}>
                  Pastro filtrat
                </Button>
              </div>
            ) : null}

            <div className="home-services-list tt-offers-grid">
              {filtered.map((service) => (
                <ServiceCard key={service.id} service={service} mode="compact" />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="tt-footer">
        <div className="tt-section-inner tt-footer-inner">
          <p className="brand">KëshillaKos</p>
          <p className="muted">Matching me ofrues profesionalë në Kosovë dhe online.</p>
        </div>
      </footer>
    </div>
  )
}
