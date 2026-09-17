import type { ServiceItem, ServiceSearchParams } from '../api/services'

export function serviceDiscoveryRequest(cityId?: string): ServiceSearchParams {
  return cityId ? { cityId } : {}
}

export function filterVisibleServices(services: ServiceItem[], filters: {
  query: string
  category: string
  delivery: 'all' | 'online' | 'physical'
}) {
  const q = filters.query.trim().toLowerCase()
  return services.filter((service) => {
    const categoryLabel = service.categoryLabel || service.category || ''
    if (filters.category !== 'all' && categoryLabel !== filters.category) return false
    if (filters.delivery !== 'all' && !(service.details?.deliveryModes || []).includes(filters.delivery)) return false
    if (!q) return true
    return [service.title, service.description, service.subcategory, categoryLabel,
      service.location, service.providerName, service.provider?.name, service.provider?.headline]
      .filter(Boolean).join(' ').toLowerCase().includes(q)
  })
}
