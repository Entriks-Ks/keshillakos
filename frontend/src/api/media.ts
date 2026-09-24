import type { AxiosInstance } from 'axios'

/** Same base URL used by the API client — kept here so media URLs do not depend on auth. */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const MAX_SERVICE_PHOTOS = 8
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
export const IMAGE_ACCEPT_HINT = 'JPG, PNG, WEBP ose GIF · max 2MB'

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

/** Resolve a stored `/uploads/...` path (or absolute URL) for `<img src>`. */
export function mediaUrl(path?: string | null) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export function validateImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Ngarko vetëm foto (JPG, PNG, WEBP, GIF)')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Fotoja duhet të jetë më e vogël se 2MB')
  }
}

export function photoFormData(file: File) {
  validateImageFile(file)
  const form = new FormData()
  form.append('photo', file)
  return form
}

/** Shared multipart POST used by profile and service photo uploads. */
export async function postPhotoUpload<T>(client: AxiosInstance, endpoint: string, file: File) {
  const { data } = await client.post<T>(endpoint, photoFormData(file), {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
