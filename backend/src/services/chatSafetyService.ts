import { ChatBlock } from '../models/ChatBlock'
import { PlatformFeedback } from '../models/PlatformFeedback'
import { Conversation } from '../models/Conversation'
import { findUserByUid } from './userService'
import { emitToUser } from './realtime'
import { notifyAdmins } from './notificationService'

export async function chatAvailability(uid: string, peerUid: string) {
  const blocks = await ChatBlock.find({ $or: [{ blockerUid: uid, blockedUid: peerUid }, { blockerUid: peerUid, blockedUid: uid }] }).lean()
  return { blockedByMe: blocks.some(b => b.blockerUid === uid), messagingBlocked: blocks.length > 0 }
}

export async function assertChatUnblocked(uid: string, peerUid: string) {
  if ((await chatAvailability(uid, peerUid)).messagingBlocked) {
    throw Object.assign(new Error('Mesazhet janë të bllokuara për këtë bisedë'), { status: 403 })
  }
}

// The caller must obtain the conversation through assertParticipant first.
export async function setChatBlock(conversation: { _id: { toString(): string }; seekerUid: string; providerUid: string }, uid: string, blocked: boolean) {
  if (uid !== conversation.seekerUid && uid !== conversation.providerUid) throw Object.assign(new Error('Nuk ke leje për këtë bisedë'), { status: 403 })
  const peerUid = uid === conversation.seekerUid ? conversation.providerUid : conversation.seekerUid
  if (blocked) await ChatBlock.updateOne({ blockerUid: uid, blockedUid: peerUid }, { $setOnInsert: { blockerUid: uid, blockedUid: peerUid } }, { upsert: true })
  else await ChatBlock.deleteOne({ blockerUid: uid, blockedUid: peerUid })
  // Notify only the affected threads, including reverse-role threads and other tabs.
  const threads = await Conversation.find({ $or: [{ seekerUid: uid, providerUid: peerUid }, { seekerUid: peerUid, providerUid: uid }] }).select('_id').lean()
  const [mine, theirs] = await Promise.all([chatAvailability(uid, peerUid), chatAvailability(peerUid, uid)])
  for (const thread of threads) {
    emitToUser(uid, 'chat:availability', { conversationId: String(thread._id), ...mine })
    emitToUser(peerUid, 'chat:availability', { conversationId: String(thread._id), ...theirs })
  }
  return mine
}

export async function reportChatUser(conversation: { _id: { toString(): string }; seekerUid: string; providerUid: string }, uid: string, reason: unknown) {
  if (uid !== conversation.seekerUid && uid !== conversation.providerUid) throw Object.assign(new Error('Nuk ke leje për këtë bisedë'), { status: 403 })
  const text = typeof reason === 'string' ? reason.trim() : ''
  if (text.length < 5 || text.length > 500) throw Object.assign(new Error('Shkruaj një arsye prej 5–500 karakteresh'), { status: 400 })
  const conversationId = String(conversation._id)
  const pending = await PlatformFeedback.exists({ userUid: uid, 'chatReport.conversationId': conversationId, status: 'new' })
  if (pending) return
  const user = await findUserByUid(uid)
  const reportedUid = uid === conversation.seekerUid ? conversation.providerUid : conversation.seekerUid
  try {
    const feedback = await PlatformFeedback.create({
      userUid: uid, name: user?.name || 'Përdorues', email: user?.email || '', status: 'new',
      message: text,
      chatReport: { conversationId, reportedUid, reason: text, reviewStatus: 'new' },
    })
    await notifyAdmins({ type: 'report:new', title: 'Raportim i ri përdoruesi', href: '/dashboard/admin/reports', eventKey: `feedback:${feedback._id}`, actorUid: uid })
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
  }
}
