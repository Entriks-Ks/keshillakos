import mongoose, { type HydratedDocument } from 'mongoose'
import { Call, type CallDoc, type CallType } from '../models/Call'
export type { CallType }
import { Message } from '../models/Message'
import { Conversation } from '../models/Conversation'
import { assertParticipant } from './chatService'
import { assertChatUnblocked } from './chatSafetyService'
import { findUserByUid, findUsersByUids } from './userService'
import { emitToUser, emitChatMessage, isConversationActive } from './realtime'
import { publishChatUnread } from './chatUnreadService'

const RING_TIMEOUT_MS = 60_000
const ringingTimers = new Map<string, NodeJS.Timeout>()

export async function logCallToChat(call: HydratedDocument<CallDoc> | any): Promise<void> {
  if (!call || call.hasLoggedChat || !call.conversationId) return
  call.hasLoggedChat = true
  if (typeof call.save === 'function') {
    await call.save().catch(() => undefined)
  }

  // If MongoDB is not connected (e.g. unit tests), skip DB write to avoid buffering timeout
  if (mongoose.connection.readyState !== 1) {
    return
  }

  const conversationId = call.conversationId.toString()
  const callerUid = call.callerId
  const receiverUid = call.receiverId
  const isVideo = call.callType === 'video'
  const icon = isVideo ? '📹' : '📞'
  const typeLabel = isVideo ? 'me video' : 'me zë'

  let body = ''
  if (call.status === 'completed' && (call.duration || 0) > 0) {
    const mins = Math.floor((call.duration || 0) / 60)
    const secs = (call.duration || 0) % 60
    const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
    body = `${icon} Thirrja ${typeLabel} përfundoi (${durationStr})`
  } else if (call.status === 'rejected') {
    body = `${icon} Thirrje ${typeLabel} e refuzuar`
  } else if (call.status === 'busy') {
    body = `${icon} Thirrje ${typeLabel} e zënë`
  } else {
    body = `${icon} Thirrje ${typeLabel} e humbur`
  }

  try {
    const message = await Message.create({
      conversation: call.conversationId,
      senderUid: callerUid,
      body,
    })

    if (message?._id) {
      call.chatMessageId = message._id
      if (typeof call.save === 'function') {
        await call.save().catch(() => undefined)
      }
    }

    const peerUid = receiverUid
    if (typeof Conversation?.findById === 'function') {
      const conversation = await Conversation.findById(call.conversationId).catch(() => null)
      if (conversation) {
        const isPeerSeeker = peerUid === conversation.seekerUid
        const targetUnreadField = isPeerSeeker ? 'seekerUnread' : 'providerUnread'
        const active = isConversationActive(peerUid, conversationId)

        if (typeof Conversation?.findByIdAndUpdate === 'function') {
          await Conversation.findByIdAndUpdate(conversation._id, {
            $set: {
              lastMessageAt: message?.createdAt || new Date(),
              lastMessagePreview: body.slice(0, 140),
              ...(active ? { [targetUnreadField]: 0 } : {}),
            },
            ...(!active ? { $inc: { [targetUnreadField]: 1 } } : {}),
          }).catch(() => undefined)
        }
      }
    }

    const publicMsg = {
      id: message?._id ? message._id.toString() : new mongoose.Types.ObjectId().toString(),
      conversationId,
      senderUid: callerUid,
      body,
      createdAt: message?.createdAt ? message.createdAt.toISOString() : new Date().toISOString(),
    }

    emitChatMessage(publicMsg, peerUid)
    await publishChatUnread(peerUid).catch(() => undefined)
  } catch (err) {
    console.error('[CallService] Failed to record call chat message:', err)
  }
}

export type InitiateCallInput = {
  callerUid: string
  receiverUid: string
  conversationId: string
  callType: CallType
}

export type CallParticipantInfo = {
  uid: string
  name: string
  profilePhoto?: string
}

export async function getActiveCallForUser(uid: string) {
  const q = Call.findOne({
    $or: [{ callerId: uid }, { receiverId: uid }],
    status: { $in: ['ringing', 'accepted'] },
  })

  const active = typeof (q as { sort?: unknown })?.sort === 'function'
    ? await (q as { sort: (s: Record<string, number>) => Promise<HydratedDocument<CallDoc> | null> }).sort({ createdAt: -1 })
    : await q

  if (!active) return null

  // If a call has been ringing for > 60s without answer, auto-expire it
  if (active.status === 'ringing') {
    const ageMs = Date.now() - active.startedAt.getTime()
    if (ageMs > 60_000) {
      active.status = 'missed'
      active.endedAt = new Date()
      await active.save()
      void logCallToChat(active).catch(() => undefined)
      return null
    }
  }

  // If a call has been in accepted state for > 2 hours without end, auto-complete it
  if (active.status === 'accepted' && active.answeredAt) {
    const ageMs = Date.now() - active.answeredAt.getTime()
    if (ageMs > 2 * 3600 * 1000) {
      active.status = 'completed'
      active.endedAt = new Date()
      await active.save()
      void logCallToChat(active).catch(() => undefined)
      return null
    }
  }

  return active
}

