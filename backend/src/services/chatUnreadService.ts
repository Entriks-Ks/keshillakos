import { Conversation } from '../models/Conversation'
import { emitToUser } from './realtime'

/** Each counter belongs to that participant's unread incoming messages. */
async function aggregateChatUnread(uid: string) {
  const recipientUnread = { $cond: [{ $eq: ['$seekerUid', uid] }, '$seekerUnread', '$providerUnread'] }
  const totals = await Conversation.aggregate<{ total: number; unread: number; unreadConversations: number }>([
    { $match: { $or: [{ seekerUid: uid }, { providerUid: uid }] } },
    { $group: {
      _id: null,
      total: { $sum: 1 },
      unread: { $sum: recipientUnread },
      unreadConversations: { $sum: { $cond: [{ $gt: [recipientUnread, 0] }, 1, 0] } },
    } },
  ])
  return totals[0]
}
export async function chatConversationSummary(uid: string) {
  const totals = await aggregateChatUnread(uid)
  return { total: totals?.total ?? 0, unread: totals?.unread ?? 0 }
}
export async function chatUnreadCount(uid: string) {
  return (await chatConversationSummary(uid)).unread
}
/** Separate metrics: existing message counts remain unchanged for screen and web consumers. */
export async function chatUnreadTotals(uid: string) {
  const totals = await aggregateChatUnread(uid)
  return { unreadCount: totals?.unread ?? 0, unreadConversationCount: totals?.unreadConversations ?? 0 }
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
