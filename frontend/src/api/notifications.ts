import { API_BASE_URL } from './auth'
export type AppNotification = { id: string; type: string; title: string; body: string; href: string; readAt: string | null; createdAt: string }
export type NotificationPage = { notifications: AppNotification[]; unreadCount: number; page: number; hasMore: boolean }
export async function notificationRequest<T>(path = '', method = 'GET', signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/notifications${path}`, {
    method, signal, headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
  })
  if (!response.ok) throw new Error('Njoftimet nuk u ngarkuan')
  return response.json()
}
