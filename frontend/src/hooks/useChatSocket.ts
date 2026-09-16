import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from '../api/auth'
import type { ChatMessage } from '../api/chat'

type TypingEvent = {
  conversationId: string
  uid: string
  isTyping: boolean
}

type ConversationUpdated = {
  conversationId: string
  lastMessagePreview: string
  lastMessageAt: string
  senderUid: string
}

type AckResult = {
  ok: boolean
  messages?: ChatMessage[]
  message?: ChatMessage
  error?: string
}

export function useChatSocket(enabled: boolean) {
  const socketRef = useRef<Socket | null>(null)
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

    return () => {
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [enabled])

  const joinConversation = useCallback((conversationId: string): Promise<AckResult> => {
    const socket = socketRef.current
    if (!socket) return Promise.resolve({ ok: false, error: 'Socket i shkëputur' })

    return new Promise((resolve) => {
      socket.emit('conversation:join', { conversationId }, (res: AckResult) => {
        resolve(res || { ok: false, error: 'Pa përgjigje' })
      })
    })
  }, [])

  const leaveConversation = useCallback((conversationId: string) => {
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

  return {
    connected,
    joinConversation,
    leaveConversation,
    sendMessage,
    emitTyping,
    onMessageNew,
    onTyping,
    onConversationUpdated,
  }
}
