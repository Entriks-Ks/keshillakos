import { fetchChatUnreadCount } from '../api/chat'
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { API_BASE_URL } from '../api/auth'
import { notificationApi } from '../api/notifications'
import { createNotificationStore, bindNotificationSocket, type NotificationPage } from './notificationStore'

type NotificationState = NotificationPage & { messageUnreadCount: number; loading: boolean; loaded: boolean; error: string; reload: () => void; loadMore: () => void; reading: string | null; clearNotifications: () => Promise<boolean>; deleteNotification: (id: string) => Promise<boolean>; markRead: (id?: string) => Promise<boolean> }
const Context = createContext<NotificationState | null>(null)
const empty: NotificationPage = { notifications: [], unreadCount: 0, page: 1, hasMore: false }
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const socketRef = useRef<import('socket.io-client').Socket | null>(null)
  const [ownerUid, setOwnerUid] = useState('')
  const [messageUnreadCount, setMessageUnreadCount] = useState(0)
  const [socketError, setSocketError] = useState('')
  const store = useMemo(() => createNotificationStore(notificationApi), [user?.uid])
  const state = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
  const reload = () => { socketRef.current?.connect(); void store.load() }
  useEffect(() => {
    setOwnerUid(user?.uid || ''); setMessageUnreadCount(0); setSocketError('')
    if (!user) return
    void store.load()
    let disposed = false
    let unreadRevision = 0
    const unreadController = new AbortController()
    const syncChatUnread = async () => {
      const revision = ++unreadRevision
      try {
        const count = await fetchChatUnreadCount(unreadController.signal)
        if (!disposed && revision === unreadRevision) setMessageUnreadCount(count)
      } catch { /* Existing chat count remains until the next reconnect/visibility sync. */ }
    }
    void syncChatUnread()
    let socket: import('socket.io-client').Socket | undefined
    let unbindNotifications: (() => void) | undefined
    const sync = () => { void store.load() }
    // Load Socket.IO only for authenticated sessions.
    void import('socket.io-client').then(({ io }) => {
      if (disposed) return
      socket = io(API_BASE_URL, { path: '/socket.io', auth: callback => callback({ token: localStorage.getItem('token') }), reconnection: true })
      socketRef.current = socket
      unbindNotifications = bindNotificationSocket(socket, store)
      socket.on('connect', () => { setSocketError(''); void syncChatUnread() })
      socket.on('chat:unread', ({ unreadCount }: { unreadCount: number }) => { ++unreadRevision; setMessageUnreadCount(unreadCount) })
      socket.on('disconnect', () => { if (!disposed) setSocketError('notifications.reconnecting') })
      socket.on('connect_error', () => { if (!disposed) setSocketError('notifications.connectionError') })

    }).catch(() => { if (!disposed) setSocketError('notifications.connectionError') })
    const onVisible = () => { if (document.visibilityState === 'visible') { if (socket && !socket.connected) socket.connect(); sync(); void syncChatUnread() } }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => { disposed = true; unreadController.abort(); unbindNotifications?.(); socket?.disconnect(); socketRef.current = null; document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onVisible) }
  }, [user?.uid, store])
  return <Context.Provider value={{ messageUnreadCount: ownerUid === (user?.uid || '') ? messageUnreadCount : 0, ...(ownerUid === (user?.uid || '') ? state : empty), loading: state.loading, loaded: state.loaded, reading: state.reading, error: state.error || socketError, reload, loadMore: () => { void store.load(true) }, markRead: store.read, clearNotifications: store.clear, deleteNotification: store.remove }}>{children}</Context.Provider>
}
export function useNotifications() {
  const context = useContext(Context)
  if (!context) throw new Error('NotificationProvider missing')
  return context
}
