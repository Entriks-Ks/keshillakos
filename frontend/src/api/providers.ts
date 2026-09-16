import api from './auth'
import type { ServiceItem } from './services'

export type PublicProvider = {
  uid: string
  name: string
  role: string
  roleLabel: string
  headline?: string
  bio?: string
  location?: string
  skills?: string[]
  languages?: string[]
  profilePhoto?: string
  ratingAverage: number
  ratingCount: number
}

export async function fetchProviderProfile(uid: string) {
  const { data } = await api.get<{ provider: PublicProvider; services: ServiceItem[] }>(
    `/api/providers/${uid}`,
  )
  return data
}
