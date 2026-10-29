import { useEffect, useState, useCallback } from 'react'
import { toast } from '@heroui/react'

const STORAGE_KEY = 'klaw_compare_lawyers'
const META_KEY = 'klaw_compare_lawyers_meta'
const EVENT_NAME = 'klaw_compare_change'
export const MAX_COMPARE_LAWYERS = 3

export type CompareLawyerMeta = {
  uid: string
  name: string
  photoUrl?: string
  title?: string
}

function getStoredUids(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((id) => typeof id === 'string' && id.trim().length > 0).slice(0, MAX_COMPARE_LAWYERS)
    }
  } catch {
    // Ignore parse error
  }
  return []
}

function getStoredMeta(): Record<string, CompareLawyerMeta> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return {}
    return JSON.parse(raw) || {}
  } catch {
    return {}
  }
}

function saveUids(uids: string[]) {
  if (typeof window === 'undefined') return
  try {
    const clean = uids.filter(Boolean).slice(0, MAX_COMPARE_LAWYERS)
    if (clean.length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: clean }))
  } catch {
    // Ignore storage error
  }
}

function saveMeta(metaMap: Record<string, CompareLawyerMeta>) {
  if (typeof window === 'undefined') return
  try {
    if (Object.keys(metaMap).length === 0) {
      localStorage.removeItem(META_KEY)
    } else {
      localStorage.setItem(META_KEY, JSON.stringify(metaMap))
    }
  } catch {
    // Ignore storage error
  }
}

export function useCompareLawyers() {
  const [selectedUids, setSelectedUids] = useState<string[]>(() => getStoredUids())
  const [metaMap, setMetaMap] = useState<Record<string, CompareLawyerMeta>>(() => getStoredMeta())

  useEffect(() => {
    function handleSync(e: Event) {
      if (e instanceof CustomEvent && Array.isArray(e.detail)) {
        setSelectedUids(e.detail)
      } else {
        setSelectedUids(getStoredUids())
      }
      setMetaMap(getStoredMeta())
    }

    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY || e.key === META_KEY) {
        setSelectedUids(getStoredUids())
        setMetaMap(getStoredMeta())
      }
    }

    window.addEventListener(EVENT_NAME, handleSync)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(EVENT_NAME, handleSync)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const addLawyer = useCallback(
    (uid: string, meta?: { name?: string; photoUrl?: string; title?: string }): boolean => {
      const current = getStoredUids()
      if (current.includes(uid)) {
        return true
      }
      if (current.length >= MAX_COMPARE_LAWYERS) {
        toast.warning(
          'Mund të krahasoni deri në 3 avokatë njëherësh. Hiqni një avokat ekzistues për të shtuar këtë.',
        )
        return false
      }

      const updated = [...current, uid]
      saveUids(updated)
      setSelectedUids(updated)

      if (meta?.name) {
        const currentMeta = getStoredMeta()
        currentMeta[uid] = {
          uid,
          name: meta.name,
          photoUrl: meta.photoUrl,
          title: meta.title,
        }
        saveMeta(currentMeta)
        setMetaMap(currentMeta)
      }

      toast.success(
        meta?.name
          ? `"${meta.name}" u shtua në krahasim (${updated.length}/3)`
          : `Avokati u shtua në krahasim (${updated.length}/3)`,
      )
      return true
    },
    [],
  )

  const recordMeta = useCallback((uid: string, meta: { name: string; photoUrl?: string; title?: string }) => {
    const currentMeta = getStoredMeta()
    currentMeta[uid] = { uid, ...meta }
    saveMeta(currentMeta)
    setMetaMap({ ...currentMeta })
  }, [])

  const removeLawyer = useCallback((uid: string): void => {
    const current = getStoredUids()
    const updated = current.filter((id) => id !== uid)
    saveUids(updated)
    setSelectedUids(updated)

    const currentMeta = getStoredMeta()
    if (currentMeta[uid]) {
      delete currentMeta[uid]
      saveMeta(currentMeta)
      setMetaMap({ ...currentMeta })
    }
  }, [])

  const toggleLawyer = useCallback(
    (uid: string, meta?: { name?: string; photoUrl?: string; title?: string }): boolean => {
      const current = getStoredUids()
      if (current.includes(uid)) {
        removeLawyer(uid)
        toast.info('Avokati u hoq nga krahasimi')
        return false
      } else {
        return addLawyer(uid, meta)
      }
    },
    [addLawyer, removeLawyer],
  )

  const clearComparison = useCallback((): void => {
    saveUids([])
    saveMeta({})
    setSelectedUids([])
    setMetaMap({})
  }, [])

  const setComparison = useCallback((uids: string[]): void => {
    const clean = uids.filter(Boolean).slice(0, MAX_COMPARE_LAWYERS)
    saveUids(clean)
    setSelectedUids(clean)
  }, [])

  const isLawyerSelected = useCallback(
    (uid: string): boolean => {
      return selectedUids.includes(uid)
    },
    [selectedUids],
  )

  return {
    selectedUids,
    metaMap,
    count: selectedUids.length,
    isMax: selectedUids.length >= MAX_COMPARE_LAWYERS,
    addLawyer,
    recordMeta,
    removeLawyer,
    toggleLawyer,
    isLawyerSelected,
    clearComparison,
    setComparison,
  }
}
