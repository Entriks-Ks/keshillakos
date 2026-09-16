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
  deliveryModes?: Array<'online' | 'physical' | 'group'>
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
  deliveryModes?: Array<'online' | 'physical' | 'group'>
  crossBorder?: boolean
}) {
  const { data } = await api.post<{ expert: ExpertItem }>('/api/experts', payload)
  return data.expert
}

export async function fetchMyExperts() {
  const { data } = await api.get<{ experts: ExpertItem[] }>('/api/experts/mine')
  return data.experts
}

export async function fetchActiveExperts() {
  const { data } = await api.get<{ experts: ExpertItem[] }>('/api/experts')
  return data.experts
}
