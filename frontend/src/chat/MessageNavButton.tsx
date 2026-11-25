import { Button, Tooltip } from '@heroui/react'
import { MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath, resolveActiveContext } from '../utils/dashboardPath'
import { useNotifications } from '../notifications/NotificationProvider'
import MessageUnreadBadge from './MessageUnreadBadge'
export default function MessageNavButton() {
  const { user } = useAuth()
  const { messageUnreadCount } = useNotifications()
  const navigate = useNavigate()
  const { t } = useTranslation()
  return <Tooltip delay={400}>
    <Button isIconOnly variant="ghost" className="kk-message-nav-button" aria-label={t('chat.unread.nav', { count: messageUnreadCount })} onPress={() => navigate(`${getDashboardPath(resolveActiveContext(user))}/messages`)}>
      <MessageCircle size={19} aria-hidden /><MessageUnreadBadge overlay />
    </Button>
    <Tooltip.Content placement="bottom">{t('dash.messages')}</Tooltip.Content>
  </Tooltip>
}
