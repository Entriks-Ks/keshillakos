"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationView = notificationView;
exports.unreadCount = unreadCount;
exports.publishCount = publishCount;
exports.notify = notify;
exports.notifyUsers = notifyUsers;
exports.notifyProviders = notifyProviders;
exports.notifyBusinesses = notifyBusinesses;
exports.notifyAdmins = notifyAdmins;
exports.notificationHistory = notificationHistory;
exports.markRead = markRead;
const mongoose_1 = require("mongoose");
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
const ProviderProfile_1 = require("../models/ProviderProfile");
const Business_1 = require("../models/Business");
const realtime_1 = require("./realtime");
function notificationView(doc) {
    const legacyReport = doc.type === 'feedback:new' && doc.title === 'Raportim përdoruesi në chat';
    return { id: String(doc._id), type: legacyReport ? 'report:new' : doc.type, title: legacyReport ? 'Raportim i ri përdoruesi' : doc.title, body: doc.body, href: legacyReport ? '/dashboard/admin/reports' : doc.href, readAt: doc.readAt, createdAt: doc.createdAt };
}
async function unreadCount(uid) { return Notification_1.Notification.countDocuments({ recipientUid: uid, type: { $ne: 'message:new' }, readAt: null }); }
async function publishCount(uid) { (0, realtime_1.emitToUser)(uid, 'notification:count', { unreadCount: await unreadCount(uid) }); }
// Notification failures must not turn a successful business action into a failed response.
async function notify(uids, input) {
    if (input.type === 'message:new')
        return;
    try {
        for (const uid of [...new Set(uids)].filter(uid => uid && uid !== input.actorUid)) {
            if (!input.href.startsWith('/') || input.href.startsWith('//'))
                throw new Error('Invalid notification link');
            const existing = await Notification_1.Notification.exists({ recipientUid: uid, eventKey: input.eventKey });
            if (existing)
                continue;
            const eventKey = input.eventKey;
            if (input.coalesce && await Notification_1.Notification.exists({ recipientUid: uid, type: input.type, href: input.href, readAt: null }))
                continue;
            let doc;
            try {
                doc = await Notification_1.Notification.create({ ...input, recipientUid: uid, eventKey, ...(input.coalesce ? { coalesceKey: `${input.type}:${input.href}` } : {}) });
            }
            catch (error) {
                if (error.code === 11000)
                    continue;
                throw error;
            }
            (0, realtime_1.emitToUser)(uid, 'notification:new', notificationView(doc));
            await publishCount(uid);
        }
    }
    catch (error) {
        console.error('Notification delivery failed', error);
    }
}
async function notifyUsers(ids, input) {
    if (!ids.length)
        return;
    try {
        if (User_1.User.db.readyState !== 1)
            throw new Error('MongoDB unavailable for notification recipients');
        const users = await User_1.User.find({ _id: { $in: ids } }).select('uid').lean();
        await notify(users.map(user => user.uid), input);
    }
    catch (error) {
        console.error('Notification recipients failed', error);
    }
}
async function notifyProviders(ids, input) {
    if (!ids.length)
        return;
    try {
        if (User_1.User.db.readyState !== 1)
            throw new Error('MongoDB unavailable for notification recipients');
        const profiles = await ProviderProfile_1.ProviderProfile.find({ _id: { $in: ids } }).select('ownerUser business').lean();
        const businesses = await Business_1.Business.find({ _id: { $in: profiles.map(p => p.business).filter(Boolean) } }).select('owners members').lean();
        await notifyUsers([...profiles.map(p => p.ownerUser), ...businesses.flatMap(b => [...b.owners, ...b.members.filter(m => m.role === 'manager').map(m => m.user)])], input);
    }
    catch (error) {
        console.error('Provider notification recipients failed', error);
    }
}
async function notifyBusinesses(ids, input) {
    if (!ids.length)
        return;
    try {
        if (User_1.User.db.readyState !== 1)
            throw new Error('MongoDB unavailable for notification recipients');
        const businesses = await Business_1.Business.find({ _id: { $in: ids } }).select('owners members').lean();
        await notifyUsers(businesses.flatMap(b => [...b.owners, ...b.members.filter(m => m.role === 'manager').map(m => m.user)]), input);
    }
    catch (error) {
        console.error('Business notification recipients failed', error);
    }
}
async function notifyAdmins(input) {
    try {
        if (User_1.User.db.readyState !== 1)
            throw new Error('MongoDB unavailable for notification recipients');
        const admins = await User_1.User.find({ accountStatus: 'active', $or: [{ role: 'admin' }, { roles: 'admin' }] }).select('uid').lean();
        await notify(admins.map(u => u.uid), input);
    }
    catch (error) {
        console.error('Admin notification recipients failed', error);
    }
}
async function notificationHistory(uid, page = 1) {
    const limit = 20;
    const [items, total, count] = await Promise.all([
        Notification_1.Notification.find({ recipientUid: uid, type: { $ne: 'message:new' } }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Notification_1.Notification.countDocuments({ recipientUid: uid, type: { $ne: 'message:new' } }), unreadCount(uid),
    ]);
    return { notifications: items.map(notificationView), unreadCount: count, page, hasMore: page * limit < total };
}
async function markRead(uid, id) {
    if (id && !mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Notification ID i pavlefshëm');
    await Notification_1.Notification.updateMany({ recipientUid: uid, type: { $ne: 'message:new' }, readAt: null, ...(id ? { _id: id } : {}) }, { $set: { readAt: new Date() } });
    (0, realtime_1.emitToUser)(uid, 'notification:read', { id: id ?? null });
    await publishCount(uid);
    return { unreadCount: await unreadCount(uid) };
}
//# sourceMappingURL=notificationService.js.map