"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logCallToChat = logCallToChat;
exports.getActiveCallForUser = getActiveCallForUser;
exports.initiateCall = initiateCall;
exports.acceptCall = acceptCall;
exports.rejectCall = rejectCall;
exports.endCall = endCall;
exports.formatCallDoc = formatCallDoc;
exports.getCallById = getCallById;
exports.listCallHistory = listCallHistory;
const mongoose_1 = __importDefault(require("mongoose"));
const Call_1 = require("../models/Call");
const Message_1 = require("../models/Message");
const Conversation_1 = require("../models/Conversation");
const chatService_1 = require("./chatService");
const chatSafetyService_1 = require("./chatSafetyService");
const userService_1 = require("./userService");
const realtime_1 = require("./realtime");
const chatUnreadService_1 = require("./chatUnreadService");
const RING_TIMEOUT_MS = 60000;
const ringingTimers = new Map();
/**
 * Compare-and-set a call's status. The update only applies while the stored status still equals
 * `expected`, so concurrent or repeated hang-ups, rejections and timeouts can never overwrite an
 * outcome that another request already recorded. Returns the updated document, or null if lost.
 */
async function transitionCall(callId, expected, fields) {
    return Call_1.Call.findOneAndUpdate({ _id: callId, status: expected }, { $set: fields }, { returnDocument: 'after' });
}
function clearRingingTimer(callId) {
    const timer = ringingTimers.get(callId);
    if (timer) {
        clearTimeout(timer);
        ringingTimers.delete(callId);
    }
}
/** Close a ringing or accepted call with the outcome its current state implies (missed / completed). */
async function closeActiveCall(call) {
    const now = new Date();
    const fields = call.status === 'accepted'
        ? {
            status: 'completed',
            endedAt: now,
            duration: call.answeredAt
                ? Math.max(0, Math.round((now.getTime() - call.answeredAt.getTime()) / 1000))
                : 0,
        }
        : { status: 'missed', endedAt: now };
    const updated = await transitionCall(call._id, call.status, fields);
    if (updated) {
        clearRingingTimer(updated._id.toString());
        void logCallToChat(updated).catch(() => undefined);
    }
    return updated;
}
async function logCallToChat(call) {
    if (!call || call.hasLoggedChat || !call.conversationId)
        return;
    call.hasLoggedChat = true;
    if (typeof call.save === 'function') {
        await call.save().catch(() => undefined);
    }
    // If MongoDB is not connected (e.g. unit tests), skip DB write to avoid buffering timeout
    if (mongoose_1.default.connection.readyState !== 1) {
        return;
    }
    const conversationId = call.conversationId.toString();
    const callerUid = call.callerId;
    const receiverUid = call.receiverId;
    const isVideo = call.callType === 'video';
    const icon = isVideo ? '📹' : '📞';
    const typeLabel = isVideo ? 'me video' : 'me zë';
    let body = '';
    if (call.status === 'completed' && (call.duration || 0) > 0) {
        const mins = Math.floor((call.duration || 0) / 60);
        const secs = (call.duration || 0) % 60;
        const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        body = `${icon} Thirrja ${typeLabel} përfundoi (${durationStr})`;
    }
    else if (call.status === 'rejected') {
        body = `${icon} Thirrje ${typeLabel} e refuzuar`;
    }
    else if (call.status === 'busy') {
        body = `${icon} Thirrje ${typeLabel} e zënë`;
    }
    else {
        body = `${icon} Thirrje ${typeLabel} e humbur`;
    }
    try {
        const message = await Message_1.Message.create({
            conversation: call.conversationId,
            senderUid: callerUid,
            body,
        });
        if (message?._id) {
            call.chatMessageId = message._id;
            if (typeof call.save === 'function') {
                await call.save().catch(() => undefined);
            }
        }
        const peerUid = receiverUid;
        if (typeof Conversation_1.Conversation?.findById === 'function') {
            const conversation = await Conversation_1.Conversation.findById(call.conversationId).catch(() => null);
            if (conversation) {
                const isPeerSeeker = peerUid === conversation.seekerUid;
                const targetUnreadField = isPeerSeeker ? 'seekerUnread' : 'providerUnread';
                const active = (0, realtime_1.isConversationActive)(peerUid, conversationId);
                if (typeof Conversation_1.Conversation?.findByIdAndUpdate === 'function') {
                    await Conversation_1.Conversation.findByIdAndUpdate(conversation._id, {
                        $set: {
                            lastMessageAt: message?.createdAt || new Date(),
                            lastMessagePreview: body.slice(0, 140),
                            ...(active ? { [targetUnreadField]: 0 } : {}),
                        },
                        ...(!active ? { $inc: { [targetUnreadField]: 1 } } : {}),
                    }).catch(() => undefined);
                }
            }
        }
        const publicMsg = {
            id: message?._id ? message._id.toString() : new mongoose_1.default.Types.ObjectId().toString(),
            conversationId,
            senderUid: callerUid,
            body,
            createdAt: message?.createdAt ? message.createdAt.toISOString() : new Date().toISOString(),
        };
        (0, realtime_1.emitChatMessage)(publicMsg, peerUid);
        await (0, chatUnreadService_1.publishChatUnread)(peerUid).catch(() => undefined);
    }
    catch (err) {
        console.error('[CallService] Failed to record call chat message:', err);
    }
}
async function getActiveCallForUser(uid) {
    const q = Call_1.Call.findOne({
        $or: [{ callerId: uid }, { receiverId: uid }],
        status: { $in: ['ringing', 'accepted'] },
    });
    const active = typeof q?.sort === 'function'
        ? await q.sort({ createdAt: -1 })
        : await q;
    if (!active)
        return null;
    // If a call has been ringing for > 60s without answer, auto-expire it
    if (active.status === 'ringing') {
        const ageMs = Date.now() - active.startedAt.getTime();
        if (ageMs > 60000) {
            await closeActiveCall(active);
            return null;
        }
    }
    // If a call has been in accepted state for > 2 hours without end, auto-complete it
    if (active.status === 'accepted' && active.answeredAt) {
        const ageMs = Date.now() - active.answeredAt.getTime();
        if (ageMs > 2 * 3600 * 1000) {
            await closeActiveCall(active);
            return null;
        }
    }
    return active;
}
async function initiateCall(input) {
    const { callerUid, receiverUid, conversationId, callType } = input;
    if (!callerUid || !receiverUid || !conversationId) {
        throw Object.assign(new Error('Të dhënat e thirrjes janë të paplotësuara'), { status: 400 });
    }
    if (callerUid === receiverUid) {
        throw Object.assign(new Error('Nuk mund të thërrasësh veten'), { status: 400 });
    }
    // 1. Verify caller & receiver belong to this conversation
    const conversation = await (0, chatService_1.assertParticipant)(conversationId, callerUid);
    const peerUid = callerUid === conversation.seekerUid ? conversation.providerUid : conversation.seekerUid;
    if (peerUid !== receiverUid) {
        throw Object.assign(new Error('Marrësi nuk përkon me bisedën'), { status: 400 });
    }
    // 2. Verify chat is not blocked
    await (0, chatSafetyService_1.assertChatUnblocked)(callerUid, receiverUid);
    // 3. Clear any dangling calls for the caller (the caller is explicitly starting a fresh call)
    const priorCallerCalls = await Call_1.Call.find({
        $or: [{ callerId: callerUid }, { receiverId: callerUid }],
        status: { $in: ['ringing', 'accepted'] },
    });
    for (const c of priorCallerCalls) {
        await closeActiveCall(c);
    }
    // 4. Check if receiver is already in an active call with another user
    const receiverActiveCall = await getActiveCallForUser(receiverUid);
    if (receiverActiveCall) {
        // If it's an older interrupted attempt between the same two users, auto-clear it
        const sameParticipants = (receiverActiveCall.callerId === callerUid && receiverActiveCall.receiverId === receiverUid) ||
            (receiverActiveCall.callerId === receiverUid && receiverActiveCall.receiverId === callerUid);
        if (sameParticipants) {
            await closeActiveCall(receiverActiveCall);
        }
        else {
            return {
                busy: true,
                receiverUid,
                message: 'Përdoruesi është në një thirrje tjetër',
            };
        }
    }
    // 5. Generate room name and create Call record
    const roomName = `call_${conversationId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const call = await Call_1.Call.create({
        callerId: callerUid,
        receiverId: receiverUid,
        conversationId: new mongoose_1.default.Types.ObjectId(conversationId),
        roomName,
        callType,
        status: 'ringing',
        startedAt: new Date(),
    });
    // 6. Fetch user profiles for display
    const [callerUser, receiverUser] = await Promise.all([
        (0, userService_1.findUserByUid)(callerUid),
        (0, userService_1.findUserByUid)(receiverUid),
    ]);
    const callerInfo = {
        uid: callerUid,
        name: callerUser?.name || 'Përdorues',
        profilePhoto: callerUser?.profilePhoto,
    };
    const receiverInfo = {
        uid: receiverUid,
        name: receiverUser?.name || 'Përdorues',
        profilePhoto: receiverUser?.profilePhoto,
    };
    const callId = call._id.toString();
    // 7. Schedule ringing timeout
    const timeoutTimer = setTimeout(async () => {
        try {
            ringingTimers.delete(callId);
            const currentCall = await transitionCall(callId, 'ringing', { status: 'missed', endedAt: new Date() });
            if (currentCall) {
                void logCallToChat(currentCall).catch(() => undefined);
                (0, realtime_1.emitToUser)(callerUid, 'call:timeout', { callId, conversationId });
                (0, realtime_1.emitToUser)(receiverUid, 'call:missed', {
                    callId,
                    conversationId,
                    caller: callerInfo,
                    callType,
                });
            }
        }
        catch (err) {
            console.error('Call timeout handler error:', err);
        }
    }, RING_TIMEOUT_MS);
    ringingTimers.set(callId, timeoutTimer);
    return {
        busy: false,
        call,
        caller: callerInfo,
        receiver: receiverInfo,
        roomName,
    };
}
function notAcceptableReason(status) {
    return status === 'missed'
        ? 'Koha e thirrjes ka mbaruar ose thirrja u mbyll nga thirrësi'
        : status === 'rejected'
            ? 'Thirrja është refuzuar'
            : status === 'completed'
                ? 'Thirrja ka përfunduar tashmë'
                : `Thirrja nuk mund të pranohet (statusi: ${status})`;
}
async function loadParticipantCall(callId, uid) {
    if (!mongoose_1.default.isValidObjectId(callId)) {
        throw Object.assign(new Error('Thirrje e pavlefshme'), { status: 400 });
    }
    const call = await Call_1.Call.findById(callId);
    if (!call) {
        throw Object.assign(new Error('Thirrja nuk u gjet'), { status: 404 });
    }
    if (call.receiverId !== uid && call.callerId !== uid) {
        throw Object.assign(new Error('Nuk ke leje për këtë thirrje'), { status: 403 });
    }
    return call;
}
async function acceptCall(callId, uid) {
    if (!mongoose_1.default.isValidObjectId(callId)) {
        throw Object.assign(new Error('Thirrje e pavlefshme'), { status: 400 });
    }
    const call = await Call_1.Call.findById(callId);
    if (!call) {
        throw Object.assign(new Error('Thirrja nuk u gjet'), { status: 404 });
    }
    if (call.receiverId !== uid) {
        throw Object.assign(new Error('Vetëm marrësi mund të pranojë thirrjen'), { status: 403 });
    }
    if (call.status !== 'ringing') {
        throw Object.assign(new Error(notAcceptableReason(call.status)), { status: 400 });
    }
    // Only a still-ringing call can be accepted; a concurrent cancel/timeout wins otherwise.
    const accepted = await transitionCall(call._id, 'ringing', { status: 'accepted', answeredAt: new Date() });
    if (!accepted) {
        const latest = await Call_1.Call.findById(callId);
        throw Object.assign(new Error(notAcceptableReason(latest?.status ?? 'missed')), { status: 400 });
    }
    clearRingingTimer(callId);
    return accepted;
}
/**
 * Reject (or report busy for) a ringing call. Idempotent: rejecting a call that already reached
 * any other state leaves its recorded outcome untouched and returns `changed: false`.
 */
async function rejectCall(callId, uid, reason) {
    const call = await loadParticipantCall(callId, uid);
    if (call.status !== 'ringing')
        return { call, changed: false };
    const rejected = await transitionCall(call._id, 'ringing', {
        status: reason === 'busy' ? 'busy' : 'rejected',
        endedAt: new Date(),
    });
    if (!rejected) {
        return { call: (await Call_1.Call.findById(callId)) ?? call, changed: false };
    }
    clearRingingTimer(callId);
    void logCallToChat(rejected).catch(() => undefined);
    return { call: rejected, changed: true };
}
/**
 * End a call: accepted -> completed (with duration), ringing -> missed (caller cancelled).
 * Idempotent: ending an already-finished call preserves its original outcome (`changed: false`).
 */
async function endCall(callId, uid) {
    let call = await loadParticipantCall(callId, uid);
    // Two attempts cover the race where the call is accepted between our read and our write.
    for (let attempt = 0; attempt < 2; attempt++) {
        if (call.status !== 'ringing' && call.status !== 'accepted')
            break;
        const ended = await closeActiveCall(call);
        if (ended)
            return { call: ended, duration: ended.duration || 0, changed: true };
        const latest = await Call_1.Call.findById(callId);
        if (!latest)
            break;
        call = latest;
    }
    return { call, duration: call.duration || 0, changed: false };
}
async function formatCallDoc(call, currentUid) {
    const isCaller = call.callerId === currentUid;
    const peerUid = isCaller ? call.receiverId : call.callerId;
    const peer = await (0, userService_1.findUserByUid)(peerUid);
    return {
        id: call._id.toString(),
        conversationId: call.conversationId.toString(),
        roomName: call.roomName,
        callType: call.callType,
        status: call.status,
        isCaller,
        startedAt: call.startedAt.toISOString(),
        answeredAt: call.answeredAt ? call.answeredAt.toISOString() : null,
        endedAt: call.endedAt ? call.endedAt.toISOString() : null,
        duration: call.duration || 0,
        peer: {
            uid: peerUid,
            name: peer?.name || 'Përdorues',
            profilePhoto: peer?.profilePhoto,
        },
    };
}
async function getCallById(callId, uid) {
    if (!mongoose_1.default.isValidObjectId(callId)) {
        throw Object.assign(new Error('Thirrje e pavlefshme'), { status: 400 });
    }
    const call = await Call_1.Call.findById(callId);
    if (!call) {
        throw Object.assign(new Error('Thirrja nuk u gjet'), { status: 404 });
    }
    if (call.callerId !== uid && call.receiverId !== uid) {
        throw Object.assign(new Error('Nuk ke leje për këtë thirrje'), { status: 403 });
    }
    return call;
}
async function listCallHistory(uid, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;
    const filter = {
        $or: [{ callerId: uid }, { receiverId: uid }],
    };
    const [calls, total] = await Promise.all([
        Call_1.Call.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(safeLimit)
            .lean(),
        Call_1.Call.countDocuments(filter),
    ]);
    const peerUids = [...new Set(calls.map((c) => (c.callerId === uid ? c.receiverId : c.callerId)))];
    const peers = await (0, userService_1.findUsersByUids)(peerUids);
    const items = calls.map((c) => {
        const isCaller = c.callerId === uid;
        const peerUid = isCaller ? c.receiverId : c.callerId;
        const peer = peers.get(peerUid);
        return {
            id: c._id.toString(),
            conversationId: c.conversationId.toString(),
            roomName: c.roomName,
            callType: c.callType,
            status: c.status,
            isCaller,
            startedAt: c.startedAt.toISOString(),
            answeredAt: c.answeredAt ? c.answeredAt.toISOString() : null,
            endedAt: c.endedAt ? c.endedAt.toISOString() : null,
            duration: c.duration || 0,
            peer: {
                uid: peerUid,
                name: peer?.name || 'Përdorues',
                profilePhoto: peer?.profilePhoto,
            },
        };
    });
    return {
        calls: items,
        pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            hasMore: skip + calls.length < total,
        },
    };
}
//# sourceMappingURL=callService.js.map