import type { NotificationPage, NotificationMutation } from '../api/notifications'
export type { NotificationPage } from '../api/notifications'
export type NotificationState = NotificationPage & { loading: boolean; loadingMore: boolean; error: string; reading: string | null; loaded: boolean }
type NotificationApi = {
  list: (page: number) => Promise<NotificationPage>
  read: (id?: string) => Promise<NotificationMutation>
  clear: () => Promise<NotificationMutation>
  remove: (id: string) => Promise<NotificationMutation>
}
export function createNotificationStore(api: NotificationApi) {
  let state: NotificationState = { notifications: [], unreadCount: 0, page: 1, hasMore: false, loading: false, loadingMore: false, error: '', reading: null, loaded: false }
  const listeners = new Set<() => void>()
  let disposed = false, revision = 0, refreshAgain = false
  const update = (patch: Partial<NotificationState>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()) } }
  const validCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
  const unique = (rows: NotificationPage['notifications']) => [...new Map(rows.filter(n => n.type !== 'message:new').map(n => [n.id, n])).values()]
  async function mutate(action: 'read' | 'clear' | 'remove', id?: string): Promise<boolean> {
    if (disposed || state.reading || state.loading) return false
    const stamp = ++revision
    update({ reading: action === 'read' ? id || 'all' : action === 'remove' ? `delete:${id}` : 'clear', error: '' })
    try {
      const result = action === 'read' ? await api.read(id) : action === 'clear' ? await api.clear() : await api.remove(id!)
      if (!validCount(result?.unreadCount) && !(result?.unreadCount === null && result.requiresSync === true)) throw new Error('Invalid notification count')
      // Socket activity supersedes an HTTP mutation's unversioned count. Reconcile instead.
      if (stamp === revision && validCount(result.unreadCount)) {
        if (action === 'clear') update({ notifications: [], unreadCount: result.unreadCount, page: 1, hasMore: false, loaded: true })
        else update({ unreadCount: result.unreadCount, notifications: action === 'remove' ? state.notifications.filter(n => n.id !== id) : state.notifications.map(n => !id || n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n) })
      }
      if (action !== 'read' || stamp !== revision || result.requiresSync) refreshAgain = true
      return !disposed
    } catch { update({ error: action === 'clear' ? 'notifications.clear.error' : action === 'remove' ? 'notifications.delete.error' : 'notifications.readError' }); return false }
    finally { update({ reading: null }); if (refreshAgain && !disposed) { refreshAgain = false; void store.load() } }
  }
  const store = {
    snapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
    dispose() { disposed = true; ++revision; listeners.clear() },
    async load(more = false): Promise<void> {
      if (disposed) return
      // Invalidate immediately, before any network/debounce delay can publish stale state.
      if (state.loading || state.reading) { if (!more) { refreshAgain = true; ++revision }; return }
      if (more && !state.hasMore) return
      const stamp = ++revision
      const target = more ? state.page + 1 : Math.max(1, state.page)
      update({ loading: true, loadingMore: more, error: '' })
      try {
        let rows: NotificationPage['notifications'] = more ? state.notifications : []
        let result: NotificationPage | undefined
        // Refresh every loaded page so cross-device edits also reach older visible rows.
        for (let page = more ? target : 1; page <= target; page++) {
          result = await api.list(page)
          if (stamp !== revision || disposed) break
          if (!validCount(result.unreadCount) || !Array.isArray(result.notifications)) throw new Error('Invalid notification history')
          rows = [...rows, ...result.notifications]
          if (!result.hasMore) break
        }
        if (stamp === revision && result) update({ ...result, loaded: true, notifications: unique(rows) })
      } catch { if (stamp === revision) update({ error: 'notifications.loadError' }) }
      finally { update({ loading: false, loadingMore: false }); if (refreshAgain && !disposed) { refreshAgain = false; await store.load() } }
    },
    read: (id?: string) => mutate('read', id),
    clear: () => mutate('clear'),
    remove: (id: string) => mutate('remove', id),
  }
  return store
}

type NotificationSocket = { on: (event: string, fn: (payload?: any) => void) => unknown; off: (event: string, fn: (payload?: any) => void) => unknown }
/** Events invalidate snapshots; unversioned payload counts never replace backend history. */
export function bindNotificationSocket(socket: NotificationSocket, store: ReturnType<typeof createNotificationStore>) {
  const sync = () => { void store.load() }
  const created = (notification?: { type?: string }) => { if (notification?.type !== 'message:new') sync() }
  const events = ['connect', 'notification:read', 'notification:deleted', 'notification:cleared', 'notification:count']
  events.forEach(event => socket.on(event, sync))
  socket.on('notification:new', created)
  return () => { events.forEach(event => socket.off(event, sync)); socket.off('notification:new', created) }
}
