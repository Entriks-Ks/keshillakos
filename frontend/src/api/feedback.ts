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

export async function fetchPlatformFeedback() {
  const { data } = await api.get<{ feedback: PlatformFeedbackItem[] }>('/api/feedback')
  return data.feedback
}

export async function markPlatformFeedbackRead(id: string) {
  const { data } = await api.patch<{ feedback: PlatformFeedbackItem }>(`/api/feedback/${id}/read`)
  return data.feedback
}
