import { fetchChatUnreadCount } from '../api/chat'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { API_BASE_URL } from '../api/auth'
import { notificationRequest, type NotificationPage } from '../api/notifications'

type NotificationState = NotificationPage & { messageUnreadCount: number; loading: boolean; error: string; reload: () => void; loadMore: () => void; markRead: (id?: string) => Promise<void> }
const Context = createContext<NotificationState | null>(null)
const empty: NotificationPage = { notifications: [], unreadCount: 0, page: 1, hasMore: false }
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const socketRef = useRef<import('socket.io-client').Socket | null>(null)
  const [ownerUid, setOwnerUid] = useState('')
  const [messageUnreadCount, setMessageUnreadCount] = useState(0)
  const [socketError, setSocketError] = useState('')
  const [state, setState] = useState<NotificationPage>(empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [page, setPage] = useState(1)
  const reload = () => { socketRef.current?.connect(); setPage(1); setRevision(r => r + 1) }
  useEffect(() => {
    setOwnerUid(user?.uid || ''); setMessageUnreadCount(0); setState(empty); setPage(1); setError(''); setSocketError('')
    if (!user) return
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
    let timer: ReturnType<typeof setTimeout> | undefined
    const sync = () => { clearTimeout(timer); timer = setTimeout(reload, 100) }
    // Load Socket.IO only for authenticated sessions.
    void import('socket.io-client').then(({ io }) => {
      if (disposed) return
      socket = io(API_BASE_URL, { path: '/socket.io', auth: callback => callback({ token: localStorage.getItem('token') }), reconnection: true })
      socketRef.current = socket
      socket.on('connect', () => { setSocketError(''); sync(); void syncChatUnread() })
      socket.on('chat:unread', ({ unreadCount }: { unreadCount: number }) => { ++unreadRevision; setMessageUnreadCount(unreadCount) })
      socket.on('disconnect', () => { if (!disposed) setSocketError('Lidhja në kohë reale u ndërpre. Duke u rilidhur...') })
      socket.on('connect_error', () => { if (!disposed) setSocketError('Lidhja në kohë reale u ndërpre. Provo përsëri ose hyr sërish në llogari.') })
      socket.on('notification:new', notification => { if (notification.type !== 'message:new') sync() })
      socket.on('notification:read', sync)
      socket.on('notification:count', ({ unreadCount }: { unreadCount: number }) => { setState(s => ({ ...s, unreadCount })); sync() })
    }).catch(() => { if (!disposed) setSocketError('Lidhja në kohë reale nuk u hap') })
    const onVisible = () => { if (document.visibilityState === 'visible') { if (socket && !socket.connected) socket.connect(); sync(); void syncChatUnread() } }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => { disposed = true; unreadController.abort(); clearTimeout(timer); socket?.disconnect(); socketRef.current = null; document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onVisible) }
  }, [user?.uid])
  useEffect(() => {
    if (!user) { setLoading(false); return }
    const controller = new AbortController()
    setLoading(true)
    void notificationRequest<NotificationPage>(`?page=${page}`, 'GET', controller.signal).then(result => {
      if (controller.signal.aborted) return
      setState(previous => ({ ...result, notifications: page === 1 ? result.notifications : [...previous.notifications, ...result.notifications.filter(n => !previous.notifications.some(p => p.id === n.id))] }))
      setError('')
    }).catch(() => { if (!controller.signal.aborted) setError('Njoftimet nuk u ngarkuan') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [user?.uid, page, revision])
  async function markRead(id?: string) {
    try { await notificationRequest(id ? `/${id}/read` : '/read-all', 'PATCH'); reload() }
    catch { setError('Njoftimi nuk u shënua si i lexuar') }
  }
  return <Context.Provider value={{ messageUnreadCount: ownerUid === (user?.uid || '') ? messageUnreadCount : 0, ...(ownerUid === (user?.uid || '') ? state : empty), loading, error: error || socketError, reload, loadMore: () => { if (!loading && state.hasMore) setPage(p => p + 1) }, markRead }}>{children}</Context.Provider>
}
export function useNotifications() {
  const context = useContext(Context)
  if (!context) throw new Error('NotificationProvider mungon')
  return context
}
