import { Types } from 'mongoose'
import { Notification } from '../models/Notification'
import { User } from '../models/User'
import { ProviderProfile } from '../models/ProviderProfile'
import { Business } from '../models/Business'
import { emitToUser } from './realtime'

export type NotificationInput = { type: string; title: string; body?: string; href: string; eventKey: string; actorUid?: string; coalesce?: boolean }
export function notificationView(doc: { _id: unknown; type: string; title: string; body: string; href: string; readAt?: Date | null; createdAt: Date }) {
  const legacyReport = doc.type === 'feedback:new' && doc.title === 'Raportim përdoruesi në chat'
  return { id: String(doc._id), type: legacyReport ? 'report:new' : doc.type, title: legacyReport ? 'Raportim i ri përdoruesi' : doc.title, body: doc.body, href: legacyReport ? '/dashboard/admin/reports' : doc.href, readAt: doc.readAt, createdAt: doc.createdAt }
}
export async function unreadCount(uid: string) { return Notification.countDocuments({ recipientUid: uid, type: { $ne: 'message:new' }, readAt: null }) }
export async function publishCount(uid: string) { emitToUser(uid, 'notification:count', { unreadCount: await unreadCount(uid) }) }
// Notification failures must not turn a successful business action into a failed response.
export async function notify(uids: string[], input: NotificationInput) {
  if (input.type === 'message:new') return
  try {
    for (const uid of [...new Set(uids)].filter(uid => uid && uid !== input.actorUid)) {
      if (!input.href.startsWith('/') || input.href.startsWith('//')) throw new Error('Invalid notification link')
      const existing = await Notification.exists({ recipientUid: uid, eventKey: input.eventKey })
      if (existing) continue
      const eventKey = input.eventKey
      if (input.coalesce && await Notification.exists({ recipientUid: uid, type: input.type, href: input.href, readAt: null })) continue
      let doc
      try { doc = await Notification.create({ ...input, recipientUid: uid, eventKey, ...(input.coalesce ? { coalesceKey: `${input.type}:${input.href}` } : {}) }) }
      catch (error) { if ((error as { code?: number }).code === 11000) continue; throw error }
      emitToUser(uid, 'notification:new', notificationView(doc))
      await publishCount(uid)
    }
  } catch (error) { console.error('Notification delivery failed', error) }
}
export async function notifyUsers(ids: unknown[], input: NotificationInput) {
  if (!ids.length) return
  try {
    if (User.db.readyState !== 1) throw new Error('MongoDB unavailable for notification recipients')
    const users = await User.find({ _id: { $in: ids } }).select('uid').lean()
    await notify(users.map(user => user.uid), input)
  } catch (error) { console.error('Notification recipients failed', error) }
}
export async function notifyProviders(ids: unknown[], input: NotificationInput) {
  if (!ids.length) return
  try {
    if (User.db.readyState !== 1) throw new Error('MongoDB unavailable for notification recipients')
    const profiles = await ProviderProfile.find({ _id: { $in: ids } }).select('ownerUser business').lean()
    const businesses = await Business.find({ _id: { $in: profiles.map(p => p.business).filter(Boolean) } }).select('owners members').lean()
    await notifyUsers([...profiles.map(p => p.ownerUser), ...businesses.flatMap(b => [...b.owners, ...b.members.filter(m => m.role === 'manager').map(m => m.user)])], input)
  } catch (error) { console.error('Provider notification recipients failed', error) }
}
export async function notifyBusinesses(ids: unknown[], input: NotificationInput) {
  if (!ids.length) return
  try {
    if (User.db.readyState !== 1) throw new Error('MongoDB unavailable for notification recipients')
    const businesses = await Business.find({ _id: { $in: ids } }).select('owners members').lean()
    await notifyUsers(businesses.flatMap(b => [...b.owners, ...b.members.filter(m => m.role === 'manager').map(m => m.user)]), input)
  } catch (error) { console.error('Business notification recipients failed', error) }
}
export async function notifyAdmins(input: NotificationInput) {
  try {
    if (User.db.readyState !== 1) throw new Error('MongoDB unavailable for notification recipients')
    const admins = await User.find({ accountStatus: 'active', $or: [{ role: 'admin' }, { roles: 'admin' }] }).select('uid').lean()
    await notify(admins.map(u => u.uid), input)
  } catch (error) { console.error('Admin notification recipients failed', error) }
}
export async function notificationHistory(uid: string, page = 1) {
  const limit = 20
  const [items, total, count] = await Promise.all([
    Notification.find({ recipientUid: uid, type: { $ne: 'message:new' } }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments({ recipientUid: uid, type: { $ne: 'message:new' } }), unreadCount(uid),
  ])
  return { notifications: items.map(notificationView), unreadCount: count, page, hasMore: page * limit < total }
}
export async function markRead(uid: string, id?: string) {
  if (id && !Types.ObjectId.isValid(id)) throw new Error('Notification ID i pavlefshëm')
  await Notification.updateMany({ recipientUid: uid, type: { $ne: 'message:new' }, readAt: null, ...(id ? { _id: id } : {}) }, { $set: { readAt: new Date() } })
  emitToUser(uid, 'notification:read', { id: id ?? null })
  await publishCount(uid)
  return { unreadCount: await unreadCount(uid) }
}
