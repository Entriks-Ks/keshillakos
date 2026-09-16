import axios from 'axios'

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
  name: string
  role: UserRole
  roles?: UserRole[]
  headline?: string
  bio?: string
  location?: string
  skills?: string[]
  languages?: string[]
  profilePhoto?: string
}

export type PublicRole = 'user' | 'provider' | 'company'

export type ProfileUpdatePayload = {
  name: string
  headline?: string
  bio?: string
  location?: string
  skills?: string[]
  languages?: string[]
}

type AuthResponse = {
  token: string
  user: AuthUser
}

export function mediaUrl(path?: string | null) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export async function registerUser(payload: {
  name: string
  email: string
  password: string
  role: PublicRole
}) {
  const { data } = await api.post<AuthResponse>('/api/auth/register', payload)
  return data
}

export async function loginUser(payload: { email: string; password: string }) {
  const { data } = await api.post<AuthResponse>('/api/auth/login', payload)
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
  const form = new FormData()
  form.append('photo', file)
  const { data } = await api.post<{ user: AuthUser }>('/api/auth/me/photo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
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

export default api
