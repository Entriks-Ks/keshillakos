import axios from 'axios'
import { postPhotoUpload } from './media'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const api = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export type UserRole = 'user' | 'provider' | 'company' | 'admin'

export type AuthUser = {
  uid: string
  email: string
  phone?: string
  name: string
  firstName?: string
  lastName?: string
  role: UserRole
  roles?: UserRole[]
  requestedRole?: UserRole
  headline?: string
  bio?: string
  location?: string
  savedLocation?: { countryId: string; cityId: string }
  skills?: string[]
  languages?: string[]
  profilePhoto?: string
}

export type ProfileUpdatePayload = {
  firstName?: string
  lastName?: string
  headline?: string
  bio?: string
  location?: string
  skills?: string[]
  languages?: string[]
  savedLocation?: { countryId: string; cityId: string } | null
}

type AuthResponse = {
  token: string
  user: AuthUser
}

export { mediaUrl } from './media'

export async function registerUser(payload: {
  firstName: string
  lastName: string
  email: string
  password: string
}) {
  const { data } = await api.post<AuthResponse>('/api/auth/register', payload)
  return data
}

export async function loginUser(payload: { email: string; password: string }) {
  const { data } = await api.post<AuthResponse>('/api/auth/login', payload)
  return data
}

export async function loginWithGoogleToken(idToken: string) {
  const { data } = await api.post<AuthResponse>('/api/auth/google', { idToken })
  return data
}

export async function fetchMe() {
  const { data } = await api.get<{ user: AuthUser }>('/api/auth/me')
  return data.user
}

export async function updateProfile(payload: ProfileUpdatePayload) {
  const { data } = await api.patch<{ user: AuthUser }>('/api/auth/me', payload)
  return data.user
}

export async function uploadProfilePhoto(file: File) {
  const data = await postPhotoUpload<{ user: AuthUser }>(api, '/api/auth/me/photo', file)
  return data.user
}

export async function changePassword(payload: {
  currentPassword: string
  newPassword: string
}) {
  const { data } = await api.post<{ message: string; token: string }>(
    '/api/auth/change-password',
    payload,
  )
  return data
}

export async function requestRoleChange(role: 'provider' | 'company') {
  const { data } = await api.post<{ user: AuthUser }>('/api/auth/request-role', { role })
  return data.user
}

export default api
