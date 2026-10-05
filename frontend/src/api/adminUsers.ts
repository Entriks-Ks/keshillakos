import { pagedItems, type PageParams, type PaginationMeta } from './pagination'
import api, { type UserRole } from './auth'

export type AdminUser = {
  uid: string
  email: string
  name: string
  role: UserRole
  requestedRole?: UserRole
  createdAt: string
}

export type RoleMeta = {
  id: UserRole
  label: string
}

export async function fetchAdminUsersMeta() {
  const { data } = await api.get<{
    roles: RoleMeta[]
    counts: Record<UserRole, number>
  }>('/api/admin/users/meta')
  return data
}

export async function fetchAdminUsers(params?: PageParams & { role?: UserRole | '' }) {
  const { data } = await api.get<{ users: AdminUser[]; pagination: PaginationMeta }>('/api/admin/users', {
    params: {
      ...params,
      role: params?.role || undefined,
      q: params?.q || undefined,
    },
  })
  return pagedItems(data.users, data.pagination)
}

export async function createAdminUser(payload: {
  name: string
  email: string
  password: string
  role: UserRole
}) {
  const { data } = await api.post<{ user: AdminUser }>('/api/admin/users', payload)
  return data.user
}

export async function updateAdminUser(
  uid: string,
  payload: { name?: string; email?: string; role?: UserRole },
) {
  const { data } = await api.patch<{ user: AdminUser }>(`/api/admin/users/${uid}`, payload)
  return data.user
}

export async function fetchPendingRoleRequests(params: PageParams = {}) {
  const { data } = await api.get<{ users: AdminUser[]; pagination: PaginationMeta }>('/api/admin/users/role-requests', { params })
  return pagedItems(data.users, data.pagination)
}

export async function reviewRoleRequest(uid: string, action: 'accept' | 'reject') {
  const { data } = await api.post<{ user: AdminUser }>(`/api/admin/users/${uid}/role-request`, { action })
  return data.user
}

export async function deleteAdminUser(uid: string) {
  const { data } = await api.delete<{ ok: boolean }>(`/api/admin/users/${uid}`)
  return data
}
