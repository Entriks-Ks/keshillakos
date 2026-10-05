import KeshillaPagination from './KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { useEffect, useRef, useState } from 'react'
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
  const { page, setPage, pagination, receivePagination } = usePagination(providerUid)
  const selectionScope = useRef(`${providerUid}:${refreshKey}`)
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const scope = `${providerUid}:${refreshKey}`
    const scopeChanged = selectionScope.current !== scope
    selectionScope.current = scope
    if (scopeChanged && selectedId) onSelect('')
    setLoading(true)
    setError('')
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
          setError('Nuk u ngarkuan oraret')
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
        Duke ngarkuar oraret...
      </p>
    )
  }

  if (error) {
    return <p className="error">{error}</p>
  }

  if (slots.length === 0) {
    return (
      <p className="muted">
        {required
          ? 'Ofruesi nuk ka publikuar orare të lira. Nuk mund të dërgosh kërkesë pa zgjedhur një orë.'
          : 'Ofruesi nuk ka publikuar orare ende.'}
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
