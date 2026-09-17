import api from './auth'
import type { SavedLocationIds } from './locations'

export type ManagedProviderProfile = {
  _id: string
  providerType: 'individual' | 'business'
  publicProfile: { displayName: string }
  location?: SavedLocationIds
  serviceAreaCityIds?: string[]
}

export async function fetchMyProviderProfiles(signal?: AbortSignal) {
  const { data } = await api.get<{ providers: ManagedProviderProfile[] }>('/api/providers/mine', { signal })
  return data.providers
}

export async function updateProviderLocations(id: string, values: { location: SavedLocationIds | null; serviceAreaCityIds: string[] }) {
  const { data } = await api.patch<{ provider: ManagedProviderProfile }>(`/api/providers/${encodeURIComponent(id)}`, values)
  return data.provider
}
