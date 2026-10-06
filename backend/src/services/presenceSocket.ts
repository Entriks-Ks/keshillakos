import type { Server } from 'socket.io'
import { assertParticipant } from './chatService'
import { createPresenceRegistry } from './presenceService'

export function registerPresence(io: Server) {
  const registry = createPresenceRegistry(value => io.to(`presence:${value.uid}`).emit('presence:update', value))
  const timer = setInterval(() => registry.expire(), 5_000)
  timer.unref()
  io.httpServer.once('close', () => { clearInterval(timer); registry.clear() })
  io.on('connection', socket => {
    const uid = socket.data.user.uid as string
    registry.connect(socket.id, uid)
    const pong = (packet: { type: string }) => { if (packet.type === 'pong' && socket.connected) registry.heartbeat(socket.id) }
    socket.conn.on('packet', pong)
    socket.once('disconnect', () => { socket.conn.off('packet', pong); registry.disconnect(socket.id) })
    let subscriptionRevision = 0
    socket.on('presence:subscribe', async (payload: { conversationIds?: unknown }, ack?: (result: unknown) => void) => {
      const revision = ++subscriptionRevision
      try {
        const ids = payload?.conversationIds
        if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== 'string')) throw new Error('Bisedat janë të pavlefshme')
        // Resolve contacts only from conversations the authenticated viewer belongs to.
        const conversations = await Promise.all([...new Set(ids as string[])].map(id => assertParticipant(id, uid)))
        if (revision !== subscriptionRevision || !socket.connected) return
        const peers = new Set(conversations.map(c => c.seekerUid === uid ? c.providerUid : c.seekerUid))
        for (const room of socket.rooms) if (room.startsWith('presence:')) await socket.leave(room)
        for (const peer of peers) await socket.join(`presence:${peer}`)
        ack?.({ ok: true, presence: [...peers].map(peer => registry.snapshot(peer)) })
      } catch { ack?.({ ok: false, error: 'Nuk ke leje për praninë e këtyre përdoruesve' }) }
    })
  })
  return registry
}
