import type { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { firebaseVerifyIdToken } from './firebaseAuth'
import { findUserByUid } from './userService'
import { setRealtimeServer } from './realtime'
import { registerPresence } from './presenceSocket'

export type SocketUser = {
  uid: string
  name: string
}

export function attachRealtimeSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    path: '/socket.io',
    pingInterval: 25_000,
    pingTimeout: 20_000,
  })

  setRealtimeServer(io)

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

  io.on('connection', socket => {
    const user = socket.data.user as SocketUser
    void socket.join(`user:${user.uid}`)
  })
  registerPresence(io)
  return io
}
