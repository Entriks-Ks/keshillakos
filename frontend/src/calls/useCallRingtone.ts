import { useCallback, useEffect, useMemo, useRef } from 'react'

export function useCallRingtone() {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const isPlayingRef = useRef<'ringing' | 'ringback' | null>(null)
  const timerRef = useRef<number | null>(null)

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass()
      }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      void audioCtxRef.current.resume().catch(() => undefined)
    }
    return audioCtxRef.current
  }, [])

  const playTone = useCallback((freq1: number, freq2: number, duration: number, gainValue = 0.15) => {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()

    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(freq1, now)

    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(freq2, now)

    gain.gain.setValueAtTime(0.001, now)
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.04)
    gain.gain.setValueAtTime(gainValue, now + duration - 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)

    osc1.start(now)
    osc2.start(now)
    osc1.stop(now + duration)
    osc2.stop(now + duration)
  }, [getAudioContext])

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    isPlayingRef.current = null
  }, [])

  const startRinging = useCallback(() => {
    stop()
    isPlayingRef.current = 'ringing'
    getAudioContext()

    const chime = () => {
      if (isPlayingRef.current !== 'ringing') return
      // Pleasant melodic chime: 523.25 Hz (C5) and 659.25 Hz (E5)
      playTone(523.25, 659.25, 0.45, 0.18)
      setTimeout(() => {
        if (isPlayingRef.current === 'ringing') {
          playTone(659.25, 783.99, 0.55, 0.18)
        }
      }, 350)
    }

    chime()
    timerRef.current = window.setInterval(chime, 2200)
  }, [getAudioContext, playTone, stop])

  const startRingback = useCallback(() => {
    stop()
    isPlayingRef.current = 'ringback'
    getAudioContext()

    const tone = () => {
      if (isPlayingRef.current !== 'ringback') return
      // Standard telephone ringback tone: 440 Hz + 480 Hz
      playTone(440, 480, 1.2, 0.12)
    }

    tone()
    timerRef.current = window.setInterval(tone, 3000)
  }, [getAudioContext, playTone, stop])

  useEffect(() => {
    return () => {
      stop()
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => undefined)
        audioCtxRef.current = null
      }
    }
  }, [stop])

  return useMemo(
    () => ({
      startRinging,
      startRingback,
      stop,
    }),
    [startRinging, startRingback, stop],
  )
}
