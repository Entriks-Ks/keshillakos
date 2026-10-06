export type Presence = { uid: string; online: boolean; lastSeen?: string }
export const PRESENCE_TTL_MS = 50_000

/** Per-server ephemeral registry. Socket.IO's pong/disconnect events own liveness. */
export function createPresenceRegistry(publish: (value: Presence) => void, now = Date.now) {
  const connections = new Map<string, { uid: string; expiresAt: number }>()
  const lastSeen = new Map<string, number>()
  const publishedOnline = new Set<string>()
  const online = (uid: string) => [...connections.values()].some(c => c.uid === uid && c.expiresAt > now())
  const snapshot = (uid: string): Presence => ({ uid, online: online(uid), ...(lastSeen.has(uid) ? { lastSeen: new Date(lastSeen.get(uid)!).toISOString() } : {}) })
  function offline(uid: string) {
    if (!online(uid) && publishedOnline.delete(uid)) { lastSeen.set(uid, now()); publish(snapshot(uid)) }
  }
  return {
    snapshot,
    connect(id: string, uid: string) {
      const wasOnline = online(uid)
      connections.set(id, { uid, expiresAt: now() + PRESENCE_TTL_MS })
      if (!wasOnline) { publishedOnline.add(uid); publish(snapshot(uid)) }
    },
    heartbeat(id: string) { const c = connections.get(id); if (c) c.expiresAt = now() + PRESENCE_TTL_MS },
    disconnect(id: string) {
      const c = connections.get(id)
      if (!c) return
      connections.delete(id); offline(c.uid)
    },
    expire() {
      const expiredUsers = new Set<string>()
      for (const [id, c] of connections) if (c.expiresAt <= now()) { connections.delete(id); expiredUsers.add(c.uid) }
      for (const uid of expiredUsers) offline(uid)
      for (const [uid, time] of lastSeen) if (!online(uid) && now() - time > 24 * 60 * 60 * 1000) lastSeen.delete(uid)
    },
    clear() { connections.clear(); lastSeen.clear(); publishedOnline.clear() },
  }
}
