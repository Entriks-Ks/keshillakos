"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertProviderCanMessageSeeker = assertProviderCanMessageSeeker;
exports.openOrGetConversation = openOrGetConversation;
exports.listConversationsForUser = listConversationsForUser;
exports.getConversationForUser = getConversationForUser;
exports.listMessages = listMessages;
exports.sendMessage = sendMessage;
exports.markConversationRead = markConversationRead;
const mongoose_1 = __importDefault(require("mongoose"));
const Conversation_1 = require("../models/Conversation");
const Message_1 = require("../models/Message");
const ProviderProfile_1 = require("../models/ProviderProfile");
const RequestDelivery_1 = require("../models/RequestDelivery");
const ServiceRequest_1 = require("../models/ServiceRequest");
const User_1 = require("../models/User");
const UserRequest_1 = require("../models/UserRequest");
const userService_1 = require("./userService");
const MAX_BODY = 4000;
function toMessage(doc) {
    return {
        id: doc._id.toString(),
        conversationId: doc.conversation.toString(),
        senderUid: doc.senderUid,
        body: doc.body,
        createdAt: doc.createdAt.toISOString(),
    };
}
async function assertParticipant(conversationId, uid) {
    if (!mongoose_1.default.isValidObjectId(conversationId)) {
        throw Object.assign(new Error('Biseda nuk u gjet'), { status: 404 });
    }
    const conversation = await Conversation_1.Conversation.findById(conversationId);
    if (!conversation) {
        throw Object.assign(new Error('Biseda nuk u gjet'), { status: 404 });
    }
    if (conversation.seekerUid !== uid && conversation.providerUid !== uid) {
        throw Object.assign(new Error('Nuk ke leje për këtë bisedë'), { status: 403 });
    }
    return conversation;
}
async function assertProviderCanMessageSeeker(providerUid, seekerUid) {
    const [provider, seeker] = await Promise.all([
        User_1.User.findOne({ uid: providerUid }).select('_id').lean(),
        User_1.User.findOne({ uid: seekerUid }).select('_id').lean(),
    ]);
    if (!provider || !seeker) {
        throw Object.assign(new Error('Përdoruesi nuk u gjet'), { status: 404 });
    }
    const [profiles, requests] = await Promise.all([
        ProviderProfile_1.ProviderProfile.find({ ownerUser: provider._id }).select('_id').lean(),
        UserRequest_1.UserRequest.find({ user: seeker._id }).select('_id').lean(),
    ]);
    if (profiles.length && requests.length) {
        const hit = await RequestDelivery_1.RequestDelivery.exists({
            providerProfile: { $in: profiles.map((profile) => profile._id) },
            request: { $in: requests.map((request) => request._id) },
        });
        if (hit)
            return;
    }
    const legacy = await ServiceRequest_1.ServiceRequest.exists({ providerUid, seekerUid });
    if (!legacy) {
        throw Object.assign(new Error('Mund t’i dërgosh mesazh vetëm klientit që ka bërë kërkesë'), { status: 403 });
    }
}
async function openOrGetConversation(input) {
    if (!input.providerUid?.trim()) {
        throw Object.assign(new Error('Ofruesi është i detyrueshëm'), { status: 400 });
    }
    if (input.seekerUid === input.providerUid) {
        throw Object.assign(new Error('Nuk mund të chatosh me veten'), { status: 400 });
    }
    const provider = await (0, userService_1.findUserByUid)(input.providerUid);
    if (!provider) {
        throw Object.assign(new Error('Ofruesi nuk u gjet'), { status: 404 });
    }
    if (!['provider', 'company', 'admin'].includes(provider.role)) {
        throw Object.assign(new Error('Ky përdorues nuk ofron shërbime'), { status: 400 });
    }
    let conversation = await Conversation_1.Conversation.findOne({
        seekerUid: input.seekerUid,
        providerUid: input.providerUid,
    });
    if (!conversation) {
        conversation = await Conversation_1.Conversation.create({
            seekerUid: input.seekerUid,
            providerUid: input.providerUid,
            serviceId: input.serviceId?.trim() || '',
            serviceTitle: input.serviceTitle?.trim() || '',
            seekerUnread: 0,
            providerUnread: 0,
        });
    }
    else if (input.serviceId || input.serviceTitle) {
        if (input.serviceId?.trim())
            conversation.serviceId = input.serviceId.trim();
        if (input.serviceTitle?.trim())
            conversation.serviceTitle = input.serviceTitle.trim();
        await conversation.save();
    }
    let message = null;
    if (input.initialMessage?.trim()) {
        message = await sendMessage({
            conversationId: conversation._id.toString(),
            senderUid: input.senderUid || input.seekerUid,
            body: input.initialMessage.trim(),
        });
        conversation = (await Conversation_1.Conversation.findById(conversation._id));
    }
    const publicConv = await toPublicConversation(conversation, input.senderUid || input.seekerUid);
    return { conversation: publicConv, message };
}
async function listConversationsForUser(uid) {
    const docs = await Conversation_1.Conversation.find({
        $or: [{ seekerUid: uid }, { providerUid: uid }],
    })
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .limit(100);
    return Promise.all(docs.map((doc) => toPublicConversation(doc, uid)));
}
async function getConversationForUser(conversationId, uid) {
    const conversation = await assertParticipant(conversationId, uid);
    return toPublicConversation(conversation, uid);
}
async function listMessages(input) {
    await assertParticipant(input.conversationId, input.uid);
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const query = {
        conversation: input.conversationId,
    };
    if (input.before) {
        const beforeDate = new Date(input.before);
        if (!Number.isNaN(beforeDate.getTime())) {
            query.createdAt = { $lt: beforeDate };
        }
    }
    const docs = await Message_1.Message.find(query).sort({ createdAt: -1 }).limit(limit);
    return docs.reverse().map(toMessage);
}
async function sendMessage(input) {
    const body = input.body.trim();
    if (!body) {
        throw Object.assign(new Error('Mesazhi nuk mund të jetë bosh'), { status: 400 });
    }
    if (body.length > MAX_BODY) {
        throw Object.assign(new Error('Mesazhi është shumë i gjatë'), { status: 400 });
    }
    const conversation = await assertParticipant(input.conversationId, input.senderUid);
    const message = await Message_1.Message.create({
        conversation: conversation._id,
        senderUid: input.senderUid,
        body,
    });
    conversation.lastMessageAt = message.createdAt;
    conversation.lastMessagePreview = body.slice(0, 140);
    if (input.senderUid === conversation.seekerUid) {
        conversation.providerUnread += 1;
    }
    else {
        conversation.seekerUnread += 1;
    }
    await conversation.save();
    return toMessage(message);
}
async function markConversationRead(conversationId, uid) {
    const conversation = await assertParticipant(conversationId, uid);
    if (uid === conversation.seekerUid) {
        conversation.seekerUnread = 0;
    }
    else {
        conversation.providerUnread = 0;
    }
    await conversation.save();
    return toPublicConversation(conversation, uid);
}
async function toPublicConversation(doc, viewerUid) {
    const peerUid = viewerUid === doc.seekerUid ? doc.providerUid : doc.seekerUid;
    const users = await (0, userService_1.findUsersByUids)([peerUid]);
    const peer = users.get(peerUid);
    return {
        id: doc._id.toString(),
        seekerUid: doc.seekerUid,
        providerUid: doc.providerUid,
        serviceId: doc.serviceId || undefined,
        serviceTitle: doc.serviceTitle || undefined,
        lastMessageAt: doc.lastMessageAt?.toISOString(),
        lastMessagePreview: doc.lastMessagePreview || undefined,
        unread: viewerUid === doc.seekerUid ? doc.seekerUnread : doc.providerUnread,
        peer: {
            uid: peerUid,
            name: peer?.name || 'Përdorues',
            profilePhoto: peer?.profilePhoto || '',
            roleLabel: peer?.role === 'provider'
                ? 'Ofrues'
                : peer?.role === 'company'
                    ? 'Kompani'
                    : peer?.role === 'admin'
                        ? 'Admin'
                        : 'Përdorues',
        },
        createdAt: doc.createdAt.toISOString(),
    };
}
//# sourceMappingURL=chatService.js.map