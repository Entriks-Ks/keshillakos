import { useState } from 'react'
import { toast } from '@heroui/react'
import { Link, useNavigate } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import { openConversation } from '../api/chat'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../utils/dashboardPath'
import { getErrorMessage } from '../utils/errors'
import { routePath } from '../routes/routeMap'

type Props = {
  providerUid: string
  providerName?: string
  seekerUid?: string
  seekerName?: string
  serviceId?: string
  serviceTitle?: string
  compact?: boolean
  hideGuestHint?: boolean
  label?: string
  className?: string
}

export default function StartChatButton({
  providerUid,
  providerName,
  seekerUid,
  seekerName,
  serviceId,
  serviceTitle,
  compact,
  hideGuestHint = false,
  label,
  className,
}: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()
  const peerName = seekerUid ? seekerName : providerName
  const loginHintKey = peerName
    ? 'cards.chatLoginHint'
    : seekerUid
      ? 'cards.chatLoginHintClient'
      : 'cards.chatLoginHintProvider'
  const liveChatLabel = label || t('cards.liveChat')
  const asProvider = Boolean(user && seekerUid && user.uid !== seekerUid)

  if (!user) {
    if (hideGuestHint) {
      return (
        <div className="chat-start">
          <Link
            to={routePath('login')}
            className={className ? `${className} chat-start-btn` : 'ghost chat-start-btn'}
            aria-label={liveChatLabel}
          >
            <MessageCircle size={16} aria-hidden />
            <span className="tt-dir-action-text">{liveChatLabel}</span>
          </Link>
        </div>
      )
    }
    return (
      <p className={`muted${compact ? ' chat-start-hint' : ''}`}>
        <Trans i18nKey={loginHintKey} values={{ name: peerName }} components={{ login: <Link to={routePath('login')} /> }} />
      </p>
    )
  }

  const roles = user.roles ?? [user.role]
  const canMessageAsSeeker = !asProvider
  const canMessageAsProvider =
    asProvider && (roles.includes('provider') || roles.includes('company') || roles.includes('admin'))

  if (!canMessageAsProvider && !canMessageAsSeeker) {
    return null
  }

  if (!asProvider && user.uid === providerUid) {
    return null
  }

  if (asProvider && user.uid === seekerUid) {
    return null
  }

  async function startChat() {
    setLoading(true)
    try {
      const { conversation } = await openConversation(
        asProvider
          ? { seekerUid, serviceId, serviceTitle }
          : { providerUid, serviceId, serviceTitle },
      )
      const base = getDashboardPath(user!.role)
      navigate(`${base}/messages?c=${conversation.id}`)
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-start">
      <button
        type="button"
        className={className ? `${className} chat-start-btn` : 'ghost chat-start-btn'}
        onClick={() => void startChat()}
        disabled={loading}
      >
        <MessageCircle size={16} aria-hidden />
        <span className="tt-dir-action-text">{loading ? t('cards.opening') : label || t('cards.sendMessage')}</span>
      </button>
    </div>
  )
}
