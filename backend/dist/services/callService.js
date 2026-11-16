"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const chatService_1 = require("./chatService");
const chatSafetyService_1 = require("./chatSafetyService");
const userService_1 = require("./userService");
const realtime_1 = require("./realtime");
const RING_TIMEOUT_MS = 60000;
const ringingTimers = new Map();
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
            active.status = 'missed';
            active.endedAt = new Date();
            await active.save();
            return null;
        }
    }
    // If a call has been in accepted state for > 2 hours without end, auto-complete it
    if (active.status === 'accepted' && active.answeredAt) {
        const ageMs = Date.now() - active.answeredAt.getTime();
        if (ageMs > 2 * 3600 * 1000) {
            active.status = 'completed';
            active.endedAt = new Date();
            await active.save();
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
        c.status = c.status === 'accepted' ? 'completed' : 'missed';
        c.endedAt = new Date();
        if (c.answeredAt) {
            c.duration = Math.max(0, Math.round((c.endedAt.getTime() - c.answeredAt.getTime()) / 1000));
        }
        await c.save();
    }
    // 4. Check if receiver is already in an active call with another user
    const receiverActiveCall = await getActiveCallForUser(receiverUid);
    if (receiverActiveCall) {
        // If it's an older interrupted attempt between the same two users, auto-clear it
        const sameParticipants = (receiverActiveCall.callerId === callerUid && receiverActiveCall.receiverId === receiverUid) ||
            (receiverActiveCall.callerId === receiverUid && receiverActiveCall.receiverId === callerUid);
        if (sameParticipants) {
            receiverActiveCall.status = receiverActiveCall.status === 'accepted' ? 'completed' : 'missed';
            receiverActiveCall.endedAt = new Date();
            await receiverActiveCall.save();
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
            const currentCall = await Call_1.Call.findById(callId);
            if (currentCall && currentCall.status === 'ringing') {
                currentCall.status = 'missed';
                currentCall.endedAt = new Date();
                await currentCall.save();
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
        const reasonMsg = call.status === 'missed'
            ? 'Koha e thirrjes ka mbaruar ose thirrja u mbyll nga thirrësi'
            : call.status === 'rejected'
                ? 'Thirrja është refuzuar'
                : call.status === 'completed'
                    ? 'Thirrja ka përfunduar tashmë'
                    : `Thirrja nuk mund të pranohet (statusi: ${call.status})`;
        throw Object.assign(new Error(reasonMsg), { status: 400 });
    }
    const timer = ringingTimers.get(callId);
    if (timer) {
        clearTimeout(timer);
        ringingTimers.delete(callId);
    }
    call.status = 'accepted';
    call.answeredAt = new Date();
    await call.save();
    return call;
}
async function rejectCall(callId, uid, reason) {
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
    const timer = ringingTimers.get(callId);
    if (timer) {
        clearTimeout(timer);
        ringingTimers.delete(callId);
    }
    const newStatus = reason === 'busy' ? 'busy' : 'rejected';
    call.status = newStatus;
    call.endedAt = new Date();
    await call.save();
    return call;
}
async function endCall(callId, uid) {
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
    const timer = ringingTimers.get(callId);
    if (timer) {
        clearTimeout(timer);
        ringingTimers.delete(callId);
    }
    const now = new Date();
    let duration = 0;
    if (call.answeredAt) {
        duration = Math.max(0, Math.round((now.getTime() - call.answeredAt.getTime()) / 1000));
    }
    call.status = call.status === 'accepted' ? 'completed' : 'missed';
    call.endedAt = now;
    call.duration = duration;
    await call.save();
    return { call, duration };
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