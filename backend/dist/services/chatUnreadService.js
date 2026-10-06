"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatUnreadCount = chatUnreadCount;
exports.publishChatUnread = publishChatUnread;
const Conversation_1 = require("../models/Conversation");
const realtime_1 = require("./realtime");
async function chatUnreadCount(uid) {
    const totals = await Conversation_1.Conversation.aggregate([
        { $match: { $or: [{ seekerUid: uid }, { providerUid: uid }] } },
        { $group: { _id: null, unread: { $sum: { $cond: [{ $eq: ['$seekerUid', uid] }, '$seekerUnread', '$providerUnread'] } } } },
    ]);
    return totals[0]?.unread ?? 0;
}
const pendingCounts = new Map();
async function publishChatUnread(uid) {
    const revision = Symbol();
    pendingCounts.set(uid, revision);
    try {
        const unreadCount = await chatUnreadCount(uid);
        if (pendingCounts.get(uid) === revision)
            (0, realtime_1.emitToUser)(uid, 'chat:unread', { unreadCount });
    }
    catch (error) {
        console.error('Chat unread sync failed', error);
    }
    finally {
        if (pendingCounts.get(uid) === revision)
            pendingCounts.delete(uid);
    }
}
//# sourceMappingURL=chatUnreadService.js.map