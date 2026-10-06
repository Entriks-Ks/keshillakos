"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportStatus = reportStatus;
exports.redactReportIds = redactReportIds;
exports.reportListOptions = reportListOptions;
exports.listUserReports = listUserReports;
exports.userReportDetails = userReportDetails;
exports.reportDecision = reportDecision;
exports.updateReportStatus = updateReportStatus;
exports.reportConversationEvidence = reportConversationEvidence;
exports.reportRequestEvidence = reportRequestEvidence;
const mongoose_1 = require("mongoose");
const PlatformFeedback_1 = require("../models/PlatformFeedback");
const Conversation_1 = require("../models/Conversation");
const Message_1 = require("../models/Message");
const User_1 = require("../models/User");
const RequestDelivery_1 = require("../models/RequestDelivery");
const UserRequest_1 = require("../models/UserRequest");
const ProviderProfile_1 = require("../models/ProviderProfile");
const ServiceRequest_1 = require("../models/ServiceRequest");
const chatContextService_1 = require("./chatContextService");
const pagination_1 = require("./pagination");
const reportFilter = { chatReport: { $exists: true } };
function reportStatus(doc) {
    if (doc.chatReport?.reviewStatus === 'resolved')
        return 'resolved';
    if (['dismissed', 'rejected'].includes(doc.chatReport?.reviewStatus || ''))
        return 'rejected';
    return 'reviewing';
}
function redactReportIds(text, ids) {
    let safe = text;
    for (const id of ids.filter(Boolean))
        safe = safe.split(id).join('[referencë private]');
    return safe.replace(/\b[a-f0-9]{24}\b/gi, '[referencë private]').replace(/\b[A-Za-z0-9]{28}\b/g, '[referencë private]');
}
function reportListOptions(query) {
    const status = query.status === undefined ? 'all' : query.status;
    const sort = query.sort === undefined ? 'priority' : query.sort;
    if (typeof status !== 'string' || typeof sort !== 'string' || !['all', 'reviewing', 'resolved', 'rejected'].includes(status) || !['priority', 'newest', 'oldest'].includes(sort))
        throw Object.assign(new Error('Filtri është i pavlefshëm'), { status: 400 });
    return { status: status, sort: sort };
}
const canonicalStatus = { $switch: { branches: [
            { case: { $eq: ['$chatReport.reviewStatus', 'resolved'] }, then: 'resolved' },
            { case: { $in: ['$chatReport.reviewStatus', ['rejected', 'dismissed']] }, then: 'rejected' },
        ], default: 'reviewing' } };
