import { useEffect, useState } from 'react'
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
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchProviderSchedule(providerUid)
      .then((data) => {
        if (cancelled) return
        setSlots(data.slots)
        onLoaded?.({ freeCount: data.free.length })
        if (selectedId && !data.free.some((s) => s.id === selectedId)) {
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
  }, [providerUid, refreshKey])

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
    <ScheduleCalendar
      slots={slots}
      selectedId={selectedId}
      onSelect={onSelect}
      selectable
      required={required}
    />
  )
}
