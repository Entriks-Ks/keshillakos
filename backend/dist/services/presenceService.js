"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESENCE_TTL_MS = void 0;
exports.createPresenceRegistry = createPresenceRegistry;
exports.PRESENCE_TTL_MS = 50000;
/** Per-server ephemeral registry. Socket.IO's pong/disconnect events own liveness. */
function createPresenceRegistry(publish, now = Date.now) {
    const connections = new Map();
    const lastSeen = new Map();
    const publishedOnline = new Set();
    const online = (uid) => [...connections.values()].some(c => c.uid === uid && c.expiresAt > now());
    const snapshot = (uid) => ({ uid, online: online(uid), ...(lastSeen.has(uid) ? { lastSeen: new Date(lastSeen.get(uid)).toISOString() } : {}) });
    function offline(uid) {
        if (!online(uid) && publishedOnline.delete(uid)) {
            lastSeen.set(uid, now());
            publish(snapshot(uid));
        }
    }
    return {
        snapshot,
        connect(id, uid) {
            const wasOnline = online(uid);
            connections.set(id, { uid, expiresAt: now() + exports.PRESENCE_TTL_MS });
            if (!wasOnline) {
                publishedOnline.add(uid);
                publish(snapshot(uid));
            }
        },
        heartbeat(id) { const c = connections.get(id); if (c)
            c.expiresAt = now() + exports.PRESENCE_TTL_MS; },
        disconnect(id) {
            const c = connections.get(id);
            if (!c)
                return;
            connections.delete(id);
            offline(c.uid);
        },
        expire() {
            const expiredUsers = new Set();
            for (const [id, c] of connections)
                if (c.expiresAt <= now()) {
                    connections.delete(id);
                    expiredUsers.add(c.uid);
                }
            for (const uid of expiredUsers)
                offline(uid);
            for (const [uid, time] of lastSeen)
                if (!online(uid) && now() - time > 24 * 60 * 60 * 1000)
                    lastSeen.delete(uid);
        },
        clear() { connections.clear(); lastSeen.clear(); publishedOnline.clear(); },
    };
}
//# sourceMappingURL=presenceService.js.map