// Preparation only: no upload/download routes or chat attachment UI are enabled.
// Future handlers must authenticate conversation participants before S3 access,
// verify file signatures/container contents, scan for malware, and persist a
// verified message-owned key before exposing downloads. Reuse s3Storage's
// putObject(..., { private: true }) and getObject behind an authorized endpoint.
export const CHAT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
export const CHAT_ATTACHMENT_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
} as const

/** Keys deliberately cannot match the public /media route's allowed prefixes. */
export function chatAttachmentKey(conversationId: string, fileId: string, mime: keyof typeof CHAT_ATTACHMENT_TYPES) {
  if (!/^[a-f0-9]{24}$/.test(conversationId) || !/^[a-f0-9]{32}$/.test(fileId) || !Object.prototype.hasOwnProperty.call(CHAT_ATTACHMENT_TYPES, mime)) throw new Error('Invalid chat attachment key')
  return `chat-private/${conversationId}/${fileId}${CHAT_ATTACHMENT_TYPES[mime]}`
}
