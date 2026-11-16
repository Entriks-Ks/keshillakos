import { useCall } from './CallContext'
import IncomingCallDialog from './IncomingCallDialog'
import OutgoingCallDialog from './OutgoingCallDialog'
import CallRoomModal from './CallRoomModal'

export default function CallManagerUI() {
  const { stage } = useCall()

  if (stage === 'ringing') {
    return <IncomingCallDialog />
  }

  if (stage === 'calling') {
    return <OutgoingCallDialog />
  }

  if (stage === 'connected') {
    return <CallRoomModal />
  }

  return null
}
