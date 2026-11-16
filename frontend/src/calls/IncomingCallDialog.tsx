import { useState } from 'react'
import { Phone, PhoneOff, Video } from 'lucide-react'
import ProfileAvatar from '../components/ProfileAvatar'
import { useCall } from './CallContext'
import './Call.css'

export default function IncomingCallDialog() {
  const { incomingCall, acceptCall, rejectCall } = useCall()
  const [isAccepting, setIsAccepting] = useState(false)

  if (!incomingCall) return null

  const isVideo = incomingCall.callType === 'video'

  return (
    <div className="call-overlay" role="dialog" aria-modal="true" aria-label="Thirrje hyrëse">
      <div className="call-card call-incoming-card">
        <div className="call-avatar-pulse-wrap">
          <div className="call-avatar-ring" />
          <ProfileAvatar
            src={incomingCall.caller.profilePhoto}
            seed={incomingCall.caller.uid}
            alt=""
            size={88}
          />
        </div>

        <div className="call-incoming-info">
          <h2 className="call-caller-name">{incomingCall.caller.name}</h2>
          <div className="call-type-badge">
            {isVideo ? <Video size={16} /> : <Phone size={16} />}
            <span>{isVideo ? 'Video thirrje hyrëse' : 'Thirrje zanore hyrëse'}</span>
          </div>
        </div>

        <div className="call-incoming-actions">
          <button
            type="button"
            className="call-btn call-btn-reject"
            disabled={isAccepting}
            onClick={() => rejectCall()}
            aria-label="Refuzo thirrjen"
          >
            <PhoneOff size={24} />
            <span>Refuzo</span>
          </button>

          <button
            type="button"
            className="call-btn call-btn-accept"
            disabled={isAccepting}
            onClick={async () => {
              setIsAccepting(true)
              try {
                await acceptCall()
              } finally {
                setIsAccepting(false)
              }
            }}
            aria-label="Prano thirrjen"
          >
            {isVideo ? <Video size={24} /> : <Phone size={24} />}
            <span>{isAccepting ? 'Duke u lidhur...' : 'Prano'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
