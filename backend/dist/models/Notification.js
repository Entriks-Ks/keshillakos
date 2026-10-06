"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
const mongoose_1 = require("mongoose");
const schema = new mongoose_1.Schema({
    recipientUid: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    href: { type: String, required: true },
    eventKey: { type: String, required: true },
    coalesceKey: { type: String },
    readAt: { type: Date, default: null },
}, { timestamps: true, bufferCommands: false });
schema.index({ recipientUid: 1, eventKey: 1 }, { unique: true });
schema.index({ recipientUid: 1, createdAt: -1, _id: -1 });
schema.index({ recipientUid: 1, readAt: 1 });
schema.index({ recipientUid: 1, coalesceKey: 1 }, { unique: true, partialFilterExpression: { coalesceKey: { $type: 'string' }, readAt: null } });
exports.Notification = (0, mongoose_1.model)('Notification', schema);
//# sourceMappingURL=Notification.js.map