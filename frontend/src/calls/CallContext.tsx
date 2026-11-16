import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { useCallRingtone } from './useCallRingtone'
import { type CallPeer, type CallType } from '../api/calls'
import { toast } from '@heroui/react'

export type CallStage = 'idle' | 'calling' | 'ringing' | 'connected'

export type IncomingCallData = {
  callId: string
  conversationId: string
  caller: CallPeer
  callType: CallType
  roomName: string
}

export type OutgoingCallData = {
  callId?: string
  conversationId: string
  receiver: CallPeer
  callType: CallType
  roomName?: string
}

export type ActiveCallData = {
  callId: string
  conversationId: string
  peer: CallPeer
  callType: CallType
  roomName: string
  isCaller: boolean
}

type CallContextType = {
  stage: CallStage
  incomingCall: IncomingCallData | null
  outgoingCall: OutgoingCallData | null
  activeCall: ActiveCallData | null
  peerDisconnected: boolean
  initiateCall: (params: {
    conversationId: string
    receiverUid: string
    peerName: string
    peerPhoto?: string
    callType: CallType
  }) => Promise<boolean>
  acceptCall: () => Promise<void>
  rejectCall: (reason?: string) => Promise<void>
  endCall: () => Promise<void>
  resetCalls: () => void
}

