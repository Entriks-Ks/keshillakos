import type { Server } from 'socket.io'
import type { SocketUser } from './socketServer'
import {
  getConversationForUser,
  listMessages,
  markConversationRead,
  sendMessage,
} from './chatService'

export function registerChatHandlers(io: Server) {
  io.on('connection', (socket) => {
    const user = socket.data.user as SocketUser
    let joinRevision = 0

    socket.on('conversation:join', async (payload: { conversationId?: string; active?: boolean }, ack?) => {
      const revision = ++joinRevision
      socket.data.activeConversation = null
      try {
        const conversationId = payload?.conversationId
        if (!conversationId) throw new Error('conversationId mungon')
        await getConversationForUser(conversationId, user.uid)
        if (revision !== joinRevision || !socket.connected) throw new Error('Biseda ndryshoi')
        await socket.join(`conversation:${conversationId}`)
        socket.data.activeConversation = payload.active === false ? null : conversationId
        if (payload.active !== false) await markConversationRead(conversationId, user.uid)
        const messages = await listMessages({ conversationId, uid: user.uid, limit: 50 })
        if (typeof ack === 'function') ack({ ok: true, messages, pagination: messages.pagination })
      } catch (err) {
        if (typeof ack === 'function') {
          ack({ ok: false, error: err instanceof Error ? err.message : 'Gabim' })
        }
      }
    })

    socket.on('conversation:leave', (payload: { conversationId?: string }) => {
      if (payload?.conversationId) {
        ++joinRevision
        socket.leave(`conversation:${payload.conversationId}`)
        if (socket.data.activeConversation === payload.conversationId) socket.data.activeConversation = null
      }
    })

    socket.on('conversation:visibility', async (payload: { conversationId?: string; active?: boolean }) => {
      const id = payload?.conversationId
      if (!id || !socket.rooms.has(`conversation:${id}`)) return
      socket.data.activeConversation = payload.active ? id : null
      if (payload.active) {
        try { await markConversationRead(id, user.uid) } catch (error) { console.error('Chat read sync failed', error) }
      }
    })

    socket.on(
      'message:send',
      async (payload: { conversationId?: string; body?: string }, ack?) => {
        try {
          const conversationId = payload?.conversationId
          const body = payload?.body
          if (!conversationId || !body?.trim()) {
            throw new Error('Mesazhi ose biseda mungon')
          }

          const message = await sendMessage({
            conversationId,
            senderUid: user.uid,
            body,
          })

          socket.join(`conversation:${conversationId}`)

          if (typeof ack === 'function') ack({ ok: true, message })
        } catch (err) {
          if (typeof ack === 'function') {
            ack({ ok: false, error: err instanceof Error ? err.message : 'Gabim' })
          }
        }
      },
    )

    socket.on('typing', (payload: { conversationId?: string; isTyping?: boolean }) => {
      if (!payload?.conversationId || !socket.rooms.has(`conversation:${payload.conversationId}`)) return
      socket.to(`conversation:${payload.conversationId}`).emit('typing', {
        conversationId: payload.conversationId,
        uid: user.uid,
        isTyping: Boolean(payload.isTyping),
      })
    })
  })

}
