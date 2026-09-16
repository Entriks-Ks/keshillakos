import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { openConversation } from '../api/chat'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../utils/dashboardPath'
import { getErrorMessage } from '../utils/errors'

type Props = {
  providerUid: string
  providerName: string
  serviceId?: string
  serviceTitle?: string
  compact?: boolean
}

export default function StartChatButton({
  providerUid,
  providerName,
  serviceId,
  serviceTitle,
  compact,
}: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!user) {
    return (
      <p className={`muted${compact ? ' chat-start-hint' : ''}`}>
        <Link to="/login">Hyr</Link> për të dërguar mesazh te {providerName}.
      </p>
    )
  }

  if (user.role !== 'user' && user.role !== 'admin') {
    return null
  }

  if (user.uid === providerUid) {
    return null
  }

  async function startChat() {
    setLoading(true)
    setError('')
    try {
      const { conversation } = await openConversation({
        providerUid,
        serviceId,
        serviceTitle,
      })
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
        className="ghost chat-start-btn"
        onClick={() => void startChat()}
        disabled={loading}
      >
        <MessageCircle size={16} />
        {loading ? 'Duke hapur...' : 'Dërgo mesazh'}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  )
}
