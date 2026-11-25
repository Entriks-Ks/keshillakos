import KeshillaPagination from './KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@heroui/react'
import { fetchProviderSchedule, type AvailabilitySlot } from '../api/availability'
import ScheduleCalendar from './ScheduleCalendar'

type Props = {
  providerUid: string
  selectedId: string
  onSelect: (slotId: string) => void
  refreshKey?: number
  required?: boolean
  onLoaded?: (info: { freeCount: number }) => void
}

export default function SlotPicker({
  providerUid,
  selectedId,
  onSelect,
  refreshKey = 0,
  required = false,
  onLoaded,
}: Props) {
  const { t } = useTranslation()
  const { page, setPage, pagination, receivePagination } = usePagination(providerUid)
  const selectionScope = useRef(`${providerUid}:${refreshKey}`)
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const scope = `${providerUid}:${refreshKey}`
    const scopeChanged = selectionScope.current !== scope
    selectionScope.current = scope
    if (scopeChanged && selectedId) onSelect('')
    setLoading(true)
    setError(false)
    fetchProviderSchedule(providerUid, { page, limit: 50 })
      .then((data) => {
        if (cancelled) return
        setSlots(data.slots)
        receivePagination(data.pagination)
        onLoaded?.({ freeCount: data.freeTotal })
        if (selectedId && data.slots.some((s) => s.id === selectedId) && !data.free.some((s) => s.id === selectedId)) {
          onSelect('')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([])
          onLoaded?.({ freeCount: 0 })
          setError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when provider/key changes
  }, [providerUid, refreshKey, page])

  if (loading) {
    return (
      <p className="muted schedule-cal-loading">
        <Spinner size="sm" />
        {t('availability.picker.loading')}
      </p>
    )
  }

  if (error) {
    return <p className="error">{t('availability.picker.loadError')}</p>
  }

  if (slots.length === 0) {
    return (
      <p className="muted">
        {required
          ? t('availability.picker.noneRequired')
          : t('availability.picker.none')}
      </p>
    )
  }

  return (
    <>
    <ScheduleCalendar
      key={page}
      slots={slots}
      selectedId={selectedId}
      onSelect={onSelect}
      selectable
      required={required}
    />
    <KeshillaPagination pagination={pagination} onPageChange={setPage} />
    </>
  )
}
