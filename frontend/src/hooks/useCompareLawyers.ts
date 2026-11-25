import { useEffect, useState, useCallback } from 'react'
import { toast } from '@heroui/react'

const STORAGE_KEY = 'keshillohu_compare_lawyers'
const META_KEY = 'keshillohu_compare_lawyers_meta'
const EVENT_NAME = 'keshillohu_compare_change'
const LEGACY_STORAGE_KEY = 'klaw_compare_lawyers'
const LEGACY_META_KEY = 'klaw_compare_lawyers_meta'
export const MAX_COMPARE_LAWYERS = 3

/**
 * Toast copy is translated through a translator registered by the UI (CompareDock, which is
 * always mounted in App). This module is imported by node tests, so it must not import i18n.
 * Until a translator is registered, messages fall back to their translation key.
 */
export type CompareTranslator = (key: string, params?: Record<string, string | number>) => string

let translate: CompareTranslator = (key) => key

export function setCompareTranslator(translator: CompareTranslator) {
  translate = translator
}

export type CompareLawyerMeta = {
  uid: string
  name: string
  photoUrl?: string
  title?: string
}

function migrateLegacyStorage() {
  if (typeof window === 'undefined') return
  try {
    const legacyUids = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyUids && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, legacyUids)
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY)

    const legacyMeta = localStorage.getItem(LEGACY_META_KEY)
    if (legacyMeta && !localStorage.getItem(META_KEY)) {
      localStorage.setItem(META_KEY, legacyMeta)
    }
    localStorage.removeItem(LEGACY_META_KEY)
  } catch {
    // Ignore storage errors
  }
}

function getStoredUids(): string[] {
  if (typeof window === 'undefined') return []
  try {
    migrateLegacyStorage()
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
    migrateLegacyStorage()
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return {}
    return JSON.parse(raw) || {}
  } catch {
    return {}
  }
}

function saveState(uids: string[], metaMap: Record<string, CompareLawyerMeta>) {
  if (typeof window === 'undefined') return
  try {
    const cleanUids = uids.filter(Boolean).slice(0, MAX_COMPARE_LAWYERS)

    // Keep only metadata for currently selected UIDs
    const cleanMeta: Record<string, CompareLawyerMeta> = {}
    for (const uid of cleanUids) {
      if (metaMap[uid]) {
        cleanMeta[uid] = metaMap[uid]
      }
    }

    if (cleanUids.length === 0) {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      localStorage.removeItem(META_KEY)
      localStorage.removeItem(LEGACY_META_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanUids))
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      localStorage.setItem(META_KEY, JSON.stringify(cleanMeta))
      localStorage.removeItem(LEGACY_META_KEY)
    }

    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { uids: cleanUids, meta: cleanMeta },
      })
    )
  } catch {
    // Ignore storage error
  }
}

export function useCompareLawyers() {
  const [selectedUids, setSelectedUids] = useState<string[]>(() => getStoredUids())
  const [metaMap, setMetaMap] = useState<Record<string, CompareLawyerMeta>>(() => getStoredMeta())

  useEffect(() => {
    function handleSync(e: Event) {
      if (e instanceof CustomEvent && e.detail && Array.isArray(e.detail.uids)) {
        setSelectedUids(e.detail.uids)
        setMetaMap(e.detail.meta || {})
      } else {
        setSelectedUids(getStoredUids())
        setMetaMap(getStoredMeta())
      }
    }

    function handleStorage(e: StorageEvent) {
      if (
        e.key === STORAGE_KEY ||
        e.key === META_KEY ||
        e.key === LEGACY_STORAGE_KEY ||
        e.key === LEGACY_META_KEY
      ) {
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
      const currentUids = getStoredUids()
      if (currentUids.includes(uid)) {
        return true
      }
      if (currentUids.length >= MAX_COMPARE_LAWYERS) {
        toast.warning(translate('compareUi.toast.maxReached', { max: MAX_COMPARE_LAWYERS }))
        return false
      }

      const updatedUids = [...currentUids, uid]
      const currentMeta = getStoredMeta()
      if (meta?.name) {
        currentMeta[uid] = {
          uid,
          name: meta.name,
          photoUrl: meta.photoUrl,
          title: meta.title,
        }
      }

      saveState(updatedUids, currentMeta)
      setSelectedUids(updatedUids)
      setMetaMap({ ...currentMeta })

      const progress = { n: updatedUids.length, max: MAX_COMPARE_LAWYERS }
      toast.success(
        meta?.name
          ? translate('compareUi.toast.added', { name: meta.name, ...progress })
          : translate('compareUi.toast.addedAnon', progress),
      )
      return true
    },
    [],
  )

  const recordMeta = useCallback((uid: string, meta: { name: string; photoUrl?: string; title?: string }) => {
    const currentUids = getStoredUids()
    const currentMeta = getStoredMeta()
    currentMeta[uid] = { uid, ...meta }
    saveState(currentUids, currentMeta)
    setMetaMap({ ...currentMeta })
  }, [])

  const removeLawyer = useCallback((uid: string): void => {
    const currentUids = getStoredUids()
    const currentMeta = getStoredMeta()
    const updatedUids = currentUids.filter((id) => id !== uid)
    const removedName = currentMeta[uid]?.name
    delete currentMeta[uid]

    saveState(updatedUids, currentMeta)
    setSelectedUids(updatedUids)
    setMetaMap({ ...currentMeta })

    toast.info(
      removedName
        ? translate('compareUi.toast.removed', { name: removedName })
        : translate('compareUi.toast.removedAnon'),
    )
  }, [])

  const toggleLawyer = useCallback(
    (uid: string, meta?: { name?: string; photoUrl?: string; title?: string }): boolean => {
      const current = getStoredUids()
      if (current.includes(uid)) {
        removeLawyer(uid)
        return false
      } else {
        return addLawyer(uid, meta)
      }
    },
    [addLawyer, removeLawyer],
  )

  const clearComparison = useCallback((): void => {
    saveState([], {})
    setSelectedUids([])
    setMetaMap({})
  }, [])

  const setComparison = useCallback((uids: string[]): void => {
    const clean = uids.filter(Boolean).slice(0, MAX_COMPARE_LAWYERS)
    const currentMeta = getStoredMeta()
    saveState(clean, currentMeta)
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
