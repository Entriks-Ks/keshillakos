import type { ChatMessage, ConversationItem } from '../api/chat'

export type ConversationUpdate = { conversationId: string; lastMessagePreview: string; lastMessageAt: string; senderUid: string }

/** Keep existing objects and IDs when reconciling a socket echo or reconnect snapshot. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const ids = new Set(current.map(message => message.id))
  const added = incoming.filter(message => {
    if (ids.has(message.id)) return false
    ids.add(message.id)
    return true
  })
  if (!added.length) return current
  return [...current, ...added].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
}

/** Swap an edited/deleted message in place, keeping every other reference stable. */
export function replaceMessage(current: ChatMessage[], updated: ChatMessage) {
  const index = current.findIndex(message => message.id === updated.id)
  if (index === -1) return current
  const existing = current[index]
  if (existing.body === updated.body && existing.editedAt === updated.editedAt && Boolean(existing.deleted) === Boolean(updated.deleted)) return current
  const next = current.slice()
  next[index] = updated
  return next
}

/** Update only the preview text; edits and deletes never change ordering or unread counts. */
export function updateConversationPreview(conversations: ConversationItem[], conversationId: string, preview: string) {
  let changed = false
  const next = conversations.map(conversation => {
    if (conversation.id !== conversationId || conversation.lastMessagePreview === preview) return conversation
    changed = true
    return { ...conversation, lastMessagePreview: preview }
  })
  return changed ? next : conversations
}

export function updateConversation(conversation: ConversationItem, event: ConversationUpdate, viewerUid: string, activeId: string, visible: boolean) {
  if (conversation.id !== event.conversationId) return conversation
  const viewed = conversation.id === activeId && visible
  if (conversation.lastMessageAt && Date.parse(event.lastMessageAt) < Date.parse(conversation.lastMessageAt)) return conversation
  if (conversation.lastMessageAt === event.lastMessageAt && conversation.lastMessagePreview === event.lastMessagePreview) {
    return viewed && conversation.unread !== 0 ? { ...conversation, unread: 0 } : conversation
  }
  return {
    ...conversation, lastMessagePreview: event.lastMessagePreview, lastMessageAt: event.lastMessageAt,
    unread: viewed ? 0 : conversation.unread + (event.senderUid === viewerUid ? 0 : 1),
  }
}

/** Preserve ordering and reference identity for every unaffected conversation. */
export function updateConversationList(conversations: ConversationItem[], event: ConversationUpdate, viewerUid: string, activeId: string, visible: boolean) {
  let changed = false
  const next = conversations.map(conversation => {
    const updated = updateConversation(conversation, event, viewerUid, activeId, visible)
    changed ||= updated !== conversation
    return updated
  })
  return changed ? next : conversations
}

export function nearHistoryBottom(scrollTop: number, scrollHeight: number, clientHeight: number) {
  return scrollHeight - scrollTop - clientHeight <= 80
}

export function prependedScrollTop(previousTop: number, previousHeight: number, nextHeight: number) {
  return previousTop + nextHeight - previousHeight
}

/** Reconnect reconciliation updates rows in place rather than reordering/remounting the list. */
export function mergeConversationSnapshots(current: ConversationItem[], incoming: ConversationItem[]) {
  const byId = new Map(incoming.map(conversation => [conversation.id, conversation]))
  let changed = false
  const next = current.map(conversation => {
    const snapshot = byId.get(conversation.id)
    byId.delete(conversation.id)
    if (!snapshot || JSON.stringify(snapshot) === JSON.stringify(conversation)) return conversation
    changed = true
    return snapshot
  })
  if (byId.size) { changed = true; next.push(...byId.values()) }
  return changed ? next : current
}

/** Remove a deleted conversation from list without mutating unrelated references. */
export function removeConversationFromList(conversations: ConversationItem[], conversationId: string) {
  if (!conversations.some(c => c.id === conversationId)) return conversations
  return conversations.filter(c => c.id !== conversationId)
}
