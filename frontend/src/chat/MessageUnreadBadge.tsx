import { useNotifications } from '../notifications/NotificationProvider'
import './MessageUnreadBadge.css'
export default function MessageUnreadBadge({ overlay = false }: { overlay?: boolean }) {
  const { messageUnreadCount } = useNotifications()
  if (!messageUnreadCount) return null
  return <span className={`kk-message-badge${overlay ? ' is-overlay' : ''}`} aria-label={`${messageUnreadCount} mesazhe të palexuara`}>{messageUnreadCount > 99 ? '99+' : messageUnreadCount}</span>
}
