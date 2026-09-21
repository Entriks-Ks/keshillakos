import { useState } from 'react'
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
  const [error, setError] = useState('')
  const peerName = seekerUid ? seekerName || 'klientin' : providerName || 'ofruesin'
  const asProvider = Boolean(user && seekerUid && user.uid !== seekerUid)

  if (!user) {
    if (hideGuestHint) return null
    return (
      <p className={`muted${compact ? ' chat-start-hint' : ''}`}>
        <Link to="/login">Hyr</Link> për të dërguar mesazh te {peerName}.
      </p>
    )
  }

  const roles = user.roles ?? [user.role]
  const canMessageAsSeeker = roles.includes('user') || roles.includes('admin')
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
    setError('')
    try {
      const { conversation } = await openConversation(
        asProvider
          ? { seekerUid, serviceId, serviceTitle }
          : { providerUid, serviceId, serviceTitle },
      )
      const base = getDashboardPath(user!.role)
      navigate(`${base}/messages?c=${conversation.id}`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-start">
      <button
        type="button"
        className={className || 'ghost chat-start-btn'}
        onClick={() => void startChat()}
        disabled={loading}
      >
        <MessageCircle size={16} />
        {loading ? 'Duke hapur...' : label || 'Dërgo mesazh'}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  )
}
