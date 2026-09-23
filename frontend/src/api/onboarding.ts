import api, { type AuthUser } from './auth'
import type { SavedLocationIds } from './locations'
import type { BusinessProfile } from './businesses'

export async function becomeExpert(payload: {
  displayName: string
  title?: string
  description?: string
  categories: string[]
  languages?: string[]
  mode: 'online' | 'on_site'
  city?: string
  location?: SavedLocationIds
  serviceAreaCityIds?: string[]
}) {
  const { data } = await api.post<{ user: AuthUser }>('/api/onboarding/expert', payload)
  return data.user
}

export type CreateCompanyPayload = {
  publicName: string
  contactEmail: string
  contactPhone: string
  description: string
  categoryIds: string[]
  location: SavedLocationIds
  website?: string
  logoUrl?: string
  legalName?: string
  address?: string
}

export async function fetchOwnedCompany(signal?: AbortSignal) {
  const { data } = await api.get<{ business: BusinessProfile | null }>('/api/onboarding/company', { signal })
  return data.business
}

export async function createCompany(payload: CreateCompanyPayload) {
  const { data } = await api.post<{ user: AuthUser; business: BusinessProfile }>('/api/onboarding/company', payload)
  return data
}

export type BusinessSummary = { _id: string; publicName: string; status?: string }

export type TeamPerson = {
  id: string
  uid: string
  name: string
  email: string
  headline?: string
  photoUrl?: string
  categories?: string[]
  languages?: string[]
  profileStatus?: string | null
}

export type TeamInvitation = TeamPerson & {
  invitedAt: string
  status: 'pending'
}

export type BusinessTeam = {
  business: { id: string; publicName: string }
  owners: TeamPerson[]
  members: Array<TeamPerson & { role: 'manager' | 'member' }>
  invitations: TeamInvitation[]
}

export type MyBusinessInvitation = {
  id: string
  publicName: string
  invitedAt: string | null
  status: 'pending'
}

export async function fetchMyBusinesses() {
  const { data } = await api.get<{ businesses: BusinessSummary[] }>('/api/businesses/managed')
  return data.businesses
}

export async function fetchBusinessTeam(id: string) {
  const { data } = await api.get<{ team: BusinessTeam }>(`/api/businesses/${id}/team`)
  return data.team
}

export type ExpertLookup = {
  status: 'invalid' | 'missing' | 'not_expert' | 'ready' | 'member' | 'invited' | 'owner'
  person?: Pick<TeamPerson, 'id' | 'uid' | 'name' | 'email' | 'headline' | 'photoUrl'>
}

export async function lookupExpert(id: string, email: string) {
  const { data } = await api.get<{ match: ExpertLookup }>(`/api/businesses/${id}/expert-lookup`, {
    params: { email },
  })
  return data.match
}

export async function inviteExpert(id: string, email: string) {
  const { data } = await api.post<{ team: BusinessTeam }>(`/api/businesses/${id}/invitations`, { email })
  return data.team
}

export async function cancelInvitation(id: string, userId: string) {
  const { data } = await api.delete<{ team: BusinessTeam }>(
    `/api/businesses/${id}/invitations/${encodeURIComponent(userId)}`,
  )
  return data.team
}

export async function removeExpert(id: string, userId: string) {
  const { data } = await api.delete<{ team: BusinessTeam }>(`/api/businesses/${id}/members/${userId}`)
  return data.team
}

export async function fetchMyInvitations() {
  const { data } = await api.get<{ invitations: MyBusinessInvitation[] }>('/api/businesses/invitations/mine')
  return data.invitations
}

export async function acceptInvitation(id: string) {
  await api.post(`/api/businesses/${id}/invitations/accept`)
}

export async function rejectInvitation(id: string) {
  await api.post(`/api/businesses/${id}/invitations/reject`)
}
