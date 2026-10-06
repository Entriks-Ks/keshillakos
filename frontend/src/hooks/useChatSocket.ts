import type { PaginationMeta } from '../api/pagination'
import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from '../api/auth'
import type { ChatMessage } from '../api/chat'

type TypingEvent = {
  conversationId: string
  uid: string
  isTyping: boolean
}

type ConversationUpdated = import('../chat/chatState').ConversationUpdate

type AckResult = {
  ok: boolean
  messages?: ChatMessage[]
  pagination?: PaginationMeta
  message?: ChatMessage
  error?: string
}

export function useChatSocket(enabled: boolean, ownerUid?: string) {
  const socketRef = useRef<Socket | null>(null)
  const activeConversationRef = useRef<string | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled) return

    const token = localStorage.getItem('token')
    if (!token) return

    const socket = io(API_BASE_URL, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    const visibilityChanged = () => {
      if (activeConversationRef.current) socket.emit('conversation:visibility', { conversationId: activeConversationRef.current, active: document.visibilityState === 'visible' })
    }
    document.addEventListener('visibilitychange', visibilityChanged)

    return () => {
      document.removeEventListener('visibilitychange', visibilityChanged)
      activeConversationRef.current = null
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [enabled, ownerUid])

  const joinConversation = useCallback((conversationId: string): Promise<AckResult> => {
    const socket = socketRef.current
    if (!socket) return Promise.resolve({ ok: false, error: 'Socket i shkëputur' })

    return new Promise((resolve) => {
      activeConversationRef.current = conversationId
      socket.emit('conversation:join', { conversationId, active: document.visibilityState === 'visible' }, (res: AckResult) => {
        if (res?.ok && activeConversationRef.current === conversationId) socket.emit('conversation:visibility', { conversationId, active: document.visibilityState === 'visible' })
        resolve(res || { ok: false, error: 'Pa përgjigje' })
      })
    })
  }, [])

  const leaveConversation = useCallback((conversationId: string) => {
    if (activeConversationRef.current === conversationId) activeConversationRef.current = null
    socketRef.current?.emit('conversation:leave', { conversationId })
  }, [])

  const sendMessage = useCallback((conversationId: string, body: string): Promise<AckResult> => {
    const socket = socketRef.current
    if (!socket) return Promise.resolve({ ok: false, error: 'Socket i shkëputur' })

    return new Promise((resolve) => {
      socket.emit('message:send', { conversationId, body }, (res: AckResult) => {
        if (res?.ok && res.message) {
          resolve({ ok: true, message: res.message })
          return
        }
        resolve({ ok: false, error: res?.error || 'Dërgimi dështoi' })
      })
    })
  }, [])

  const emitTyping = useCallback((conversationId: string, isTyping: boolean) => {
    socketRef.current?.emit('typing', { conversationId, isTyping })
  }, [])

  const onMessageNew = useCallback((handler: (message: ChatMessage) => void) => {
    const socket = socketRef.current
    if (!socket) return () => undefined
    socket.on('message:new', handler)
    return () => {
      socket.off('message:new', handler)
    }
  }, [connected])

  const onTyping = useCallback((handler: (event: TypingEvent) => void) => {
    const socket = socketRef.current
    if (!socket) return () => undefined
    socket.on('typing', handler)
    return () => {
      socket.off('typing', handler)
    }
  }, [connected])

  const onConversationUpdated = useCallback((handler: (event: ConversationUpdated) => void) => {
    const socket = socketRef.current
    if (!socket) return () => undefined
    socket.on('conversation:updated', handler)
    return () => {
      socket.off('conversation:updated', handler)
    }
  }, [connected])

  const onAvailability = useCallback((handler: (event: import('../api/chat').ChatAvailability & { conversationId: string }) => void) => {
    const socket = socketRef.current
    if (!socket) return () => undefined
    socket.on('chat:availability', handler)
    return () => { socket.off('chat:availability', handler) }
  }, [connected])

  const onPresence = useCallback((handler: (event: import('../chat/useChatPresence').ChatPresence) => void) => {
    const socket = socketRef.current
    if (!socket) return () => undefined
    socket.on('presence:update', handler)
    return () => { socket.off('presence:update', handler) }
  }, [connected])
  const subscribePresence = useCallback((conversationIds: string[], handler: (values: import('../chat/useChatPresence').ChatPresence[]) => void) => {
    socketRef.current?.emit('presence:subscribe', { conversationIds }, (result: { ok: boolean; presence?: import('../chat/useChatPresence').ChatPresence[] }) => {
      if (result?.ok && result.presence) handler(result.presence)
    })
  }, [connected])

  return {
    connected,
    joinConversation,
    leaveConversation,
    sendMessage,
    emitTyping,
    onMessageNew,
    onTyping,
    onConversationUpdated,
    onAvailability,
    onPresence,
    subscribePresence,
  }
}
