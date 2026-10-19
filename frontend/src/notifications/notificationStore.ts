import type { NotificationPage } from '../api/notifications'
export type { NotificationPage } from '../api/notifications'
export type NotificationState = NotificationPage & { loading: boolean; loadingMore: boolean; error: string; reading: string | null; loaded: boolean }
export function createNotificationStore(api: { list: (page: number) => Promise<NotificationPage>; read: (id?: string) => Promise<{ unreadCount: number }>; clear: () => Promise<{ unreadCount: number }> }) {
  let state: NotificationState = { notifications: [], unreadCount: 0, page: 1, hasMore: false, loading: false, loadingMore: false, error: '', reading: null, loaded: false }
  const listeners = new Set<() => void>()
  let disposed = false, revision = 0, refreshAgain = false
  const update = (patch: Partial<NotificationState>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()) } }
  const store = {
    snapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
    dispose() { disposed = true; listeners.clear() },
    async clear(): Promise<boolean> {
      if (disposed || state.reading || state.loading) return false
      ++revision
      update({ reading: 'clear', error: '' })
      try {
        const result = await api.clear()
        if (!Number.isSafeInteger(result?.unreadCount) || result.unreadCount < 0) throw new Error('Invalid clear response')
        update({ notifications: [], unreadCount: result.unreadCount, page: 1, hasMore: false, loaded: true })
        refreshAgain = true
        return !disposed
      } catch { update({ error: 'notifications.clear.error' }); return false }
      finally { update({ reading: null }); if (refreshAgain && !disposed) { refreshAgain = false; void store.load() } }
    },
    async load(more = false): Promise<void> {
      if (disposed) return
      if (state.loading || state.reading) { if (!more) { refreshAgain = true; ++revision }; return }
      if (more && !state.hasMore) return
      const stamp = ++revision
      update({ loading: true, loadingMore: more, error: '' })
      try {
        const page = await api.list(more ? state.page + 1 : 1)
        if (stamp === revision) update({ ...page, loaded: true, notifications: (more ? [...state.notifications, ...page.notifications.filter(n => !state.notifications.some(old => old.id === n.id))] : page.notifications).filter(n => n.type !== 'message:new') })
      } catch { update({ error: 'notifications.loadError' }) }
      finally { update({ loading: false, loadingMore: false }); if (refreshAgain && !disposed) { refreshAgain = false; await store.load() } }
    },
    async read(id?: string): Promise<boolean> {
      if (disposed || state.reading || state.loading) return false
      ++revision
      update({ reading: id || 'all', error: '' })
      try {
        const result = await api.read(id)
        update({ unreadCount: result.unreadCount, notifications: state.notifications.map(n => !id || n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n) })
        return !disposed
      } catch { update({ error: 'notifications.readError' }); return false }
      finally { update({ reading: null }); if (refreshAgain && !disposed) { refreshAgain = false; void store.load() } }
    },
  }
  return store
}
