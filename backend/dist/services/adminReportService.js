"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportStatus = reportStatus;
exports.redactReportIds = redactReportIds;
exports.listUserReports = listUserReports;
exports.userReportDetails = userReportDetails;
exports.updateReportStatus = updateReportStatus;
const mongoose_1 = require("mongoose");
const PlatformFeedback_1 = require("../models/PlatformFeedback");
const Conversation_1 = require("../models/Conversation");
const userService_1 = require("./userService");
const chatContextService_1 = require("./chatContextService");
const pagination_1 = require("./pagination");
const reportFilter = { chatReport: { $exists: true } };
function reportStatus(doc) {
    return doc.chatReport?.reviewStatus || (doc.status === 'read' ? 'reviewing' : 'new');
}
function redactReportIds(text, ids) {
    let safe = text;
    for (const id of ids.filter(Boolean))
        safe = safe.split(id).join('[referencë private]');
    return safe.replace(/\b[a-f0-9]{24}\b/gi, '[referencë private]').replace(/\b[A-Za-z0-9]{28}\b/g, '[referencë private]');
}
async function reportItems(docs) {
    const ids = docs.flatMap(doc => [doc.userUid, doc.chatReport.reportedUid]);
    const users = await (0, userService_1.findUsersByUids)(ids);
    const conversations = await Conversation_1.Conversation.find({ _id: { $in: docs.map(doc => doc.chatReport.conversationId).filter(id => mongoose_1.Types.ObjectId.isValid(id)) } }).select('serviceTitle seekerUid providerUid').lean();
    return docs.map(doc => {
        const report = doc.chatReport;
        const privateIds = [String(doc._id), doc.userUid, report.reportedUid, report.conversationId];
        const reporter = users.get(doc.userUid), reported = users.get(report.reportedUid);
        const conversation = conversations.find(c => String(c._id) === report.conversationId && [c.seekerUid, c.providerUid].includes(doc.userUid) && [c.seekerUid, c.providerUid].includes(report.reportedUid));
        return {
            id: String(doc._id), status: reportStatus(doc), createdAt: doc.createdAt.toISOString(),
            reason: redactReportIds(report.reason, privateIds), adminNote: redactReportIds(report.adminNote || '', privateIds),
            reporter: { name: redactReportIds(reporter?.name || doc.name || 'Përdorues i padisponueshëm', privateIds), profilePhoto: reporter?.profilePhoto || '' },
            reported: { name: redactReportIds(reported?.name || 'Përdorues i padisponueshëm', privateIds), profilePhoto: reported?.profilePhoto || '', role: reported?.roles?.includes('company') ? 'Kompani' : reported?.roles?.includes('provider') ? 'Ekspert' : 'Përdorues' },
            serviceTitle: redactReportIds(conversation?.serviceTitle || '', privateIds),
        };
    });
}
async function listUserReports(input = { page: 1, limit: 20 }) {
    const result = await (0, pagination_1.queryPage)(input, () => PlatformFeedback_1.PlatformFeedback.countDocuments(reportFilter), (skip, limit) => PlatformFeedback_1.PlatformFeedback.find(reportFilter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean());
    return Object.assign(await reportItems(result.items), { pagination: result.pagination });
}
async function userReportDetails(id) {
    const doc = await PlatformFeedback_1.PlatformFeedback.findOne({ _id: id, ...reportFilter }).lean();
    if (!doc)
        return null;
    const conversation = mongoose_1.Types.ObjectId.isValid(doc.chatReport.conversationId) ? await Conversation_1.Conversation.findById(doc.chatReport.conversationId) : null;
    const context = conversation && [conversation.seekerUid, conversation.providerUid].includes(doc.userUid) && [conversation.seekerUid, conversation.providerUid].includes(doc.chatReport.reportedUid) ? await (0, chatContextService_1.chatRequestContext)(conversation) : null;
    return { ...(await reportItems([doc]))[0], requestContext: context ? { title: redactReportIds(context.title, [doc.userUid, doc.chatReport.reportedUid, context.id]), status: context.status } : null };
}
async function updateReportStatus(id, status) {
    if (!['reviewing', 'resolved', 'dismissed'].includes(String(status)))
        throw Object.assign(new Error('Statusi është i pavlefshëm'), { status: 400 });
    const doc = await PlatformFeedback_1.PlatformFeedback.findOneAndUpdate({ _id: id, ...reportFilter, 'chatReport.reviewStatus': { $nin: ['resolved', 'dismissed'] } }, {
        $set: { 'chatReport.reviewStatus': status, status: status === 'reviewing' ? 'new' : 'read' },
    }, { new: true, runValidators: true }).lean();
    if (!doc)
        throw Object.assign(new Error('Raportimi nuk u gjet ose është mbyllur'), { status: 409 });
    return (await reportItems([doc]))[0];
}
//# sourceMappingURL=adminReportService.js.map