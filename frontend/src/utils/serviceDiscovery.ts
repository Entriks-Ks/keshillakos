import type { MarketplaceProvider } from '../api/providerProfiles'
import type { ServiceItem, ServiceSearchParams } from '../api/services'

export type MarketplaceTab = 'experts' | 'companies'
export type MarketplaceSort = 'relevance' | 'newest' | 'rating' | 'reviews'
export type DeliveryFilter = 'all' | 'online' | 'physical'
export type VerificationFilter = 'all' | 'verified'
export type AvailabilityFilter = 'all' | 'slots' | 'request' | 'by_arrangement'

export type MarketplaceFilters = {
  query: string
  categoryId: string
  subcategoryId: string
  delivery: DeliveryFilter
  language: string
  priceMin: string
  priceMax: string
  minRating: string
  verification: VerificationFilter
  availability: AvailabilityFilter
}

export function serviceDiscoveryRequest(cityId?: string): ServiceSearchParams {
  return cityId ? { cityId } : {}
}

function isVerified(provider?: { verification?: { identity?: string; business?: string; qualification?: string } } | null) {
  const v = provider?.verification
  if (!v) return false
  return v.identity === 'verified' || v.business === 'verified' || v.qualification === 'verified'
}

function matchesQuery(haystack: Array<string | null | undefined>, query: string) {
  if (!query) return true
  return haystack.filter(Boolean).join(' ').toLowerCase().includes(query)
}

export function filterVisibleServices(services: ServiceItem[], filters: MarketplaceFilters) {
  const q = filters.query.trim().toLowerCase()
  const minPrice = filters.priceMin.trim() ? Number(filters.priceMin) : null
  const maxPrice = filters.priceMax.trim() ? Number(filters.priceMax) : null
  const minRating = filters.minRating.trim() ? Number(filters.minRating) : null

  return services.filter((service) => {
    if (filters.categoryId !== 'all') {
      const matchesCategory = service.categoryId === filters.categoryId
        || service.categoryLabel === filters.categoryId
        || service.category === filters.categoryId
      if (!matchesCategory) return false
    }
    if (filters.subcategoryId !== 'all') {
      const matchesSub = service.subcategoryId === filters.subcategoryId
        || service.subcategory === filters.subcategoryId
      if (!matchesSub) return false
    }
    if (filters.delivery !== 'all' && !(service.details?.deliveryModes || []).includes(filters.delivery)) return false
    if (filters.language !== 'all') {
      const langs = service.details?.supportLanguages || service.provider?.languages || []
      if (!langs.includes(filters.language)) return false
    }
    if (minPrice != null && !Number.isNaN(minPrice) && (service.priceFrom == null || service.priceFrom < minPrice)) return false
    if (maxPrice != null && !Number.isNaN(maxPrice)) {
      const top = service.details?.priceTo ?? service.priceFrom
      if (top == null || top > maxPrice) return false
    }
    if (minRating != null && !Number.isNaN(minRating) && (service.provider?.ratingAverage ?? 0) < minRating) return false
    if (filters.verification === 'verified' && !isVerified(service.provider)) return false
    if (filters.availability !== 'all' && service.details?.availabilityMode !== filters.availability) return false
    return matchesQuery([
      service.title,
      service.description,
      service.subcategory,
      service.categoryLabel,
      service.category,
      service.location,
      service.providerName,
      service.provider?.name,
      service.provider?.headline,
      service.responsibleExpert?.name,
    ], q)
  })
}

export function filterMarketplaceProviders(
  providers: MarketplaceProvider[],
  filters: MarketplaceFilters,
  tab: 'experts' | 'companies',
) {
  const q = filters.query.trim().toLowerCase()
  const minRating = filters.minRating.trim() ? Number(filters.minRating) : null
  const type = tab === 'experts' ? 'individual' : 'business'

  return providers.filter((provider) => {
    if (provider.providerType !== type) return false
    if (filters.categoryId !== 'all' && !provider.categories.includes(filters.categoryId)
      && !provider.categoryLabels.includes(filters.categoryId)) return false
    if (filters.delivery === 'online' && !provider.modes.includes('online')) return false
    if (filters.delivery === 'physical' && !provider.modes.includes('on_site')) return false
    if (filters.language !== 'all' && !provider.languages.includes(filters.language)) return false
    if (minRating != null && !Number.isNaN(minRating) && (provider.ratingAverage ?? 0) < minRating) return false
    if (filters.verification === 'verified' && !isVerified(provider)) return false
    return matchesQuery([
      provider.name,
      provider.title,
      provider.description,
      provider.location,
      ...provider.categoryLabels,
      ...provider.specializations,
      ...provider.languages,
    ], q)
  })
}

export function sortServices(services: ServiceItem[], sort: MarketplaceSort, query: string) {
  const q = query.trim().toLowerCase()
  const scored = [...services]
  scored.sort((a, b) => {
    if (sort === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    if (sort === 'rating') {
      return (b.provider?.ratingAverage ?? 0) - (a.provider?.ratingAverage ?? 0)
        || (b.provider?.ratingCount ?? 0) - (a.provider?.ratingCount ?? 0)
    }
    if (sort === 'reviews') {
      return (b.provider?.ratingCount ?? 0) - (a.provider?.ratingCount ?? 0)
        || (b.provider?.ratingAverage ?? 0) - (a.provider?.ratingAverage ?? 0)
    }
    if (!q) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    const score = (item: ServiceItem) => {
      const title = item.title.toLowerCase()
      const provider = (item.providerName || item.provider?.name || '').toLowerCase()
      if (title === q) return 3
      if (title.includes(q)) return 2
      if (provider.includes(q)) return 1
      return 0
    }
    return score(b) - score(a) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
  return scored
}

export function sortProviders(providers: MarketplaceProvider[], sort: MarketplaceSort, query: string) {
  const q = query.trim().toLowerCase()
  const scored = [...providers]
  scored.sort((a, b) => {
    if (sort === 'newest') {
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    }
    if (sort === 'rating') {
      return (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0)
    }
    if (sort === 'reviews') {
      return (b.ratingCount ?? 0) - (a.ratingCount ?? 0) || (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0)
    }
    if (!q) return (b.ratingCount ?? 0) - (a.ratingCount ?? 0)
    const score = (item: MarketplaceProvider) => {
      const name = item.name.toLowerCase()
      if (name === q) return 3
      if (name.includes(q)) return 2
      if ((item.title || '').toLowerCase().includes(q)) return 1
      return 0
    }
    return score(b) - score(a) || (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0)
  })
  return scored
}
