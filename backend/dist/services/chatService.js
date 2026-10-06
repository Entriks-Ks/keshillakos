"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertParticipant = assertParticipant;
exports.assertProviderCanMessageSeeker = assertProviderCanMessageSeeker;
exports.openOrGetConversation = openOrGetConversation;
exports.listConversationsForUser = listConversationsForUser;
exports.getConversationForUser = getConversationForUser;
exports.listMessages = listMessages;
exports.sendMessage = sendMessage;
exports.markConversationRead = markConversationRead;
const realtime_1 = require("./realtime");
const chatUnreadService_1 = require("./chatUnreadService");
const pagination_1 = require("./pagination");
const mongoose_1 = __importDefault(require("mongoose"));
const Conversation_1 = require("../models/Conversation");
const Message_1 = require("../models/Message");
const ProviderProfile_1 = require("../models/ProviderProfile");
const RequestDelivery_1 = require("../models/RequestDelivery");
const ServiceRequest_1 = require("../models/ServiceRequest");
const User_1 = require("../models/User");
const UserRequest_1 = require("../models/UserRequest");
const providerPublicService_1 = require("./providerPublicService");
const chatSafetyService_1 = require("./chatSafetyService");
const ServiceOffer_1 = require("../models/ServiceOffer");
const Service_1 = require("../models/Service");
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
    if (typeof conversationId !== 'string' || !mongoose_1.default.isValidObjectId(conversationId)) {
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
    if (typeof input.providerUid !== 'string' || !input.providerUid.trim() || typeof input.seekerUid !== 'string' || !input.seekerUid.trim()) {
        throw Object.assign(new Error('Ofruesi është i detyrueshëm'), { status: 400 });
    }
    const senderUid = input.senderUid || input.seekerUid;
    if (senderUid !== input.seekerUid && senderUid !== input.providerUid) {
        throw Object.assign(new Error('Nuk ke leje për të hapur këtë bisedë'), { status: 403 });
    }
    if (senderUid === input.providerUid)
        await assertProviderCanMessageSeeker(input.providerUid, input.seekerUid);
    await (0, chatSafetyService_1.assertChatUnblocked)(input.seekerUid, input.providerUid);
    if (input.seekerUid === input.providerUid) {
        throw Object.assign(new Error('Nuk mund të chatosh me veten'), { status: 400 });
    }
    if (input.initialMessage !== undefined && (typeof input.initialMessage !== 'string' || input.initialMessage.trim().length > MAX_BODY))
        throw Object.assign(new Error('Mesazhi është i pavlefshëm'), { status: 400 });
    const provider = await (0, userService_1.findUserByUid)(input.providerUid);
    if (!provider) {
        throw Object.assign(new Error('Ofruesi nuk u gjet'), { status: 404 });
    }
    if (!(0, providerPublicService_1.publicProfileRole)(provider)) {
        throw Object.assign(new Error('Ky përdorues nuk ofron shërbime'), { status: 400 });
    }
    const seeker = await (0, userService_1.findUserByUid)(input.seekerUid);
    if (!seeker || (provider.accountStatus && provider.accountStatus !== 'active') || (seeker.accountStatus && seeker.accountStatus !== 'active')) {
        throw Object.assign(new Error('Llogaria nuk është aktive'), { status: 403 });
    }
    if (input.serviceId !== undefined && typeof input.serviceId !== 'string')
        throw Object.assign(new Error('Shërbimi është i pavlefshëm'), { status: 400 });
    if (input.serviceTitle !== undefined && typeof input.serviceTitle !== 'string')
        throw Object.assign(new Error('Shërbimi është i pavlefshëm'), { status: 400 });
    let serviceTitle = input.serviceTitle?.trim().slice(0, 160);
    if (input.serviceId?.trim()) {
        if (!mongoose_1.default.isValidObjectId(input.serviceId.trim()))
            throw Object.assign(new Error('Shërbimi është i pavlefshëm'), { status: 400 });
        const providerAccount = await User_1.User.findOne({ uid: input.providerUid }).select('_id').lean();
        const profiles = await ProviderProfile_1.ProviderProfile.find({ ownerUser: providerAccount?._id }).select('_id').lean();
        const [offer, legacy] = await Promise.all([
            ServiceOffer_1.ServiceOffer.findOne({ _id: input.serviceId.trim(), providerProfile: { $in: profiles.map(p => p._id) } }).select('name').lean(),
            Service_1.Service.findOne({ _id: input.serviceId.trim(), providerUid: input.providerUid }).select('title').lean(),
        ]);
        if (!offer && !legacy)
            throw Object.assign(new Error('Shërbimi nuk i përket këtij ofruesi'), { status: 403 });
        serviceTitle = offer?.name || legacy?.title;
    }
    let conversation = await Conversation_1.Conversation.findOne({
        seekerUid: input.seekerUid,
        providerUid: input.providerUid,
    });
    if (!conversation) {
        try {
            conversation = await Conversation_1.Conversation.create({
                seekerUid: input.seekerUid,
                providerUid: input.providerUid,
                serviceId: input.serviceId?.trim() || '',
                serviceTitle: serviceTitle || '',
                requestDeliveryId: input.requestDeliveryId,
                seekerUnread: 0,
                providerUnread: 0,
            });
        }
        catch (error) {
            if (error.code !== 11000)
                throw error;
            conversation = await Conversation_1.Conversation.findOne({ seekerUid: input.seekerUid, providerUid: input.providerUid });
            if (!conversation)
                throw error;
        }
    }
    else if (input.serviceId || serviceTitle || input.requestDeliveryId) {
        if (input.serviceId?.trim())
            conversation.serviceId = input.serviceId.trim();
        if (serviceTitle)
            conversation.serviceTitle = serviceTitle;
        if (input.requestDeliveryId)
            conversation.requestDeliveryId = new mongoose_1.default.Types.ObjectId(input.requestDeliveryId);
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
async function listConversationsForUser(uid, input = { page: 1, limit: 20 }, search = '') {
    const query = { $or: [{ seekerUid: uid }, { providerUid: uid }] };
    if (search.trim()) {
        const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const peers = await User_1.User.find({ name: { $regex: escaped, $options: 'i' } }).select('uid').lean();
        query.$and = [{ $or: [{ seekerUid: { $in: peers.map((peer) => peer.uid) } }, { providerUid: { $in: peers.map((peer) => peer.uid) } }, { serviceTitle: { $regex: escaped, $options: 'i' } }, { lastMessagePreview: { $regex: escaped, $options: 'i' } }] }];
    }
    const result = await (0, pagination_1.queryPage)(input, () => Conversation_1.Conversation.countDocuments(query), (skip, limit) => Conversation_1.Conversation.find(query).sort({ lastMessageAt: -1, updatedAt: -1, _id: -1 }).skip(skip).limit(limit));
    const totals = await Conversation_1.Conversation.aggregate([
        { $match: { $or: [{ seekerUid: uid }, { providerUid: uid }] } },
        { $group: { _id: null, total: { $sum: 1 }, unread: { $sum: { $cond: [{ $eq: ['$seekerUid', uid] }, '$seekerUnread', '$providerUnread'] } } } },
    ]);
    return Object.assign(await Promise.all(result.items.map((doc) => toPublicConversation(doc, uid))), { pagination: result.pagination, summary: { total: totals[0]?.total ?? 0, unread: totals[0]?.unread ?? 0 } });
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
    const result = await (0, pagination_1.queryPage)({ page: input.page ?? 1, limit }, () => Message_1.Message.countDocuments(query), (skip, pageLimit) => Message_1.Message.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(pageLimit));
    return Object.assign(result.items.reverse().map(toMessage), { pagination: result.pagination });
}
async function sendMessage(input) {
    const body = typeof input.body === 'string' ? input.body.trim() : '';
    if (!body) {
        throw Object.assign(new Error('Mesazhi nuk mund të jetë bosh'), { status: 400 });
    }
    if (body.length > MAX_BODY) {
        throw Object.assign(new Error('Mesazhi është shumë i gjatë'), { status: 400 });
    }
    const conversation = await assertParticipant(input.conversationId, input.senderUid);
    const peerUid = input.senderUid === conversation.seekerUid ? conversation.providerUid : conversation.seekerUid;
    await (0, chatSafetyService_1.assertChatUnblocked)(input.senderUid, peerUid);
    const message = await Message_1.Message.create({
        conversation: conversation._id,
        senderUid: input.senderUid,
        body,
    });
    const unreadField = peerUid === conversation.seekerUid ? 'seekerUnread' : 'providerUnread';
    const active = (0, realtime_1.isConversationActive)(peerUid, input.conversationId);
    await Conversation_1.Conversation.findByIdAndUpdate(conversation._id, {
        $set: { lastMessageAt: message.createdAt, lastMessagePreview: body.slice(0, 140), ...(active ? { [unreadField]: 0 } : {}) },
        ...(!active ? { $inc: { [unreadField]: 1 } } : {}),
    });
    (0, realtime_1.emitChatMessage)(toMessage(message), peerUid);
    await (0, chatUnreadService_1.publishChatUnread)(peerUid);
    return toMessage(message);
}
async function markConversationRead(conversationId, uid) {
    const conversation = await assertParticipant(conversationId, uid);
    const unreadField = uid === conversation.seekerUid ? 'seekerUnread' : 'providerUnread';
    await Conversation_1.Conversation.updateOne({ _id: conversation._id }, { $set: { [unreadField]: 0 } });
    conversation.set(unreadField, 0);
    await (0, chatUnreadService_1.publishChatUnread)(uid);
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