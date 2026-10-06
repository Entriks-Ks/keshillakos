"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRealtimeServer = setRealtimeServer;
exports.emitToUser = emitToUser;
exports.disconnectUser = disconnectUser;
exports.isConversationActive = isConversationActive;
exports.emitChatMessage = emitChatMessage;
let server;
function setRealtimeServer(io) { server = io; }
function emitToUser(uid, event, payload) {
    server?.to(`user:${uid}`).emit(event, payload);
}
function disconnectUser(uid) { server?.in(`user:${uid}`).disconnectSockets(true); }
function isConversationActive(uid, conversationId) {
    const ids = server?.sockets.adapter.rooms.get(`user:${uid}`);
    return Boolean(ids && [...ids].some(id => server?.sockets.sockets.get(id)?.data.activeConversation === conversationId));
}
function emitChatMessage(message, peerUid) {
    const room = `conversation:${message.conversationId}`;
    server?.to(room).emit('message:new', message);
    server?.to([room, `user:${peerUid}`, `user:${message.senderUid}`]).emit('conversation:updated', {
        conversationId: message.conversationId, lastMessagePreview: message.body.slice(0, 140),
        lastMessageAt: message.createdAt, senderUid: message.senderUid,
    });
}
//# sourceMappingURL=realtime.js.map