"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatConversationSummary = chatConversationSummary;
exports.chatUnreadCount = chatUnreadCount;
exports.chatUnreadTotals = chatUnreadTotals;
exports.publishChatUnread = publishChatUnread;
const Conversation_1 = require("../models/Conversation");
const realtime_1 = require("./realtime");
/** Each counter belongs to that participant's unread incoming messages. */
async function aggregateChatUnread(uid) {
    const recipientUnread = { $cond: [{ $eq: ['$seekerUid', uid] }, '$seekerUnread', '$providerUnread'] };
    const totals = await Conversation_1.Conversation.aggregate([
        { $match: { $or: [{ seekerUid: uid }, { providerUid: uid }] } },
        { $group: {
                _id: null,
                total: { $sum: 1 },
                unread: { $sum: recipientUnread },
                unreadConversations: { $sum: { $cond: [{ $gt: [recipientUnread, 0] }, 1, 0] } },
            } },
    ]);
    return totals[0];
}
async function chatConversationSummary(uid) {
    const totals = await aggregateChatUnread(uid);
    return { total: totals?.total ?? 0, unread: totals?.unread ?? 0 };
}
async function chatUnreadCount(uid) {
    return (await chatConversationSummary(uid)).unread;
}
/** Separate metrics: existing message counts remain unchanged for screen and web consumers. */
async function chatUnreadTotals(uid) {
    const totals = await aggregateChatUnread(uid);
    return { unreadCount: totals?.unread ?? 0, unreadConversationCount: totals?.unreadConversations ?? 0 };
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