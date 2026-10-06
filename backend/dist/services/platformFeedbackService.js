"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFeedbackInput = normalizeFeedbackInput;
exports.createPlatformFeedback = createPlatformFeedback;
exports.listPlatformFeedback = listPlatformFeedback;
exports.markPlatformFeedbackRead = markPlatformFeedbackRead;
const pagination_1 = require("./pagination");
const PlatformFeedback_1 = require("../models/PlatformFeedback");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalizeFeedbackInput(input) {
    const message = typeof input.message === 'string' ? input.message.trim() : '';
    const providedName = typeof input.name === 'string' ? input.name.trim() : '';
    const providedEmail = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const name = providedName || input.userName?.trim() || '';
    const email = providedEmail || input.userEmail?.trim().toLowerCase() || '';
    if (message.length < 5) {
        throw new Error('Shkruaj të paktën 5 karaktere.');
    }
    if (message.length > 1000) {
        throw new Error('Feedback-u është shumë i gjatë.');
    }
    if (name.length > 80) {
        throw new Error('Emri është shumë i gjatë.');
    }
    if (email && !EMAIL_RE.test(email)) {
        throw new Error('Email-i nuk është i vlefshëm.');
    }
    if (!email) {
        throw new Error('Email-i është i nevojshëm që admini të të përgjigjet.');
    }
    return {
        message,
        name,
        email,
        userUid: input.userUid?.trim() || '',
    };
}
async function createPlatformFeedback(input) {
    const data = normalizeFeedbackInput(input);
    const doc = await PlatformFeedback_1.PlatformFeedback.create(data);
    return toFeedbackItem(doc);
}
async function listPlatformFeedback(input = { page: 1, limit: 20 }) {
    const result = await (0, pagination_1.queryPage)(input, () => PlatformFeedback_1.PlatformFeedback.countDocuments(), (skip, limit) => PlatformFeedback_1.PlatformFeedback.find().sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean());
    return Object.assign(result.items.map(toFeedbackItem), { pagination: result.pagination, unreadTotal: await PlatformFeedback_1.PlatformFeedback.countDocuments({ status: "new" }) });
}
async function markPlatformFeedbackRead(id) {
    const doc = await PlatformFeedback_1.PlatformFeedback.findByIdAndUpdate(id, { status: 'read' }, { new: true }).lean();
    if (!doc)
        return null;
    return toFeedbackItem(doc);
}
function toFeedbackItem(doc) {
    return {
        id: doc._id ? doc._id.toString() : doc.id || '',
        message: doc.message,
        name: doc.name,
        email: doc.email,
        userUid: doc.userUid,
        status: doc.status,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    };
}
//# sourceMappingURL=platformFeedbackService.js.map