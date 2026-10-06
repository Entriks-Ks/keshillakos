import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { notificationTarget } from './notificationTarget'
import type { AppNotification } from '../api/notifications'
import { Button, Dropdown } from '@heroui/react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from './NotificationProvider'
import './Notifications.css'
export default function NotificationBell() {
  const { notifications, unreadCount, loading, error, hasMore, markRead, loadMore, reload } = useNotifications()
  const [isOpen, setOpen] = useState(false)
  const navigate = useNavigate()
  const { user, switchContext } = useAuth()
  async function open(notification: AppNotification) {
    if (!user) return
    const target = notificationTarget(notification, user)
    try {
      if (target.context) await switchContext(target.context)
      if (!notification.readAt) await markRead(notification.id)
      setOpen(false)
      navigate(target.href)
    } catch { navigate('/dashboard') }
  }
  return <Dropdown isOpen={isOpen} onOpenChange={setOpen}>
    <Dropdown.Trigger><Button isIconOnly variant="ghost" className="dtb-icon kk-notification-bell" aria-label={`Njoftime, ${unreadCount} të palexuara`}>
      <Bell size={19} aria-hidden />
      {unreadCount > 0 && <span className="kk-notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </Button></Dropdown.Trigger>
    <Dropdown.Popover placement="bottom end" className="dtb-popover kk-notifications">
      <div className="kk-notifications-header"><strong>Njoftime</strong><Button size="sm" variant="ghost" isDisabled={!unreadCount} onPress={() => void markRead()}>Lexoji të gjitha</Button></div>
      <div className="kk-notifications-list" aria-live="polite">
        {error && <div role="alert"><p>{error}</p><Button size="sm" variant="ghost" onPress={reload}>Provo përsëri</Button></div>}
        {!loading && !error && notifications.length === 0 && <p className="muted">Nuk ka njoftime.</p>}
        {notifications.map(notification => <div key={notification.id} className={`kk-notification-item${notification.readAt ? '' : ' is-unread'}`}>
          <button type="button" className="kk-notification-link" onClick={() => void open(notification)}>
            <strong>{notification.title}</strong>{notification.body && <span>{notification.body}</span>}
            <time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString('sq-AL')}</time>
          </button>
          {!notification.readAt && <Button size="sm" variant="ghost" onPress={() => void markRead(notification.id)}>Shëno si të lexuar</Button>}
        </div>)}
        {loading && <p className="muted">Duke u ngarkuar...</p>}
        {hasMore && <Button size="sm" variant="ghost" isDisabled={loading} onPress={loadMore}>Më shumë</Button>}
      </div>
    </Dropdown.Popover>
  </Dropdown>
}
