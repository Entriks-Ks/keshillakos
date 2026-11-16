import { PhoneOff, Video, Phone } from 'lucide-react'
import ProfileAvatar from '../components/ProfileAvatar'
import { useCall } from './CallContext'
import './Call.css'

export default function OutgoingCallDialog() {
  const { outgoingCall, endCall } = useCall()

  if (!outgoingCall) return null

  const isVideo = outgoingCall.callType === 'video'

  return (
    <div className="call-overlay" role="dialog" aria-modal="true" aria-label="Duke thirrur">
      <div className="call-card call-outgoing-card">
        <div className="call-avatar-pulse-wrap">
          <div className="call-avatar-ring is-outgoing" />
          <ProfileAvatar
            src={outgoingCall.receiver.profilePhoto}
            seed={outgoingCall.receiver.uid}
            alt=""
            size={88}
          />
        </div>

        <div className="call-incoming-info">
          <h2 className="call-caller-name">{outgoingCall.receiver.name}</h2>
          <div className="call-type-badge is-ringing">
            {isVideo ? <Video size={16} /> : <Phone size={16} />}
            <span>Duke thirrur...</span>
          </div>
        </div>

        <div className="call-outgoing-actions">
          <button
            type="button"
            className="call-btn call-btn-end"
            onClick={() => endCall()}
            aria-label="Ndërprit thirrjen"
          >
            <PhoneOff size={24} />
            <span>Mbyll</span>
          </button>
        </div>
      </div>
    </div>
  )
}
