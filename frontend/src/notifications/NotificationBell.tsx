import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { notificationTarget } from './notificationTarget'
import type { AppNotification } from '../api/notifications'
import { Button, Dropdown, Modal, buttonVariants } from '@heroui/react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from './NotificationProvider'
import './Notifications.css'
export default function NotificationBell() {
  const { notifications, unreadCount, loading, loaded, reading, error, hasMore, markRead, clearNotifications, deleteNotification, loadMore, reload } = useNotifications()
  const { t, i18n } = useTranslation()
  const [isOpen, setOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AppNotification | null>(null)
  const [feedback, setFeedback] = useState('')
  const navigate = useNavigate()
  const { user, switchContext } = useAuth()
  const busy = loading || !!reading
  async function open(notification: AppNotification) {
    if (!user || busy) return
    const target = notificationTarget(notification, user)
    try {
      if (target.context) await switchContext(target.context)
      if (!notification.readAt && !await markRead(notification.id)) return
      setOpen(false)
      navigate(target.href)
    } catch { navigate('/dashboard') }
  }
  async function clear() {
    setFeedback('')
    if (await clearNotifications()) {
      setConfirmClear(false)
      setOpen(true)
      setFeedback('notifications.clear.success')
    }
  }
  async function remove() {
    if (!deleteTarget) return
    setFeedback('')
    if (await deleteNotification(deleteTarget.id)) {
      setDeleteTarget(null); setOpen(true); setFeedback('notifications.delete.success')
    }
  }
  const confirmationKey = deleteTarget ? 'notifications.delete' : 'notifications.clear'
  return <>
    <Dropdown isOpen={isOpen} onOpenChange={value => { setOpen(value); setFeedback('') }}>
      <Dropdown.Trigger className={`${buttonVariants({ isIconOnly: true, variant: 'ghost' })} dtb-icon kk-notification-bell`} aria-label={t('notifications.badge', { count: unreadCount })}>
        <Bell size={19} aria-hidden />
        {unreadCount > 0 && <span className="kk-notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="dtb-popover kk-notifications">
        <div className="kk-notifications-header"><strong>{t('notifications.title')}</strong><div className="kk-notifications-actions">
          <Button size="sm" variant="ghost" isDisabled={!unreadCount || busy} onPress={() => { setFeedback(''); void markRead() }}>{t('notifications.markAll')}</Button>
          <Button size="sm" variant="ghost" isDisabled={!notifications.length || busy} onPress={() => { setFeedback(''); setOpen(false); setConfirmClear(true) }}>{t('notifications.clear.action')}</Button>
        </div></div>
        <div className="kk-notifications-list" aria-live="polite" aria-busy={busy}>
          {error && <div role="alert"><p>{t(error)}</p><Button size="sm" variant="ghost" isDisabled={busy} onPress={reload}>{t('notifications.retry')}</Button></div>}
          {!!feedback && !error && <p role="status">{t(feedback)}</p>}
          {(!loading || loaded) && !error && notifications.length === 0 && <div className="kk-notifications-empty"><Bell size={40} aria-hidden /><strong>{t('notifications.emptyTitle')}</strong><p className="muted">{t('notifications.emptySubtitle')}</p></div>}
          {notifications.map(notification => <div key={notification.id} className={`kk-notification-item${notification.readAt ? '' : ' is-unread'}`}>
            <button type="button" className="kk-notification-link" disabled={busy} onClick={() => void open(notification)}>
              <strong>{notification.title}</strong>{notification.body && <span>{notification.body}</span>}
              <time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString(i18n.language)}</time>
            </button>
            {!notification.readAt && <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => { setFeedback(''); void markRead(notification.id) }}>{t('notifications.markRead')}</Button>}
            <Button size="sm" variant="ghost" isDisabled={busy} aria-label={t('notifications.delete.accessibility', { title: notification.title })} onPress={() => { setFeedback(''); setOpen(false); setDeleteTarget(notification) }}>{t('notifications.delete.action')}</Button>
          </div>)}
          {loading && <p className="muted">{t('notifications.loading')}</p>}
          {hasMore && <Button size="sm" variant="ghost" isDisabled={busy} onPress={loadMore}>{t('notifications.more')}</Button>}
        </div>
      </Dropdown.Popover>
    </Dropdown>
    <Modal isOpen={confirmClear || !!deleteTarget} onOpenChange={value => { if (!reading && !value) { setConfirmClear(false); setDeleteTarget(null) } }}>
      <Modal.Backdrop isDismissable={!reading}>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog aria-label={t(`${confirmationKey}.confirmTitle`)}>
            <Modal.Header><Modal.Heading>{t(`${confirmationKey}.confirmTitle`)}</Modal.Heading></Modal.Header>
            <Modal.Body><p>{t(`${confirmationKey}.confirmMessage`)}</p>{error && <p role="alert">{t(error)}</p>}</Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" isDisabled={!!reading} onPress={() => { setConfirmClear(false); setDeleteTarget(null) }}>{t('notifications.cancel')}</Button>
              <Button variant="primary" isDisabled={busy} onPress={() => { if (deleteTarget) void remove(); else void clear() }}>{t(reading ? (deleteTarget ? 'notifications.delete.loading' : 'notifications.clearing') : `${confirmationKey}.action`)}</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  </>
}