export async function initiateCall(input: InitiateCallInput) {
  const { callerUid, receiverUid, conversationId, callType } = input

  if (!callerUid || !receiverUid || !conversationId) {
    throw Object.assign(new Error('Të dhënat e thirrjes janë të paplotësuara'), { status: 400 })
  }

  if (callerUid === receiverUid) {
    throw Object.assign(new Error('Nuk mund të thërrasësh veten'), { status: 400 })
  }

  // 1. Verify caller & receiver belong to this conversation
  const conversation = await assertParticipant(conversationId, callerUid)
  const peerUid = callerUid === conversation.seekerUid ? conversation.providerUid : conversation.seekerUid
  if (peerUid !== receiverUid) {
    throw Object.assign(new Error('Marrësi nuk përkon me bisedën'), { status: 400 })
  }

  // 2. Verify chat is not blocked
  await assertChatUnblocked(callerUid, receiverUid)

  // 3. Clear any dangling calls for the caller (the caller is explicitly starting a fresh call)
  const priorCallerCalls = await Call.find({
    $or: [{ callerId: callerUid }, { receiverId: callerUid }],
    status: { $in: ['ringing', 'accepted'] },
  })
  for (const c of priorCallerCalls) {
    c.status = c.status === 'accepted' ? 'completed' : 'missed'
    c.endedAt = new Date()
    if (c.answeredAt) {
      c.duration = Math.max(0, Math.round((c.endedAt.getTime() - c.answeredAt.getTime()) / 1000))
    }
    await c.save()
    void logCallToChat(c).catch(() => undefined)
  }

  // 4. Check if receiver is already in an active call with another user
  const receiverActiveCall = await getActiveCallForUser(receiverUid)
  if (receiverActiveCall) {
    // If it's an older interrupted attempt between the same two users, auto-clear it
    const sameParticipants =
      (receiverActiveCall.callerId === callerUid && receiverActiveCall.receiverId === receiverUid) ||
      (receiverActiveCall.callerId === receiverUid && receiverActiveCall.receiverId === callerUid)

    if (sameParticipants) {
      receiverActiveCall.status = receiverActiveCall.status === 'accepted' ? 'completed' : 'missed'
      receiverActiveCall.endedAt = new Date()
      await receiverActiveCall.save()
      void logCallToChat(receiverActiveCall).catch(() => undefined)
    } else {
      return {
        busy: true,
        receiverUid,
        message: 'Përdoruesi është në një thirrje tjetër',
      }
    }
  }

  // 5. Generate room name and create Call record
  const roomName = `call_${conversationId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const call = await Call.create({
    callerId: callerUid,
    receiverId: receiverUid,
    conversationId: new mongoose.Types.ObjectId(conversationId),
    roomName,
    callType,
    status: 'ringing',
    startedAt: new Date(),
  })

  // 6. Fetch user profiles for display
  const [callerUser, receiverUser] = await Promise.all([
    findUserByUid(callerUid),
    findUserByUid(receiverUid),
  ])

  const callerInfo: CallParticipantInfo = {
    uid: callerUid,
    name: callerUser?.name || 'Përdorues',
    profilePhoto: callerUser?.profilePhoto,
  }

  const receiverInfo: CallParticipantInfo = {
    uid: receiverUid,
    name: receiverUser?.name || 'Përdorues',
    profilePhoto: receiverUser?.profilePhoto,
  }

  const callId = call._id.toString()

  // 7. Schedule ringing timeout
  const timeoutTimer = setTimeout(async () => {
    try {
      ringingTimers.delete(callId)
      const currentCall = await Call.findById(callId)
      if (currentCall && currentCall.status === 'ringing') {
        currentCall.status = 'missed'
        currentCall.endedAt = new Date()
        await currentCall.save()
        void logCallToChat(currentCall).catch(() => undefined)

        emitToUser(callerUid, 'call:timeout', { callId, conversationId })
        emitToUser(receiverUid, 'call:missed', {
          callId,
          conversationId,
          caller: callerInfo,
          callType,
        })
      }
    } catch (err) {
      console.error('Call timeout handler error:', err)
    }
  }, RING_TIMEOUT_MS)

  ringingTimers.set(callId, timeoutTimer)

  return {
    busy: false,
    call,
    caller: callerInfo,
    receiver: receiverInfo,
    roomName,
  }
}

export async function acceptCall(callId: string, uid: string) {
  if (!mongoose.isValidObjectId(callId)) {
    throw Object.assign(new Error('Thirrje e pavlefshme'), { status: 400 })
  }

  const call = await Call.findById(callId)
  if (!call) {
    throw Object.assign(new Error('Thirrja nuk u gjet'), { status: 404 })
  }

  if (call.receiverId !== uid) {
    throw Object.assign(new Error('Vetëm marrësi mund të pranojë thirrjen'), { status: 403 })
  }

  if (call.status !== 'ringing') {
    const reasonMsg =
      call.status === 'missed'
        ? 'Koha e thirrjes ka mbaruar ose thirrja u mbyll nga thirrësi'
        : call.status === 'rejected'
        ? 'Thirrja është refuzuar'
        : call.status === 'completed'
        ? 'Thirrja ka përfunduar tashmë'
        : `Thirrja nuk mund të pranohet (statusi: ${call.status})`
    throw Object.assign(new Error(reasonMsg), { status: 400 })
  }

  const timer = ringingTimers.get(callId)
  if (timer) {
    clearTimeout(timer)
    ringingTimers.delete(callId)
  }

  call.status = 'accepted'
  call.answeredAt = new Date()
  await call.save()

  return call
}

export async function rejectCall(callId: string, uid: string, reason?: string) {
  if (!mongoose.isValidObjectId(callId)) {
    throw Object.assign(new Error('Thirrje e pavlefshme'), { status: 400 })
  }

  const call = await Call.findById(callId)
  if (!call) {
    throw Object.assign(new Error('Thirrja nuk u gjet'), { status: 404 })
  }

  if (call.receiverId !== uid && call.callerId !== uid) {
    throw Object.assign(new Error('Nuk ke leje për këtë thirrje'), { status: 403 })
  }

  const timer = ringingTimers.get(callId)
  if (timer) {
    clearTimeout(timer)
    ringingTimers.delete(callId)
  }

  const newStatus = reason === 'busy' ? 'busy' : 'rejected'
  call.status = newStatus
  call.endedAt = new Date()
  await call.save()
  void logCallToChat(call).catch(() => undefined)

  return call
}

export async function endCall(callId: string, uid: string) {
  if (!mongoose.isValidObjectId(callId)) {
    throw Object.assign(new Error('Thirrje e pavlefshme'), { status: 400 })
  }

  const call = await Call.findById(callId)
  if (!call) {
    throw Object.assign(new Error('Thirrja nuk u gjet'), { status: 404 })
  }

  if (call.receiverId !== uid && call.callerId !== uid) {
    throw Object.assign(new Error('Nuk ke leje për këtë thirrje'), { status: 403 })
  }

  const timer = ringingTimers.get(callId)
  if (timer) {
    clearTimeout(timer)
    ringingTimers.delete(callId)
  }

  const now = new Date()
  let duration = 0
  if (call.answeredAt) {
    duration = Math.max(0, Math.round((now.getTime() - call.answeredAt.getTime()) / 1000))
  }

  call.status = call.status === 'accepted' ? 'completed' : 'missed'
  call.endedAt = now
  call.duration = duration
  await call.save()
  void logCallToChat(call).catch(() => undefined)

  return { call, duration }
}

export async function formatCallDoc(call: HydratedDocument<CallDoc>, currentUid: string) {
  const isCaller = call.callerId === currentUid
  const peerUid = isCaller ? call.receiverId : call.callerId
  const peer = await findUserByUid(peerUid)
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
  }
}

export async function getCallById(callId: string, uid: string) {
  if (!mongoose.isValidObjectId(callId)) {
    throw Object.assign(new Error('Thirrje e pavlefshme'), { status: 400 })
  }

  const call = await Call.findById(callId)
  if (!call) {
    throw Object.assign(new Error('Thirrja nuk u gjet'), { status: 404 })
  }

  if (call.callerId !== uid && call.receiverId !== uid) {
    throw Object.assign(new Error('Nuk ke leje për këtë thirrje'), { status: 403 })
  }

  return call
}

export async function listCallHistory(uid: string, page = 1, limit = 20) {
  const safePage = Math.max(1, page)
  const safeLimit = Math.min(50, Math.max(1, limit))
  const skip = (safePage - 1) * safeLimit

  const filter = {
    $or: [{ callerId: uid }, { receiverId: uid }],
  }

  const [calls, total] = await Promise.all([
    Call.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Call.countDocuments(filter),
  ])

  const peerUids = [...new Set(calls.map((c) => (c.callerId === uid ? c.receiverId : c.callerId)))]
  const peers = await findUsersByUids(peerUids)

  const items = calls.map((c) => {
    const isCaller = c.callerId === uid
    const peerUid = isCaller ? c.receiverId : c.callerId
    const peer = peers.get(peerUid)
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
    }
  })

  return {
    calls: items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: skip + calls.length < total,
    },
  }
}
