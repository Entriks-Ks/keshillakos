"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatAvailability = chatAvailability;
exports.assertChatUnblocked = assertChatUnblocked;
exports.setChatBlock = setChatBlock;
exports.reportChatUser = reportChatUser;
const ChatBlock_1 = require("../models/ChatBlock");
const PlatformFeedback_1 = require("../models/PlatformFeedback");
const Conversation_1 = require("../models/Conversation");
const userService_1 = require("./userService");
const realtime_1 = require("./realtime");
const notificationService_1 = require("./notificationService");
async function chatAvailability(uid, peerUid) {
    const blocks = await ChatBlock_1.ChatBlock.find({ $or: [{ blockerUid: uid, blockedUid: peerUid }, { blockerUid: peerUid, blockedUid: uid }] }).lean();
    return { blockedByMe: blocks.some(b => b.blockerUid === uid), messagingBlocked: blocks.length > 0 };
}
async function assertChatUnblocked(uid, peerUid) {
    if ((await chatAvailability(uid, peerUid)).messagingBlocked) {
        throw Object.assign(new Error('Mesazhet janë të bllokuara për këtë bisedë'), { status: 403 });
    }
}
// The caller must obtain the conversation through assertParticipant first.
async function setChatBlock(conversation, uid, blocked) {
    if (uid !== conversation.seekerUid && uid !== conversation.providerUid)
        throw Object.assign(new Error('Nuk ke leje për këtë bisedë'), { status: 403 });
    const peerUid = uid === conversation.seekerUid ? conversation.providerUid : conversation.seekerUid;
    if (blocked)
        await ChatBlock_1.ChatBlock.updateOne({ blockerUid: uid, blockedUid: peerUid }, { $setOnInsert: { blockerUid: uid, blockedUid: peerUid } }, { upsert: true });
    else
        await ChatBlock_1.ChatBlock.deleteOne({ blockerUid: uid, blockedUid: peerUid });
    // Notify only the affected threads, including reverse-role threads and other tabs.
    const threads = await Conversation_1.Conversation.find({ $or: [{ seekerUid: uid, providerUid: peerUid }, { seekerUid: peerUid, providerUid: uid }] }).select('_id').lean();
    const [mine, theirs] = await Promise.all([chatAvailability(uid, peerUid), chatAvailability(peerUid, uid)]);
    for (const thread of threads) {
        (0, realtime_1.emitToUser)(uid, 'chat:availability', { conversationId: String(thread._id), ...mine });
        (0, realtime_1.emitToUser)(peerUid, 'chat:availability', { conversationId: String(thread._id), ...theirs });
    }
    return mine;
}
async function reportChatUser(conversation, uid, reason) {
    if (uid !== conversation.seekerUid && uid !== conversation.providerUid)
        throw Object.assign(new Error('Nuk ke leje për këtë bisedë'), { status: 403 });
    const text = typeof reason === 'string' ? reason.trim() : '';
    if (text.length < 5 || text.length > 500)
        throw Object.assign(new Error('Shkruaj një arsye prej 5–500 karakteresh'), { status: 400 });
    const conversationId = String(conversation._id);
    const pending = await PlatformFeedback_1.PlatformFeedback.exists({ userUid: uid, 'chatReport.conversationId': conversationId, status: 'new' });
    if (pending)
        return;
    const user = await (0, userService_1.findUserByUid)(uid);
    const reportedUid = uid === conversation.seekerUid ? conversation.providerUid : conversation.seekerUid;
    try {
        const feedback = await PlatformFeedback_1.PlatformFeedback.create({
            userUid: uid, name: user?.name || 'Përdorues', email: user?.email || '', status: 'new',
            message: text,
            chatReport: { conversationId, reportedUid, reason: text, reviewStatus: 'new' },
        });
        await (0, notificationService_1.notifyAdmins)({ type: 'report:new', title: 'Raportim i ri përdoruesi', href: '/dashboard/admin/reports', eventKey: `feedback:${feedback._id}`, actorUid: uid });
    }
    catch (error) {
        if (error.code !== 11000)
            throw error;
    }
}
//# sourceMappingURL=chatSafetyService.js.map