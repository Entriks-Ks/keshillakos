import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  type RemoteTrack,
  type TrackPublication,
  type RemoteParticipant,
} from 'livekit-client'
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  SwitchCamera,
  Maximize2,
  Minimize2,
  Volume2,
  AlertTriangle,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react'
import ProfileAvatar from '../components/ProfileAvatar'
import { fetchLivekitToken } from '../api/calls'
import { useCall } from './CallContext'
import './Call.css'

export default function CallRoomModal() {
  const { activeCall, endCall, peerDisconnected } = useCall()

  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Connecting,
  )
  const [error, setError] = useState<string | null>(null)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [durationSeconds, setDurationSeconds] = useState(0)

  // Media controls state
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(activeCall?.callType === 'audio')
  const [isVoiceOnly, setIsVoiceOnly] = useState(activeCall?.callType === 'audio')
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0)

  // Elements and room references
  const containerRef = useRef<HTMLDivElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const roomRef = useRef<Room | null>(null)

  // Format call duration MM:SS or HH:MM:SS
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600)
    const minutes = Math.floor((secs % 3600) / 60)
    const seconds = secs % 60
    const pad = (n: number) => n.toString().padStart(2, '0')
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    }
    return `${pad(minutes)}:${pad(seconds)}`
  }

  // Duration timer
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return
    const interval = window.setInterval(() => {
      setDurationSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [connectionState])

  // Enumerate video devices for mobile camera switching
  useEffect(() => {
    async function loadDevices() {
      try {
        const devices = await Room.getLocalDevices('videoinput')
        setVideoDevices(devices)
      } catch {
        // Device enumeration unsupported or denied
      }
    }
    void loadDevices()
  }, [])

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Connect to LiveKit Room
  useEffect(() => {
    if (!activeCall) return

    let isDisposed = false
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    })
    roomRef.current = room

    async function initRoom() {
      try {
        setError(null)
        setPermissionError(null)

        // 1. Fetch token from backend
        const { token, livekitUrl } = await fetchLivekitToken(activeCall!.callId)
        if (isDisposed) return

        const resolvedUrl =
          livekitUrl ||
          import.meta.env.VITE_LIVEKIT_URL ||
          (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.hostname + ':7880'

        // 2. Set up Room Event Listeners
        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, _pub: TrackPublication, _participant: RemoteParticipant) => {
            if (track.kind === Track.Kind.Video) {
              if (remoteVideoRef.current) {
                track.attach(remoteVideoRef.current)
                setHasRemoteVideo(true)
              }
            } else if (track.kind === Track.Kind.Audio) {
              if (remoteAudioRef.current) {
                track.attach(remoteAudioRef.current)
              }
            }
          },
        )

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach()
          if (track.kind === Track.Kind.Video) {
            setHasRemoteVideo(false)
          }
        })

        room.on(RoomEvent.TrackMuted, (pub: TrackPublication) => {
          if (pub.kind === Track.Kind.Video) {
            setHasRemoteVideo(false)
          }
        })

        room.on(RoomEvent.TrackUnmuted, (pub: TrackPublication) => {
          if (pub.kind === Track.Kind.Video) {
            setHasRemoteVideo(true)
          }
        })

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          if (!isDisposed) setConnectionState(state)
        })

        room.on(RoomEvent.Disconnected, () => {
          if (!isDisposed) setConnectionState(ConnectionState.Disconnected)
        })

        room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          console.log('[CallRoom] Remote participant disconnected:', participant.identity)
        })

        // 3. Connect to the LiveKit Room
        await room.connect(resolvedUrl, token)
        if (isDisposed) return

        // 4. Publish local tracks
        try {
          if (activeCall!.callType === 'video') {
            await room.localParticipant.enableCameraAndMicrophone()
            const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera)
            if (camPub?.videoTrack && localVideoRef.current) {
              camPub.videoTrack.attach(localVideoRef.current)
            }
          } else {
            await room.localParticipant.setMicrophoneEnabled(true)
            await room.localParticipant.setCameraEnabled(false)
          }
        } catch (mediaErr: unknown) {
          const err = mediaErr as Error
          console.warn('Media permission warning:', err)
          if (
            err.name === 'NotAllowedError' ||
            err.name === 'PermissionDeniedError' ||
            err.message?.includes('denied')
          ) {
            setPermissionError(
              'Qasja në kamerë ose mikrofon u refuzua. Ju lutem lejoni qasjen në cilësimet e shfletuesit tuaj.',
            )
          } else if (err.name === 'NotFoundError') {
            setPermissionError('Nuk u gjet asnjë kamerë ose mikrofon i lidhur.')
          }
        }
      } catch (err: unknown) {
        if (!isDisposed) {
          console.error('LiveKit connection error:', err)
          setError(
            err instanceof Error
              ? err.message
              : 'Dështoi lidhja me serverin e thirrjeve (LiveKit)',
          )
        }
      }
    }

    void initRoom()

    return () => {
      isDisposed = true
      if (roomRef.current) {
        roomRef.current.disconnect()
        roomRef.current = null
      }
    }
  }, [activeCall])

  // Toggle Microphone
  const toggleMic = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !isMuted
    await room.localParticipant.setMicrophoneEnabled(!next)
    setIsMuted(next)
  }, [isMuted])

  // Toggle Camera
  const toggleCamera = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !isCameraOff
    await room.localParticipant.setCameraEnabled(!next)
    setIsCameraOff(next)

    if (!next) {
      setTimeout(() => {
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera)
        if (camPub?.videoTrack && localVideoRef.current) {
          camPub.videoTrack.attach(localVideoRef.current)
        }
      }, 100)
    }
  }, [isCameraOff])

  // Switch Mobile Camera (Front / Back)
  const switchCamera = useCallback(async () => {
    const room = roomRef.current
    if (!room || videoDevices.length <= 1) return

    const nextIndex = (currentDeviceIndex + 1) % videoDevices.length
    const nextDevice = videoDevices[nextIndex]
    try {
      await room.switchActiveDevice('videoinput', nextDevice.deviceId)
      setCurrentDeviceIndex(nextIndex)

      const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera)
      if (camPub?.videoTrack && localVideoRef.current) {
        camPub.videoTrack.attach(localVideoRef.current)
      }
    } catch (err) {
      console.warn('Switch camera failed:', err)
    }
  }, [currentDeviceIndex, videoDevices])

  // Toggle Voice-Only mode
  const toggleVoiceOnly = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !isVoiceOnly
    setIsVoiceOnly(next)
    if (next) {
      await room.localParticipant.setCameraEnabled(false)
      setIsCameraOff(true)
    } else {
      await room.localParticipant.setCameraEnabled(true)
      setIsCameraOff(false)
      setTimeout(() => {
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera)
        if (camPub?.videoTrack && localVideoRef.current) {
          camPub.videoTrack.attach(localVideoRef.current)
        }
      }, 100)
    }
  }, [isVoiceOnly])

  // Toggle Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen().catch(() => undefined)
    } else {
      void document.exitFullscreen().catch(() => undefined)
    }
  }, [])

  if (!activeCall) return null

  const isConnected = connectionState === ConnectionState.Connected
  const isReconnecting = connectionState === ConnectionState.Reconnecting

  return (
    <div
      ref={containerRef}
      className={`call-room-modal${isFullscreen ? ' is-fullscreen' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Thirrje aktive"
    >
      {/* Hidden remote audio element */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Header bar: Peer info, connection status & timer */}
      <header className="call-room-head">
        <div className="call-room-peer-meta">
          <ProfileAvatar
            src={activeCall.peer.profilePhoto}
            seed={activeCall.peer.uid}
            alt=""
            size={40}
          />
          <div>
            <h3 className="call-room-peer-name">{activeCall.peer.name}</h3>
            <div className="call-room-status-indicator">
              {isConnected ? (
                <span className="call-indicator is-connected">
                  <Wifi size={13} /> {formatTime(durationSeconds)}
                </span>
              ) : isReconnecting ? (
                <span className="call-indicator is-reconnecting">
                  <Radio size={13} className="animate-spin" /> Duke u rilidhur...
                </span>
              ) : (
                <span className="call-indicator is-connecting">
                  <Radio size={13} className="animate-spin" /> Duke u lidhur...
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="call-room-head-actions">
          <button
            type="button"
            className="call-icon-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Dil nga ekrani i plotë' : 'Ekran i plotë'}
            title={isFullscreen ? 'Dil nga ekrani i plotë' : 'Ekran i plotë'}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </header>

      {/* Warnings & Banners */}
      {permissionError && (
        <div className="call-banner is-warning" role="alert">
          <AlertTriangle size={18} />
          <span>{permissionError}</span>
        </div>
      )}

      {error && (
        <div className="call-banner is-danger" role="alert">
          <WifiOff size={18} />
          <span>{error}</span>
          <button
            type="button"
            className="call-banner-btn"
            onClick={endCall}
            aria-label="Mbyll"
          >
            Mbyll
          </button>
        </div>
      )}

      {peerDisconnected && (
        <div className="call-banner is-warning" role="alert">
          <Radio size={18} className="animate-spin" />
          <span>Pjesëmarrësi tjetër u shkëput përkohësisht. Duke pritur...</span>
        </div>
      )}

      {/* Main View Area: Remote Participant Video / Audio Visualizer */}
      <main className="call-stage-area">
        {hasRemoteVideo && !isVoiceOnly ? (
          <video
            ref={remoteVideoRef}
            className="call-remote-video"
            autoPlay
            playsInline
          />
        ) : (
          <div className="call-voice-only-stage">
            <div className="call-voice-pulse-wrap">
              <div className="call-voice-wave wave-1" />
              <div className="call-voice-wave wave-2" />
              <ProfileAvatar
                src={activeCall.peer.profilePhoto}
                seed={activeCall.peer.uid}
                alt=""
                size={120}
              />
            </div>
            <p className="call-voice-label">
              {isVoiceOnly ? 'Modaliteti vetëm zë' : `${activeCall.peer.name} (Kamera është e fikur)`}
            </p>
          </div>
        )}

        {/* Local Participant Preview (Picture-in-Picture) */}
        {!isVoiceOnly && (
          <div className="call-local-pip" aria-label="Pamja jote">
            <video
              ref={localVideoRef}
              className={`call-local-video${isCameraOff ? ' is-hidden' : ''}`}
              autoPlay
              playsInline
              muted
            />
            {isCameraOff && (
              <div className="call-local-placeholder">
                <VideoOff size={24} />
                <span>Kamera jote është e fikur</span>
              </div>
            )}
            {videoDevices.length > 1 && !isCameraOff && (
              <button
                type="button"
                className="call-flip-camera-btn"
                onClick={switchCamera}
                title="Ndërro kamerën (Përpara / Prapa)"
                aria-label="Ndërro kamerën"
              >
                <SwitchCamera size={16} />
              </button>
            )}
          </div>
        )}
      </main>

      {/* Bottom Control Dock */}
      <footer className="call-controls-dock" role="toolbar" aria-label="Kontrollet e thirrjes">
        {/* Mic Toggle */}
        <button
          type="button"
          className={`call-ctrl-btn${isMuted ? ' is-off' : ''}`}
          onClick={toggleMic}
          aria-label={isMuted ? 'Aktivizo mikrofonin' : 'Çaktivizo mikrofonin'}
          title={isMuted ? 'Aktivizo mikrofonin' : 'Çaktivizo mikrofonin'}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          <span>{isMuted ? 'Mikrofoni jo' : 'Mikrofoni'}</span>
        </button>

        {/* Camera Toggle */}
        <button
          type="button"
          className={`call-ctrl-btn${isCameraOff ? ' is-off' : ''}`}
          onClick={toggleCamera}
          aria-label={isCameraOff ? 'Aktivizo kamerën' : 'Fik kamerën'}
          title={isCameraOff ? 'Aktivizo kamerën' : 'Fik kamerën'}
        >
          {isCameraOff ? <VideoOff size={22} /> : <VideoIcon size={22} />}
          <span>{isCameraOff ? 'Kamera jo' : 'Kamera'}</span>
        </button>

        {/* Voice-Only Toggle */}
        <button
          type="button"
          className={`call-ctrl-btn${isVoiceOnly ? ' is-active-mode' : ''}`}
          onClick={toggleVoiceOnly}
          aria-label={isVoiceOnly ? 'Aktivizo videon' : 'Kalo vetëm në zë'}
          title={isVoiceOnly ? 'Aktivizo videon' : 'Kalo vetëm në zë'}
        >
          <Volume2 size={22} />
          <span>{isVoiceOnly ? 'Vetëm zë' : 'Video/Zë'}</span>
        </button>

        {/* Mobile camera flip (if 2+ cameras available) */}
        {videoDevices.length > 1 && !isCameraOff && !isVoiceOnly && (
          <button
            type="button"
            className="call-ctrl-btn"
            onClick={switchCamera}
            aria-label="Ndërro kamerën"
            title="Ndërro kamerën"
          >
            <SwitchCamera size={22} />
            <span>Kamera</span>
          </button>
        )}

        {/* End Call Button */}
        <button
          type="button"
          className="call-ctrl-btn call-ctrl-btn-end"
          onClick={endCall}
          aria-label="Mbyll thirrjen"
          title="Mbyll thirrjen"
        >
          <PhoneOff size={24} />
          <span>Mbyll</span>
        </button>
      </footer>
    </div>
  )
}
