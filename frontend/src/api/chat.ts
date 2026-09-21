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

export async function fetchConversations() {
  const { data } = await api.get<{ conversations: ConversationItem[] }>('/api/chat/conversations')
  return data.conversations
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

export async function fetchMessages(conversationId: string, params?: { before?: string; limit?: number }) {
  const { data } = await api.get<{ messages: ChatMessage[] }>(
    `/api/chat/conversations/${conversationId}/messages`,
    { params },
  )
  return data.messages
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
