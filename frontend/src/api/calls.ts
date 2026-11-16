import api from './auth'
import type { PaginationMeta } from './pagination'

export type CallType = 'video' | 'audio'
export type CallStatus =
  | 'ringing'
  | 'accepted'
  | 'rejected'
  | 'missed'
  | 'busy'
  | 'timeout'
  | 'completed'

export type CallPeer = {
  uid: string
  name: string
  profilePhoto?: string
}

export type CallHistoryItem = {
  id: string
  conversationId: string
  roomName: string
  callType: CallType
  status: CallStatus
  isCaller: boolean
  startedAt: string
  answeredAt?: string | null
  endedAt?: string | null
  duration: number
  peer: CallPeer
}

export type LivekitTokenResponse = {
  token: string
  roomName: string
  livekitUrl: string
}

export async function fetchLivekitToken(callId: string): Promise<LivekitTokenResponse> {
  const { data } = await api.post<LivekitTokenResponse>('/api/calls/token', { callId })
  return data
}

export async function fetchActiveCall() {
  const { data } = await api.get<{ activeCall: CallHistoryItem | null }>('/api/calls/active')
  return data.activeCall
}

export async function fetchCallHistory(page = 1, limit = 20) {
  const { data } = await api.get<{
    calls: CallHistoryItem[]
    pagination: PaginationMeta
  }>('/api/calls/history', {
    params: { page, limit },
  })
  return data
}