function statusFilter(status) {
    return { ...reportFilter, ...(status === 'all' ? {} : { $expr: { $eq: [canonicalStatus, status] } }) };
}
async function reportItems(docs) {
    if (!docs.length)
        return [];
    const ids = [...new Set(docs.flatMap(doc => [doc.userUid, doc.chatReport.reportedUid, doc.chatReport.reviewedBy || '']).filter(Boolean))];
    const accounts = await User_1.User.find({ uid: { $in: ids } }).lean();
    const users = new Map(accounts.map(user => [user.uid, user]));
    const conversations = await Conversation_1.Conversation.find({ _id: { $in: docs.map(doc => doc.chatReport.conversationId).filter(id => mongoose_1.Types.ObjectId.isValid(id)) } }).lean();
    // Batch only explicit request links for inbox rows. Legacy inference stays in detail view.
    const deliveryIds = conversations.flatMap(c => c.requestDeliveryId ? [c.requestDeliveryId] : []);
    const deliveries = deliveryIds.length ? await RequestDelivery_1.RequestDelivery.find({ _id: { $in: deliveryIds } }).lean() : [];
    const [requests, profiles] = deliveries.length ? await Promise.all([
        UserRequest_1.UserRequest.find({ _id: { $in: deliveries.map(d => d.request) } }).lean(),
        ProviderProfile_1.ProviderProfile.find({ _id: { $in: deliveries.map(d => d.providerProfile) } }).select('ownerUser').lean(),
    ]) : [[], []];
    return docs.map(doc => {
        const report = doc.chatReport;
        const privateIds = [String(doc._id), doc.userUid, report.reportedUid, report.conversationId, report.reviewedBy || ''];
        const clean = (text) => redactReportIds(text, privateIds);
        const reporter = users.get(doc.userUid), reported = users.get(report.reportedUid), reviewer = users.get(report.reviewedBy || '');
        const conversation = conversations.find(c => String(c._id) === report.conversationId && c.seekerUid !== c.providerUid && [c.seekerUid, c.providerUid].includes(doc.userUid) && [c.seekerUid, c.providerUid].includes(report.reportedUid));
        const delivery = deliveries.find(d => String(d._id) === String(conversation?.requestDeliveryId));
        const request = requests.find(r => String(r._id) === String(delivery?.request));
        const profile = profiles.find(p => String(p._id) === String(delivery?.providerProfile));
        const seeker = conversation && users.get(conversation.seekerUid), provider = conversation && users.get(conversation.providerUid);
        const linked = request && profile && seeker && provider && String(request.user) === String(seeker._id) && String(profile.ownerUser) === String(provider._id) && request.status !== 'draft';
        return {
            id: String(doc._id), status: reportStatus(doc), createdAt: doc.createdAt.toISOString(), reason: clean(report.reason), adminNote: clean(report.adminNote || ''),
            reporter: { name: clean(reporter?.name || doc.name || 'Përdorues i padisponueshëm'), profilePhoto: reporter?.profilePhoto || '', role: reporter?.roles?.includes('company') ? 'Kompani' : reporter?.roles?.includes('provider') ? 'Ekspert' : 'Përdorues' },
            reported: { uid: reported?.uid, name: clean(reported?.name || 'Përdorues i padisponueshëm'), profilePhoto: reported?.profilePhoto || '', role: reported?.roles?.includes('company') ? 'Kompani' : reported?.roles?.includes('provider') ? 'Ekspert' : 'Përdorues', accountStatus: reported?.accountStatus || 'unavailable', publicProfile: !!reported?.roles?.some(r => r === 'provider' || r === 'company'), isAdmin: !!reported?.roles?.includes('admin'), headline: clean(reported?.headline || ''), bio: clean(reported?.bio || ''), email: reported?.email || '' },
            serviceTitle: clean(conversation?.serviceTitle || ''), hasConversation: !!conversation,
            requestContext: linked ? { title: clean(conversation?.serviceTitle || request.problem), status: request.status === 'cancelled' ? 'cancelled' : delivery.status } : null,
            resolution: reportStatus(doc) !== 'reviewing' ? { decision: reportStatus(doc), admin: clean(reviewer?.name || 'Administratori i padisponueshëm'), at: report.reviewedAt?.toISOString(), note: clean(report.adminNote || '') } : null,
        };
    });
}
async function listUserReports(input = { page: 1, limit: 20 }, options = reportListOptions({})) {
    const filter = statusFilter(options.status);
    const result = await (0, pagination_1.queryPage)(input, () => PlatformFeedback_1.PlatformFeedback.countDocuments(filter), (skip, limit) => PlatformFeedback_1.PlatformFeedback.aggregate([
        { $match: filter }, { $addFields: { _reviewPriority: { $cond: [{ $eq: [canonicalStatus, 'reviewing'] }, 0, 1] } } },
        { $sort: options.sort === 'priority' ? { _reviewPriority: 1, createdAt: -1, _id: -1 } : { createdAt: options.sort === 'oldest' ? 1 : -1, _id: options.sort === 'oldest' ? 1 : -1 } },
        { $skip: skip }, { $limit: limit },
    ]));
    const counts = await PlatformFeedback_1.PlatformFeedback.aggregate([{ $match: reportFilter }, { $group: { _id: canonicalStatus, count: { $sum: 1 } } }]);
    const summary = { total: 0, reviewing: 0, resolved: 0, rejected: 0 };
    for (const item of counts) {
        summary[item._id] = item.count;
        summary.total += item.count;
    }
    return Object.assign(await reportItems(result.items), { pagination: result.pagination, summary });
}
async function reportConversation(id) {
    const doc = await PlatformFeedback_1.PlatformFeedback.findOne({ _id: id, ...reportFilter }).lean();
    if (!doc)
        throw Object.assign(new Error('Raportimi nuk u gjet'), { status: 404 });
    const conversation = mongoose_1.Types.ObjectId.isValid(doc.chatReport.conversationId) ? await Conversation_1.Conversation.findById(doc.chatReport.conversationId) : null;
    const valid = conversation && conversation.seekerUid !== conversation.providerUid && [conversation.seekerUid, conversation.providerUid].includes(doc.userUid) && [conversation.seekerUid, conversation.providerUid].includes(doc.chatReport.reportedUid);
    return { doc, conversation: valid ? conversation : null };
}
async function userReportDetails(id) {
    const { doc, conversation } = await reportConversation(id);
    const context = conversation ? await (0, chatContextService_1.chatRequestContext)(conversation) : null;
    return { ...(await reportItems([doc]))[0], requestContext: context ? { title: redactReportIds(context.title, [doc.userUid, doc.chatReport.reportedUid, context.id]), status: context.status } : null };
}
function reportDecision(status, note, actorUid) {
    if (typeof status !== 'string' || !['reviewing', 'resolved', 'rejected'].includes(status))
        throw Object.assign(new Error('Statusi është i pavlefshëm'), { status: 400 });
    if (!actorUid)
        throw Object.assign(new Error('Nuk ke leje për këtë vendim'), { status: 403 });
    const text = typeof note === 'string' ? note.trim() : '';
    if (status !== 'reviewing' && (text.length < 5 || text.length > 1000))
        throw Object.assign(new Error('Shkruaj një shënim administrativ prej 5–1000 karakteresh'), { status: 400 });
    return { status: status, note: text };
}
async function updateReportStatus(id, status, actorUid, note) {
    const decision = reportDecision(status, note, actorUid);
    const doc = await PlatformFeedback_1.PlatformFeedback.findOneAndUpdate({ _id: id, ...reportFilter, 'chatReport.reviewStatus': { $nin: ['resolved', 'dismissed', 'rejected'] } }, {
        $set: { 'chatReport.reviewStatus': decision.status, status: decision.status === 'reviewing' ? 'new' : 'read', ...(decision.status !== 'reviewing' ? { 'chatReport.reviewedBy': actorUid, 'chatReport.reviewedAt': new Date(), 'chatReport.adminNote': decision.note } : {}) },
    }, { new: true, runValidators: true }).lean();
    if (!doc)
        throw Object.assign(new Error('Raportimi nuk u gjet ose është mbyllur'), { status: 409 });
    return (await reportItems([doc]))[0];
}
// Admin-only, report-scoped, read-only investigation. Never joins a room or marks messages read.
async function reportConversationEvidence(id, input, before, beforeId) {
    const { doc, conversation } = await reportConversation(id);
    if (!conversation)
        throw Object.assign(new Error('Nuk ka bisedë të konfirmuar'), { status: 404 });
    if (before && Number.isNaN(Date.parse(before)) || beforeId && !mongoose_1.Types.ObjectId.isValid(beforeId))
        throw Object.assign(new Error('Kërkesa është e pavlefshme'), { status: 400 });
    const filter = { conversation: conversation._id, ...(before ? beforeId ? { $or: [{ createdAt: { $lt: new Date(before) } }, { createdAt: new Date(before), _id: { $lt: new mongoose_1.Types.ObjectId(beforeId) } }] } : { createdAt: { $lt: new Date(before) } } : {}) };
    const result = await (0, pagination_1.queryPage)({ ...input, limit: Math.min(input.limit, 30) }, () => Message_1.Message.countDocuments(filter), (skip, limit) => Message_1.Message.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean());
    const users = await User_1.User.find({ uid: { $in: [conversation.seekerUid, conversation.providerUid] } }).select('uid name').lean();
    return Object.assign(result.items.reverse().map(message => ({ id: String(message._id), body: redactReportIds(message.body, [doc.userUid, doc.chatReport.reportedUid]), author: redactReportIds(users.find(u => u.uid === message.senderUid)?.name || 'Përdorues', [doc.userUid, doc.chatReport.reportedUid]), createdAt: message.createdAt.toISOString() })), { pagination: result.pagination });
}
async function reportRequestEvidence(id) {
    const { doc, conversation } = await reportConversation(id);
    const context = conversation ? await (0, chatContextService_1.chatRequestContext)(conversation) : null;
    if (!context)
        throw Object.assign(new Error('Nuk ka kërkesë të lidhur të konfirmuar'), { status: 404 });
    const delivery = await RequestDelivery_1.RequestDelivery.findById(context.id).lean();
    const request = delivery ? await UserRequest_1.UserRequest.findById(delivery.request).lean() : null;
    const legacy = !delivery ? await ServiceRequest_1.ServiceRequest.findById(context.id).lean() : null;
    return { title: redactReportIds(context.title, [doc.userUid, doc.chatReport.reportedUid]), status: context.status, details: redactReportIds(request?.description || legacy?.message || '', [doc.userUid, doc.chatReport.reportedUid]) };
}
//# sourceMappingURL=adminReportService.js.map