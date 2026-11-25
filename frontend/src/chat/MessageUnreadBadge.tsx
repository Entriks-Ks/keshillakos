import { useTranslation } from 'react-i18next'
import { useNotifications } from '../notifications/NotificationProvider'
import './MessageUnreadBadge.css'
export default function MessageUnreadBadge({ overlay = false }: { overlay?: boolean }) {
  const { messageUnreadCount } = useNotifications()
  const { t } = useTranslation()
  if (!messageUnreadCount) return null
  return <span className={`kk-message-badge${overlay ? ' is-overlay' : ''}`} aria-label={t('chat.unread.badge', { count: messageUnreadCount })}>{messageUnreadCount > 99 ? '99+' : messageUnreadCount}</span>
}
