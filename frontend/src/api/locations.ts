import api from './auth'

export type LocationName = { sq: string; en: string }

export type LocationCountry = {
  _id: string
  name: LocationName
  slug: string
  order: number
  isActive: boolean
}

export type LocationCity = LocationCountry & { countryId: string }
export type LocationSelection = { city: LocationCity; country: LocationCountry }
export type SavedLocationIds = { countryId: string; cityId: string }

export function locationLabel(value: LocationSelection, language: 'sq' | 'en') {
  return `${value.city.name[language] || value.city.name.sq}, ${value.country.name[language] || value.country.name.sq}`
}

export async function matchLocationByText(text: string, signal?: AbortSignal): Promise<LocationSelection | null> {
  const needle = text.trim().toLowerCase()
  if (!needle) return null
  const countries = await fetchCountries(signal)
  const pairs = (await Promise.all(countries.filter((country) => country.isActive).map(async (country) => ({
    country,
    cities: await fetchCities(country.slug, signal),
  })))).flatMap(({ country, cities }) => cities.filter((city) => city.isActive).map((city) => ({ country, city })))
  const cityToken = needle.split(/[,/·-]/)[0]?.trim() || needle
  return pairs.find((item) => {
    const names = [item.city.name.sq, item.city.name.en, locationLabel(item, 'sq'), locationLabel(item, 'en')]
      .map((name) => name.toLowerCase())
    return names.includes(needle) || names.includes(cityToken) || names.some((name) => name.startsWith(cityToken) || cityToken.startsWith(name))
  }) ?? null
}

export async function fetchCountries(signal?: AbortSignal) {
  const { data } = await api.get<{ countries: LocationCountry[] }>('/api/v1/countries', { signal })
  return data.countries
}

export async function fetchCities(countrySlug: string, signal?: AbortSignal) {
  const { data } = await api.get<{ cities: LocationCity[] }>(
    `/api/v1/countries/${encodeURIComponent(countrySlug)}/cities`,
    { signal },
  )
  return data.cities
}

export async function resolveSavedLocation(ids: SavedLocationIds, signal?: AbortSignal): Promise<LocationSelection | null> {
  const countries = await fetchCountries(signal)
  const country = countries.find((item) => item._id === ids.countryId)
  if (!country) return null
  const cities = await fetchCities(country.slug, signal)
  const city = cities.find((item) => item._id === ids.cityId)
  return city ? { country, city } : null
}

export async function resolveProviderLocations(ids: { location?: SavedLocationIds; serviceAreaCityIds: string[] }, signal?: AbortSignal) {
  if (!ids.location && !ids.serviceAreaCityIds.length) return { location: null, serviceAreas: [] as LocationSelection[] }
  const countries = await fetchCountries(signal)
  const pairs = (await Promise.all(countries.map(async (country) => ({ country, cities: await fetchCities(country.slug, signal) }))))
    .flatMap(({ country, cities }) => cities.map((city) => ({ country, city })))
  return {
    location: pairs.find((item) => item.country._id === ids.location?.countryId && item.city._id === ids.location.cityId) ?? null,
    serviceAreas: ids.serviceAreaCityIds.flatMap((id) => pairs.filter((item) => item.city._id === id)),
  }
}
