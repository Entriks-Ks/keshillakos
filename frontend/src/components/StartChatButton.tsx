import { useState } from 'react'
import { toast } from '@heroui/react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { openConversation } from '../api/chat'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../utils/dashboardPath'
import { getErrorMessage } from '../utils/errors'

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
  const peerName = seekerUid ? seekerName || 'klientin' : providerName || 'ofruesin'
  const asProvider = Boolean(user && seekerUid && user.uid !== seekerUid)

  if (!user) {
    if (hideGuestHint) {
      return (
        <div className="chat-start">
          <Link
            to="/login"
            className={className ? `${className} chat-start-btn` : 'ghost chat-start-btn'}
            aria-label={label || 'Live Chat'}
          >
            <MessageCircle size={16} aria-hidden />
            <span className="tt-dir-action-text">{label || 'Live Chat'}</span>
          </Link>
        </div>
      )
    }
    return (
      <p className={`muted${compact ? ' chat-start-hint' : ''}`}>
        <Link to="/login">Hyr</Link> për të dërguar mesazh te {peerName}.
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
        <span className="tt-dir-action-text">{loading ? 'Duke hapur...' : label || 'Dërgo mesazh'}</span>
      </button>
    </div>
  )
}
