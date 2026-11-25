import { useEffect, useRef, useState } from 'react'
export type ChatPresence = { uid: string; online: boolean; lastSeen?: string }
type PresenceSocket = {
  connected: boolean
  onPresence: (handler: (value: ChatPresence) => void) => () => void
  subscribePresence: (ids: string[], handler: (values: ChatPresence[]) => void) => void
}

export function mergePresence(current: Map<string, ChatPresence>, value: ChatPresence) {
  const old = current.get(value.uid)
  if (old?.online === value.online && old?.lastSeen === value.lastSeen) return current
  const next = new Map(current)
  next.set(value.uid, value)
  return next
}

export function useChatPresence(socket: PresenceSocket, conversationIds: string[]) {
  const [presence, setPresence] = useState(new Map<string, ChatPresence>())
  const versions = useRef(new Map<string, number>())
  const key = [...new Set(conversationIds)].sort().join(',')
  useEffect(() => {
    if (!socket.connected) { setPresence(new Map()); return }
    return socket.onPresence(value => {
      versions.current.set(value.uid, (versions.current.get(value.uid) || 0) + 1)
      setPresence(current => mergePresence(current, value))
    })
  }, [socket.connected, socket.onPresence])
  useEffect(() => {
    if (!socket.connected) return
    let cancelled = false
    const captured = new Map(versions.current)
    socket.subscribePresence(key ? key.split(',') : [], values => {
      if (cancelled) return
      setPresence(current => values.reduce((next, value) => versions.current.get(value.uid) !== captured.get(value.uid) ? next : mergePresence(next, value), current))
    })
    return () => { cancelled = true }
  }, [key, socket.connected, socket.subscribePresence])
  return presence
}

export type PresenceTranslate = (key: string, options?: { time?: string }) => string

/** Albanian fallback so callers without a translator keep the default-language copy. */
const albanianPresence: PresenceTranslate = (key, options) => {
  if (key === 'chat.presence.online') return 'Online'
  if (key === 'chat.presence.offline') return 'Offline'
  return `Aktiviteti i fundit: ${options?.time ?? ''}`
}

/**
 * Presence copy for a contact. Pass i18next's `t` and the active `dateLocale()` so the label follows
 * the UI language; this module stays free of i18n imports so node tests can load it.
 */
export function presenceLabel(value?: ChatPresence, t: PresenceTranslate = albanianPresence, locale = 'sq-AL') {
  if (!value) return ''
  if (value.online) return t('chat.presence.online')
  if (!value.lastSeen) return t('chat.presence.offline')
  const time = new Date(value.lastSeen).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
  return t('chat.presence.lastSeen', { time })
}
