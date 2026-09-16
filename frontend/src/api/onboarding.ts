import api, { type AuthUser } from './auth'

export async function becomeExpert(payload: {
  displayName: string
  title?: string
  description?: string
  categories: string[]
  languages?: string[]
  mode: 'online' | 'on_site'
  city?: string
}) {
  const { data } = await api.post<{ user: AuthUser }>('/api/onboarding/expert', payload)
  return data.user
}

export async function createCompany(payload: { publicName: string; legalName?: string }) {
  const { data } = await api.post<{ user: AuthUser }>('/api/onboarding/company', payload)
  return data.user
}

export type BusinessSummary = { _id: string; publicName: string }
export type TeamPerson = { id: string; name: string; email: string }
export type BusinessTeam = {
  business: { id: string; publicName: string }
  owners: TeamPerson[]
  members: Array<TeamPerson & { role: 'manager' | 'member' }>
  invitations: Array<TeamPerson & { invitedAt: string }>
}

export async function fetchMyBusinesses() {
  const { data } = await api.get<{ businesses: BusinessSummary[] }>('/api/businesses/managed')
  return data.businesses
}

export async function fetchBusinessTeam(id: string) {
  const { data } = await api.get<{ team: BusinessTeam }>(`/api/businesses/${id}/team`)
  return data.team
}

export async function inviteExpert(id: string, email: string) {
  const { data } = await api.post<{ team: BusinessTeam }>(`/api/businesses/${id}/invitations`, { email })
  return data.team
}

export async function removeExpert(id: string, userId: string) {
  const { data } = await api.delete<{ team: BusinessTeam }>(`/api/businesses/${id}/members/${userId}`)
  return data.team
}

export async function fetchMyInvitations() {
  const { data } = await api.get<{ invitations: Array<{ id: string; publicName: string }> }>('/api/businesses/invitations/mine')
  return data.invitations
}

export async function acceptInvitation(id: string) {
  await api.post(`/api/businesses/${id}/invitations/accept`)
}
