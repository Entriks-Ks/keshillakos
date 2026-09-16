import { useEffect, useMemo, useState } from 'react'
import {
  fetchProviderSchedule,
  formatSlotDay,
  formatSlotTime,
  type AvailabilitySlot,
} from '../api/availability'

type Props = {
  providerUid: string
  selectedId: string
  onSelect: (slotId: string) => void
  refreshKey?: number
  required?: boolean
}

function groupByDay(slots: AvailabilitySlot[]) {
  const map = new Map<string, AvailabilitySlot[]>()
  for (const slot of slots) {
    const key = formatSlotDay(slot.startAt)
    const list = map.get(key) || []
    list.push(slot)
    map.set(key, list)
  }
  return [...map.entries()]
}

export default function SlotPicker({
  providerUid,
  selectedId,
  onSelect,
  refreshKey = 0,
  required = false,
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
        if (selectedId && !data.free.some((s) => s.id === selectedId)) {
          onSelect('')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([])
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

  const days = useMemo(() => groupByDay(slots), [slots])
  const freeCount = slots.filter((s) => s.status === 'open').length
  const busyCount = slots.filter((s) => s.status === 'held' || s.status === 'booked').length

  if (loading) {
    return <p className="muted">Duke ngarkuar oraret...</p>
  }

  if (error) {
    return <p className="error">{error}</p>
  }

  if (slots.length === 0) {
    return (
      <p className="muted">
        Ofruesi nuk ka publikuar orare ende. Mund të dërgosh kërkesë pa termin.
      </p>
    )
  }

  return (
    <div className="slot-picker">
      <div className="slot-picker-legend">
        <span className="slot-legend-free">I lirë ({freeCount})</span>
        <span className="slot-legend-busy">I zënë ({busyCount})</span>
      </div>

      {days.map(([day, daySlots]) => (
        <div key={day} className="slot-day">
          <p className="slot-day-label">{day}</p>
          <div className="slot-time-grid" role="list">
            {daySlots.map((slot) => {
              const time = formatSlotTime(slot.startAt)
              const isFree = slot.status === 'open'
              const isSelected = selectedId === slot.id
              return (
                <button
                  key={slot.id}
                  type="button"
                  role="listitem"
                  className={`slot-time-btn${isFree ? ' is-free' : ' is-busy'}${
                    isSelected ? ' is-selected' : ''
                  }`}
                  disabled={!isFree}
                  title={
                    isFree
                      ? `Rezervo ${time}`
                      : `${time} është i zënë — nuk mund të rezervosh`
                  }
                  onClick={() => onSelect(isSelected ? '' : slot.id)}
                >
                  <strong>{time}</strong>
                  <span>{isFree ? 'I lirë' : 'I zënë'}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {required && freeCount > 0 && !selectedId ? (
        <p className="muted slot-hint">Zgjidh një orë të lirë për të vazhduar.</p>
      ) : null}
      {selectedId ? (
        <p className="success slot-hint">
          Termini i zgjedhur: {formatSlotDay(
            slots.find((s) => s.id === selectedId)?.startAt || '',
          )}{' '}
          · {formatSlotTime(slots.find((s) => s.id === selectedId)?.startAt || '')}
        </p>
      ) : null}
    </div>
  )
}
