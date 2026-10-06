"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHAT_ATTACHMENT_TYPES = exports.CHAT_ATTACHMENT_MAX_BYTES = void 0;
exports.chatAttachmentKey = chatAttachmentKey;
// Preparation only: no upload/download routes or chat attachment UI are enabled.
// Future handlers must authenticate conversation participants before S3 access,
// verify file signatures/container contents, scan for malware, and persist a
// verified message-owned key before exposing downloads. Reuse s3Storage's
// putObject(..., { private: true }) and getObject behind an authorized endpoint.
exports.CHAT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
exports.CHAT_ATTACHMENT_TYPES = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};
/** Keys deliberately cannot match the public /media route's allowed prefixes. */
function chatAttachmentKey(conversationId, fileId, mime) {
    if (!/^[a-f0-9]{24}$/.test(conversationId) || !/^[a-f0-9]{32}$/.test(fileId) || !Object.prototype.hasOwnProperty.call(exports.CHAT_ATTACHMENT_TYPES, mime))
        throw new Error('Invalid chat attachment key');
    return `chat-private/${conversationId}/${fileId}${exports.CHAT_ATTACHMENT_TYPES[mime]}`;
}
//# sourceMappingURL=chatAttachmentPolicy.js.map