const CallContext = createContext<CallContextType | null>(null)

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const ringtone = useCallRingtone()
  const incomingTimeoutRef = useRef<number | null>(null)

  const [stage, setStage] = useState<CallStage>('idle')
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCallData | null>(null)
  const [activeCall, setActiveCall] = useState<ActiveCallData | null>(null)
  const [peerDisconnected, setPeerDisconnected] = useState(false)

  // Use refs to avoid stale closures in socket event handlers
  const stageRef = useRef(stage)
  stageRef.current = stage
  const incomingRef = useRef(incomingCall)
  incomingRef.current = incomingCall
  const outgoingRef = useRef(outgoingCall)
  outgoingRef.current = outgoingCall
  const activeRef = useRef(activeCall)
  activeRef.current = activeCall

  const resetCalls = useCallback(() => {
    if (incomingTimeoutRef.current) {
      clearTimeout(incomingTimeoutRef.current)
      incomingTimeoutRef.current = null
    }
    ringtone.stop()
    setStage('idle')
    setIncomingCall(null)
    setOutgoingCall(null)
    setActiveCall(null)
    setPeerDisconnected(false)
  }, [ringtone])

  const userUid = user?.uid

  useEffect(() => {
    if (!userUid) {
      resetCalls()
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }

    const socket = io(API_BASE_URL, {
      path: '/socket.io',
      auth: (cb) => cb({ token: localStorage.getItem('token') }),
      reconnection: true,
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[CallContext] Connected to socket as user:', userUid, 'socket ID:', socket.id)
    })

    socket.on('connect_error', (err) => {
      console.warn('[CallContext] Socket connection error:', err?.message)
    })

    socket.on('call:incoming', (data: IncomingCallData) => {
      console.log('[CallContext] Received call:incoming:', data, 'current stage:', stageRef.current)

      // 1. If incoming call is from the same peer as any current active, incoming, or outgoing call:
      const currentPeerUid =
        activeRef.current?.peer?.uid ||
        incomingRef.current?.caller?.uid ||
        outgoingRef.current?.receiver?.uid

      const isSamePeer = Boolean(currentPeerUid && currentPeerUid === data?.caller?.uid)

      if (isSamePeer) {
        console.log('[CallContext] Incoming call from same peer. Clearing previous session.')
        resetCalls()
      } else if (stageRef.current !== 'idle') {
        // If stage was merely ringing (unanswered previous call) or calling (pending outgoing), replace it
        if (stageRef.current === 'ringing' || stageRef.current === 'calling') {
          console.log('[CallContext] Replacing pending call stage with new incoming call.')
          resetCalls()
        } else if (stageRef.current === 'connected' && activeRef.current) {
          // Genuinely in an active call with another user
          console.log('[CallContext] User is busy in an active call with another user.')
          socket.emit('call:reject', { callId: data.callId, reason: 'busy' })
          toast.info(`Thirrje e re nga ${data.caller?.name || 'Përdorues'} (U refuzua pasi je në thirrje)`)
          return
        } else {
          // Stale stage without active call data
          console.log('[CallContext] Inconsistent stage state. Resetting to accept incoming call.')
          resetCalls()
        }
      }

      setIncomingCall(data)
      setStage('ringing')
      ringtone.startRinging()

      if (incomingTimeoutRef.current) clearTimeout(incomingTimeoutRef.current)
      incomingTimeoutRef.current = window.setTimeout(() => {
        if (stageRef.current === 'ringing') {
          toast.info(`Thirrje e humbur nga ${data.caller?.name || 'Përdorues'}`)
          resetCalls()
        }
      }, 62_000)
    })

    socket.on('call:accepted', (data: { callId: string; roomName: string; acceptedBy: string }) => {
      ringtone.stop()

      if (
        outgoingRef.current &&
        (outgoingRef.current.callId === data.callId || !outgoingRef.current.callId || stageRef.current === 'calling')
      ) {
        setActiveCall({
          callId: data.callId,
          conversationId: outgoingRef.current.conversationId,
          peer: outgoingRef.current.receiver,
          callType: outgoingRef.current.callType,
          roomName: data.roomName || outgoingRef.current.roomName || '',
          isCaller: true,
        })
        setOutgoingCall(null)
        setStage('connected')
      } else if (
        incomingRef.current &&
        (incomingRef.current.callId === data.callId || !incomingRef.current.callId || stageRef.current === 'ringing')
      ) {
        setActiveCall({
          callId: data.callId,
          conversationId: incomingRef.current.conversationId,
          peer: incomingRef.current.caller,
          callType: incomingRef.current.callType,
          roomName: data.roomName || incomingRef.current.roomName || '',
          isCaller: false,
        })
        setIncomingCall(null)
        setStage('connected')
      }
    })

    socket.on('call:rejected', (data: { callId: string; reason?: string }) => {
      if (
        (outgoingRef.current && outgoingRef.current.callId === data.callId) ||
        (incomingRef.current && incomingRef.current.callId === data.callId)
      ) {
        ringtone.stop()
        if (data.reason === 'busy') {
          toast.danger('Përdoruesi është i zënë në një thirrje tjetër')
        } else {
          toast.info('Thirrja u refuzua')
        }
        resetCalls()
      }
    })

    socket.on('call:timeout', (data: { callId: string }) => {
      if (outgoingRef.current && outgoingRef.current.callId === data.callId) {
        ringtone.stop()
        toast.info('Nuk u përgjigj (Koha mbaroi)')
        resetCalls()
      }
    })

    socket.on('call:missed', (data: { callId: string; caller: CallPeer; callType: CallType }) => {
      ringtone.stop()
      if (!data?.callId || (incomingRef.current && incomingRef.current.callId === data.callId) || stageRef.current === 'ringing') {
        toast.info(`Thirrje e humbur nga ${data?.caller?.name || incomingRef.current?.caller?.name || 'Përdorues'}`)
        resetCalls()
      }
    })

    socket.on('call:ended', (data: { callId: string; duration?: number }) => {
      ringtone.stop()
      if (
        !data?.callId ||
        (activeRef.current && activeRef.current.callId === data.callId) ||
        (outgoingRef.current && outgoingRef.current.callId === data.callId) ||
        (incomingRef.current && incomingRef.current.callId === data.callId) ||
        stageRef.current !== 'idle'
      ) {
        if (typeof data?.duration === 'number' && data.duration > 0) {
          const mins = Math.floor(data.duration / 60)
          const secs = data.duration % 60
          const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
          toast.info(`Thirrja përfundoi (${timeStr})`)
        } else if (stageRef.current === 'connected') {
          toast.info('Thirrja përfundoi')
        }
        resetCalls()
      }
    })

    socket.on('call:peer-disconnected', (data: { callId: string }) => {
      if (activeRef.current && activeRef.current.callId === data.callId) {
        setPeerDisconnected(true)
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      ringtone.stop()
    }
  }, [userUid, resetCalls, ringtone])

  useEffect(() => {
    const handleBeforeUnload = () => {
      const callId = activeRef.current?.callId || outgoingRef.current?.callId
      if (callId && socketRef.current) {
        socketRef.current.emit('call:end', { callId })
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const initiateCall = useCallback(
    async (params: {
      conversationId: string
      receiverUid: string
      peerName: string
      peerPhoto?: string
      callType: CallType
    }): Promise<boolean> => {
      if (stageRef.current !== 'idle') {
        const currentPeerUid =
          activeRef.current?.peer?.uid ||
          outgoingRef.current?.receiver?.uid ||
          incomingRef.current?.caller?.uid

        const isCurrentReceiver = Boolean(currentPeerUid && currentPeerUid === params.receiverUid)

        if (isCurrentReceiver || !activeRef.current) {
          console.log('[CallContext] Recovering from previous stage with same peer to place new call')
          resetCalls()
        } else {
          toast.danger(`Je tashmë në një thirrje me ${activeRef.current.peer.name || 'një person tjetër'}`)
          return false
        }
      }

      const socket = socketRef.current
      if (!socket || !socket.connected) {
        toast.danger('Lidhja me serverin nuk është gati')
        return false
      }

      const receiver: CallPeer = {
        uid: params.receiverUid,
        name: params.peerName,
        profilePhoto: params.peerPhoto,
      }

      setOutgoingCall({
        conversationId: params.conversationId,
        receiver,
        callType: params.callType,
      })
      setStage('calling')
      ringtone.startRingback()

      return new Promise((resolve) => {
        socket.emit(
          'call:initiate',
          {
            conversationId: params.conversationId,
            receiverUid: params.receiverUid,
            callType: params.callType,
          },
          (res: { ok: boolean; callId?: string; roomName?: string; busy?: boolean; error?: string }) => {
            if (!res?.ok) {
              ringtone.stop()
              if (res?.busy) {
                toast.danger('Përdoruesi është i zënë në një thirrje tjetër')
              } else {
                toast.danger(res?.error || 'Nisja e thirrjes dështoi')
              }
              resetCalls()
              resolve(false)
              return
            }

            if (outgoingRef.current) {
              outgoingRef.current.callId = res.callId
              outgoingRef.current.roomName = res.roomName
            }
            setOutgoingCall((prev) =>
              prev ? { ...prev, callId: res.callId, roomName: res.roomName } : null,
            )
            resolve(true)
          },
        )
      })
    },
    [stage, ringtone, resetCalls],
  )

  const acceptCall = useCallback(async () => {
    const current = incomingRef.current
    if (!current) return

    ringtone.stop()
    const socket = socketRef.current
    if (!socket) return

    socket.emit('call:accept', { callId: current.callId }, (res: { ok: boolean; roomName?: string; error?: string }) => {
      if (res?.ok) {
        setActiveCall({
          callId: current.callId,
          conversationId: current.conversationId,
          peer: current.caller,
          callType: current.callType,
          roomName: res.roomName || current.roomName,
          isCaller: false,
        })
        setIncomingCall(null)
        setStage('connected')
      } else {
        toast.danger(res?.error || 'Pranimi i thirrjes dështoi')
        resetCalls()
      }
    })
  }, [ringtone, resetCalls])

  const rejectCall = useCallback(
    async (reason = 'rejected') => {
      const current = incomingRef.current
      if (!current) return

      ringtone.stop()
      socketRef.current?.emit('call:reject', { callId: current.callId, reason })
      resetCalls()
    },
    [ringtone, resetCalls],
  )

  const endCall = useCallback(async () => {
    ringtone.stop()
    const callId = activeRef.current?.callId || outgoingRef.current?.callId || incomingRef.current?.callId
    if (callId && socketRef.current) {
      socketRef.current.emit('call:end', { callId })
    }
    resetCalls()
  }, [ringtone, resetCalls])

  return (
    <CallContext.Provider
      value={{
        stage,
        incomingCall,
        outgoingCall,
        activeCall,
        peerDisconnected,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        resetCalls,
      }}
    >
      {children}
    </CallContext.Provider>
  )
}

export function useCall() {
  const context = useContext(CallContext)
  if (!context) {
    throw new Error('useCall must be used within a CallProvider')
  }
  return context
}
