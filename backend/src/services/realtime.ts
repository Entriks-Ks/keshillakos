import type { Server } from 'socket.io'
let server: Server | undefined
export function setRealtimeServer(io: Server) { server = io }
export function emitToUser(uid: string, event: string, payload: unknown) {
  server?.to(`user:${uid}`).emit(event, payload)
}

export function disconnectUser(uid: string) { server?.in(`user:${uid}`).disconnectSockets(true) }

export function isConversationActive(uid: string, conversationId: string) {
  const ids = server?.sockets.adapter.rooms.get(`user:${uid}`)
  return Boolean(ids && [...ids].some(id => server?.sockets.sockets.get(id)?.data.activeConversation === conversationId))
}
export function emitChatMessage(message: { conversationId: string; body: string; createdAt: string; senderUid: string }, peerUid: string) {
  const room = `conversation:${message.conversationId}`
  server?.to(room).emit('message:new', message)
  server?.to([room, `user:${peerUid}`, `user:${message.senderUid}`]).emit('conversation:updated', {
    conversationId: message.conversationId, lastMessagePreview: message.body.slice(0, 140),
    lastMessageAt: message.createdAt, senderUid: message.senderUid,
  })
}
