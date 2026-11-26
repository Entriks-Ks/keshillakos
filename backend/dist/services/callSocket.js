"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCallHandlers = registerCallHandlers;
const callService_1 = require("./callService");
const realtime_1 = require("./realtime");
const Call_1 = require("../models/Call");
function registerCallHandlers(io) {
    io.on('connection', async (socket) => {
        const user = socket.data.user;
        if (!user?.uid)
            return;
        // Auto-join active call room if user was already in an accepted call (e.g. reconnect)
        try {
            const active = await (0, callService_1.getActiveCallForUser)(user.uid);
            if (active && active.status === 'accepted') {
                const activeCallId = active._id.toString();
                void socket.join(`call:${activeCallId}`);
                // Clears any "peer disconnected" warning the other participant is showing.
                const peerUid = active.callerId === user.uid ? active.receiverId : active.callerId;
                (0, realtime_1.emitToUser)(peerUid, 'call:peer-reconnected', { callId: activeCallId, uid: user.uid });
            }
        }
        catch {
            // Ignore initial lookup failure
        }
        socket.on('call:initiate', async (payload, ack) => {
            try {
                const { conversationId, receiverUid, callType = 'video' } = payload || {};
                if (!conversationId || !receiverUid) {
                    throw new Error('Të dhënat e thirrjes janë të paplotësuara');
                }
                const result = await (0, callService_1.initiateCall)({
                    callerUid: user.uid,
                    receiverUid,
                    conversationId,
                    callType,
                });
                if (result.busy || !result.call) {
                    if (typeof ack === 'function') {
                        ack({
                            ok: false,
                            busy: result.busy,
                            error: result.message || 'Përdoruesi është i zënë',
                        });
                    }
                    return;
                }
                const callId = result.call._id.toString();
                void socket.join(`call:${callId}`);
                const incomingPayload = {
                    callId,
                    conversationId,
                    caller: result.caller,
                    callType,
                    roomName: result.roomName,
                };
                // Notify receiver via their personal room (both server-wide and direct io)
                (0, realtime_1.emitToUser)(receiverUid, 'call:incoming', incomingPayload);
                io.to(`user:${receiverUid}`).emit('call:incoming', incomingPayload);
                if (typeof ack === 'function') {
                    ack({
                        ok: true,
                        callId,
                        roomName: result.roomName,
                    });
                }
            }
            catch (err) {
                if (typeof ack === 'function') {
                    ack({
                        ok: false,
                        error: err instanceof Error ? err.message : 'Dështoi nisja e thirrjes',
                    });
                }
            }
        });
        socket.on('call:accept', async (payload, ack) => {
            try {
                const callId = payload?.callId;
                if (!callId)
                    throw new Error('Mungon ID e thirrjes');
                const call = await (0, callService_1.acceptCall)(callId, user.uid);
                void socket.join(`call:${callId}`);
                const acceptPayload = {
                    callId,
                    roomName: call.roomName,
                    acceptedBy: user.uid,
                };
                // Emit to both participants
                (0, realtime_1.emitToUser)(call.callerId, 'call:accepted', acceptPayload);
                (0, realtime_1.emitToUser)(call.receiverId, 'call:accepted', acceptPayload);
                io.to(`call:${callId}`).emit('call:accepted', acceptPayload);
                if (typeof ack === 'function') {
                    ack({
                        ok: true,
                        callId,
                        roomName: call.roomName,
                    });
                }
            }
            catch (err) {
                if (typeof ack === 'function') {
                    ack({
                        ok: false,
                        error: err instanceof Error ? err.message : 'Pranimi dështoi',
                    });
                }
            }
        });
        socket.on('call:reject', async (payload, ack) => {
            try {
                const callId = payload?.callId;
                if (!callId)
                    throw new Error('Mungon ID e thirrjes');
                const { call, changed } = await (0, callService_1.rejectCall)(callId, user.uid, payload.reason);
                // A duplicate or late rejection must not announce a new outcome for a finished call.
                if (!changed) {
                    if (typeof ack === 'function')
                        ack({ ok: true });
                    return;
                }
                const rejectPayload = {
                    callId,
                    rejectedBy: user.uid,
                    reason: payload.reason || 'rejected',
                };
                (0, realtime_1.emitToUser)(call.callerId, 'call:rejected', rejectPayload);
                (0, realtime_1.emitToUser)(call.receiverId, 'call:rejected', rejectPayload);
                io.to(`call:${callId}`).emit('call:rejected', rejectPayload);
                if (typeof ack === 'function')
                    ack({ ok: true });
            }
            catch (err) {
                if (typeof ack === 'function') {
                    ack({
                        ok: false,
                        error: err instanceof Error ? err.message : 'Refuzimi dështoi',
                    });
                }
            }
        });
        socket.on('call:end', async (payload, ack) => {
            try {
                const callId = payload?.callId;
                if (!callId)
                    throw new Error('Mungon ID e thirrjes');
                const { call, duration, changed } = await (0, callService_1.endCall)(callId, user.uid);
                if (!changed) {
                    if (typeof ack === 'function')
                        ack({ ok: true, duration });
                    return;
                }
                const endPayload = {
                    callId,
                    endedBy: user.uid,
                    duration,
                };
                (0, realtime_1.emitToUser)(call.callerId, 'call:ended', endPayload);
                (0, realtime_1.emitToUser)(call.receiverId, 'call:ended', endPayload);
                io.to(`call:${callId}`).emit('call:ended', endPayload);
                if (typeof ack === 'function')
                    ack({ ok: true, duration });
            }
            catch (err) {
                if (typeof ack === 'function') {
                    ack({
                        ok: false,
                        error: err instanceof Error ? err.message : 'Mbyllja e thirrjes dështoi',
                    });
                }
            }
        });
        socket.on('call:toggle-media', (payload) => {
            if (!payload?.callId)
                return;
            socket.to(`call:${payload.callId}`).emit('call:peer-media-toggle', {
                callId: payload.callId,
                uid: user.uid,
                mediaType: payload.mediaType,
                enabled: payload.enabled,
            });
        });
        socket.on('disconnect', async () => {
            try {
                // Check if user still has other active sockets (e.g. chat socket, multiple tabs, transport upgrade)
                const userRoom = io.sockets.adapter.rooms.get(`user:${user.uid}`);
                if (userRoom && userRoom.size > 0) {
                    // User is still connected on another socket - do not interrupt calls
                    return;
                }
                const activeCall = await (0, callService_1.getActiveCallForUser)(user.uid);
                if (!activeCall)
                    return;
                const callId = activeCall._id.toString();
                const isCaller = activeCall.callerId === user.uid;
                const peerUid = isCaller ? activeCall.receiverId : activeCall.callerId;
                if (activeCall.status === 'ringing') {
                    // Only if the CALLER has no remaining sockets, give a grace period before cancelling
                    if (isCaller) {
                        setTimeout(async () => {
                            try {
                                const reconnectedRoom = io.sockets.adapter.rooms.get(`user:${user.uid}`);
                                if (reconnectedRoom && reconnectedRoom.size > 0) {
                                    // Caller reconnected within grace period
                                    return;
                                }
                                const currentCall = await (0, callService_1.getActiveCallForUser)(user.uid);
                                if (currentCall && currentCall._id.toString() === callId && currentCall.status === 'ringing') {
                                    const { changed } = await (0, callService_1.endCall)(callId, user.uid);
                                    if (changed)
                                        (0, realtime_1.emitToUser)(peerUid, 'call:ended', {
                                            callId,
                                            endedBy: user.uid,
                                            reason: 'caller_disconnected',
                                        });
                                }
                            }
                            catch (timeoutErr) {
                                console.error('Call disconnect grace timeout error:', timeoutErr);
                            }
                        }, 8000);
                    }
                    // If the receiver disconnected one socket, do NOT cancel the call. The caller is still ringing.
                }
                else if (activeCall.status === 'accepted') {
                    // Emit peer disconnected warning to room and user rooms
                    const peerUid = isCaller ? activeCall.receiverId : activeCall.callerId;
                    (0, realtime_1.emitToUser)(peerUid, 'call:peer-disconnected', { callId, uid: user.uid });
                    io.to(`call:${callId}`).emit('call:peer-disconnected', {
                        callId,
                        uid: user.uid,
                    });
                    // If the user closed the window/tab, end the call after 10s if they haven't reconnected
                    setTimeout(async () => {
                        try {
                            const checkRoom = io.sockets.adapter.rooms.get(`user:${user.uid}`);
                            if (checkRoom && checkRoom.size > 0)
                                return;
                            const currentCall = await Call_1.Call.findById(callId);
                            if (currentCall && currentCall.status === 'accepted') {
                                const { duration, changed } = await (0, callService_1.endCall)(callId, user.uid);
                                if (!changed)
                                    return;
                                const endPayload = {
                                    callId,
                                    endedBy: user.uid,
                                    duration,
                                    reason: 'peer_disconnected',
                                };
                                (0, realtime_1.emitToUser)(currentCall.callerId, 'call:ended', endPayload);
                                (0, realtime_1.emitToUser)(currentCall.receiverId, 'call:ended', endPayload);
                                io.to(`call:${callId}`).emit('call:ended', endPayload);
                            }
                        }
                        catch (err) {
                            console.error('Accepted call disconnect cleanup error:', err);
                        }
                    }, 10000);
                }
            }
            catch (err) {
                console.error('Call socket disconnect cleanup error:', err);
            }
        });
    });
}
//# sourceMappingURL=callSocket.js.map