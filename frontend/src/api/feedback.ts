import { pagedItems, type PageParams, type PaginationMeta } from './pagination'
import api from './auth'

export type PlatformFeedbackItem = {
  id: string
  message: string
  name: string
  email: string
  userUid: string
  status: 'new' | 'read'
  createdAt: string
}

export async function submitPlatformFeedback(payload: { message: string; name?: string; email?: string }) {
  const { data } = await api.post<{ feedback: PlatformFeedbackItem }>('/api/feedback', payload)
  return data.feedback
}

export async function fetchPlatformFeedback(params: PageParams = {}) {
  const { data } = await api.get<{ feedback: PlatformFeedbackItem[]; pagination: PaginationMeta; unreadTotal: number }>('/api/feedback', { params })
  return pagedItems(data.feedback, data.pagination, { unread: data.unreadTotal })
}

export async function markPlatformFeedbackRead(id: string) {
  const { data } = await api.patch<{ feedback: PlatformFeedbackItem }>(`/api/feedback/${id}/read`)
  return data.feedback
}

export type UserReportItem = {
  id: string; status: 'new' | 'reviewing' | 'resolved' | 'dismissed'; createdAt: string
  reason: string; adminNote: string; serviceTitle: string
  reporter: { name: string; profilePhoto: string }
  reported: { name: string; profilePhoto: string; role: string }
  requestContext?: { title: string; status: string } | null
}
export async function fetchUserReports(params: PageParams = {}) {
  const { data } = await api.get<{ reports: UserReportItem[]; pagination: PaginationMeta }>('/api/feedback/reports', { params })
  return pagedItems(data.reports, data.pagination)
}
export async function fetchUserReport(id: string) {
  const { data } = await api.get<{ report: UserReportItem }>(`/api/feedback/reports/${id}`)
  return data.report
}
export async function updateUserReportStatus(id: string, status: 'reviewing' | 'resolved' | 'dismissed') {
  const { data } = await api.patch<{ report: UserReportItem }>(`/api/feedback/reports/${id}/status`, { status })
  return data.report
}
