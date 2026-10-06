import { pagedItems, type PageParams, type CollectionSummary, type PaginationMeta } from './pagination'
import api from './auth'

export type ChatPeer = {
  uid: string
  name: string
  profilePhoto?: string
  roleLabel?: string
}

export type ConversationItem = {
  id: string
  seekerUid: string
  providerUid: string
  serviceId?: string
  serviceTitle?: string
  lastMessageAt?: string
  lastMessagePreview?: string
  unread: number
  peer: ChatPeer
  createdAt: string
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderUid: string
  body: string
  createdAt: string
}

export async function fetchConversations(params: PageParams = {}) {
  const { data } = await api.get<{ conversations: ConversationItem[]; pagination: PaginationMeta; summary: CollectionSummary }>('/api/chat/conversations', { params })
  return pagedItems(data.conversations, data.pagination, data.summary)
}

export async function openConversation(payload: {
  providerUid?: string
  seekerUid?: string
  serviceId?: string
  serviceTitle?: string
  initialMessage?: string
}) {
  const { data } = await api.post<{
    conversation: ConversationItem
    message: ChatMessage | null
  }>('/api/chat/conversations', payload)
  return data
}

export async function fetchConversation(id: string) {
  const { data } = await api.get<{ conversation: ConversationItem }>(`/api/chat/conversations/${id}`)
  return data.conversation
}

export async function fetchMessages(conversationId: string, params?: PageParams & { before?: string }) {
  const { data } = await api.get<{ messages: ChatMessage[]; pagination: PaginationMeta }>(
    `/api/chat/conversations/${conversationId}/messages`,
    { params },
  )
  return pagedItems(data.messages, data.pagination)
}

export async function sendChatMessage(conversationId: string, body: string) {
  const { data } = await api.post<{ message: ChatMessage }>(
    `/api/chat/conversations/${conversationId}/messages`,
    { body },
  )
  return data.message
}

export async function markConversationRead(conversationId: string) {
  const { data } = await api.post<{ conversation: ConversationItem }>(
    `/api/chat/conversations/${conversationId}/read`,
  )
  return data.conversation
}

export async function fetchChatUnreadCount(signal?: AbortSignal) {
  const { data } = await api.get<{ unreadCount: number }>('/api/chat/unread-count', { signal })
  return data.unreadCount
}

export type ChatAvailability = { blockedByMe: boolean; messagingBlocked: boolean }
export type ChatDetails = ChatAvailability & { requestContext: { id: string; title: string; status: string } | null }
export async function fetchChatDetails(id: string, signal?: AbortSignal) {
  const { data } = await api.get<ChatDetails>(`/api/chat/conversations/${id}/details`, { signal })
  return data
}
export async function blockChatUser(id: string, blocked: boolean) {
  const { data } = await api.post<ChatAvailability>(`/api/chat/conversations/${id}/block`, { blocked })
  return data
}
export async function reportChatUser(id: string, reason: string) {
  await api.post(`/api/chat/conversations/${id}/report`, { reason })
}
