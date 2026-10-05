import { pagedItems, type PageParams, type PaginationMeta } from './pagination'
import api from './auth'

export type ExpertItem = {
  id: string
  name: string
  title: string
  categoryId: string
  categoryLabel: string
  specialty: string
  bio: string
  location: string
  licenseNumber?: string
  licenseVerified: boolean
  languageFrom?: string
  languageTo?: string
  deliveryModes?: string[]
  crossBorder?: boolean
  companyUid: string
  companyName: string
  active: boolean
  createdAt: string
}

export async function createExpert(payload: {
  name: string
  title: string
  categoryId: string
  specialty: string
  bio: string
  location: string
  licenseNumber?: string
  languageFrom?: string
  languageTo?: string
  deliveryModes?: string[]
  crossBorder?: boolean
}) {
  const { data } = await api.post<{ expert: ExpertItem }>('/api/experts', payload)
  return data.expert
}

export async function fetchMyExperts(params: PageParams = {}) {
  const { data } = await api.get<{ experts: ExpertItem[]; pagination: PaginationMeta }>('/api/experts/mine', { params })
  return pagedItems(data.experts, data.pagination)
}

export async function fetchActiveExperts(params: PageParams = {}) {
  const { data } = await api.get<{ experts: ExpertItem[]; pagination: PaginationMeta }>('/api/experts', { params })
  return pagedItems(data.experts, data.pagination)
}
