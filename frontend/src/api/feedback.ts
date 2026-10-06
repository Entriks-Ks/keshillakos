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
  id: string; status: 'reviewing' | 'resolved' | 'rejected'; createdAt: string
  reason: string; adminNote: string; serviceTitle: string
  reporter: { name: string; profilePhoto: string; role: string }
  reported: { uid?: string; name: string; profilePhoto: string; role: string; accountStatus: string; publicProfile: boolean; isAdmin: boolean; headline: string; bio: string; email: string }
  hasConversation: boolean
  resolution: { decision: 'resolved' | 'rejected'; admin: string; at?: string; note: string } | null
  requestContext?: { title: string; status: string } | null
}
export type ReportSummary = { total: number; reviewing: number; resolved: number; rejected: number }
export async function fetchUserReports(params: PageParams & { status?: string; sort?: string } = {}) {
  const { data } = await api.get<{ reports: UserReportItem[]; pagination: PaginationMeta; summary: ReportSummary }>('/api/feedback/reports', { params })
  return Object.assign(pagedItems(data.reports, data.pagination), { reportSummary: data.summary })
}
export async function fetchUserReport(id: string) {
  const { data } = await api.get<{ report: UserReportItem }>(`/api/feedback/reports/${id}`)
  return data.report
}
export async function updateUserReportStatus(id: string, status: 'reviewing' | 'resolved' | 'rejected', note?: string) {
  const { data } = await api.patch<{ report: UserReportItem }>(`/api/feedback/reports/${id}/status`, { status, note })
  return data.report
}
export type ReportEvidenceMessage = { id: string; author: string; body: string; createdAt: string }
export async function fetchReportConversation(id: string, before?: string, beforeId?: string) {
  const { data } = await api.get<{ messages: ReportEvidenceMessage[]; pagination: PaginationMeta }>(`/api/feedback/reports/${id}/conversation`, { params: { before, beforeId, limit: 30 } })
  return data
}
export async function fetchReportRequest(id: string) {
  const { data } = await api.get<{ request: { title: string; status: string; details: string } }>(`/api/feedback/reports/${id}/request`)
  return data.request
}
