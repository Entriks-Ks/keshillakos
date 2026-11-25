import { useState } from 'react'
import { Phone, PhoneOff, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ProfileAvatar from '../components/ProfileAvatar'
import { useCall } from './CallContext'
import './Call.css'

export default function IncomingCallDialog() {
  const { incomingCall, acceptCall, rejectCall } = useCall()
  const [isAccepting, setIsAccepting] = useState(false)
  const { t } = useTranslation()

  if (!incomingCall) return null

  const isVideo = incomingCall.callType === 'video'

  return (
    <div className="call-overlay" role="dialog" aria-modal="true" aria-label={t('calls.incoming')}>
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
            <span>{isVideo ? t('calls.incomingVideo') : t('calls.incomingVoice')}</span>
          </div>
        </div>

        <div className="call-incoming-actions">
          <button
            type="button"
            className="call-btn call-btn-reject"
            disabled={isAccepting}
            onClick={() => rejectCall()}
            aria-label={t('calls.declineCall')}
          >
            <PhoneOff size={24} />
            <span>{t('calls.decline')}</span>
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
            aria-label={t('calls.acceptCall')}
          >
            {isVideo ? <Video size={24} /> : <Phone size={24} />}
            <span>{isAccepting ? t('calls.connecting') : t('calls.accept')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
