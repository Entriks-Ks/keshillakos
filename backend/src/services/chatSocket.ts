import type { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { firebaseVerifyIdToken } from './firebaseAuth'
import { findUserByUid } from './userService'
import {
  getConversationForUser,
  listMessages,
  markConversationRead,
  sendMessage,
  type PublicMessage,
} from './chatService'

type SocketUser = {
  uid: string
  name: string
}

export function attachChatSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    path: '/socket.io',
  })

  io.use(async (socket, next) => {
    try {
      const token =
        (typeof socket.handshake.auth?.token === 'string' && socket.handshake.auth.token) ||
        (typeof socket.handshake.headers.authorization === 'string'
          ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : '')

      if (!token) {
        return next(new Error('Mungon tokeni'))
      }

      const firebaseUser = await firebaseVerifyIdToken(token)
      const dbUser = await findUserByUid(firebaseUser.localId)
      if (dbUser && dbUser.accountStatus && dbUser.accountStatus !== 'active') {
        return next(new Error('Llogaria nuk është aktive'))
      }

      const user: SocketUser = {
        uid: firebaseUser.localId,
        name: dbUser?.name || firebaseUser.displayName || 'User',
      }
      socket.data.user = user
      next()
    } catch (err) {
      next(err instanceof Error ? err : new Error('Autentifikim i dështuar'))
    }
  })

  io.on('connection', (socket) => {
    const user = socket.data.user as SocketUser
    socket.join(`user:${user.uid}`)

    socket.on('conversation:join', async (payload: { conversationId?: string }, ack?) => {
      try {
        const conversationId = payload?.conversationId
        if (!conversationId) throw new Error('conversationId mungon')
        await getConversationForUser(conversationId, user.uid)
        socket.join(`conversation:${conversationId}`)
        await markConversationRead(conversationId, user.uid)
        const messages = await listMessages({ conversationId, uid: user.uid, limit: 50 })
        if (typeof ack === 'function') ack({ ok: true, messages })
      } catch (err) {
        if (typeof ack === 'function') {
          ack({ ok: false, error: err instanceof Error ? err.message : 'Gabim' })
        }
      }
    })

    socket.on('conversation:leave', (payload: { conversationId?: string }) => {
      if (payload?.conversationId) {
        socket.leave(`conversation:${payload.conversationId}`)
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

          const conversation = await getConversationForUser(conversationId, user.uid)
          const peerUid =
            user.uid === conversation.seekerUid
              ? conversation.providerUid
              : conversation.seekerUid

          const room = `conversation:${conversationId}`
          socket.join(room)
          io.to(room).emit('message:new', message as PublicMessage)

          const updatedPayload = {
            conversationId,
            lastMessagePreview: message.body.slice(0, 140),
            lastMessageAt: message.createdAt,
            senderUid: message.senderUid,
          }
          io.to(room).emit('conversation:updated', updatedPayload)
          io.to(`user:${peerUid}`).emit('conversation:updated', updatedPayload)

          if (typeof ack === 'function') ack({ ok: true, message })
        } catch (err) {
          if (typeof ack === 'function') {
            ack({ ok: false, error: err instanceof Error ? err.message : 'Gabim' })
          }
        }
      },
    )

    socket.on('typing', (payload: { conversationId?: string; isTyping?: boolean }) => {
      if (!payload?.conversationId) return
      socket.to(`conversation:${payload.conversationId}`).emit('typing', {
        conversationId: payload.conversationId,
        uid: user.uid,
        isTyping: Boolean(payload.isTyping),
      })
    })
  })

  return io
}
