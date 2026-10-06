import { Conversation } from '../models/Conversation'
import { emitToUser } from './realtime'

export async function chatUnreadCount(uid: string) {
  const totals = await Conversation.aggregate<{ unread: number }>([
    { $match: { $or: [{ seekerUid: uid }, { providerUid: uid }] } },
    { $group: { _id: null, unread: { $sum: { $cond: [{ $eq: ['$seekerUid', uid] }, '$seekerUnread', '$providerUnread'] } } } },
  ])
  return totals[0]?.unread ?? 0
}
const pendingCounts = new Map<string, symbol>()
export async function publishChatUnread(uid: string) {
  const revision = Symbol()
  pendingCounts.set(uid, revision)
  try {
    const unreadCount = await chatUnreadCount(uid)
    if (pendingCounts.get(uid) === revision) emitToUser(uid, 'chat:unread', { unreadCount })
  }
  catch (error) { console.error('Chat unread sync failed', error) }
  finally { if (pendingCounts.get(uid) === revision) pendingCounts.delete(uid) }
}
