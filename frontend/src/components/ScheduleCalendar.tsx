import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  formatSlotDay,
  formatSlotTime,
  type AvailabilitySlot,
} from '../api/availability'

type Props = {
  slots: AvailabilitySlot[]
  selectedId?: string
  onSelect?: (slotId: string) => void
  selectable?: boolean
  required?: boolean
}

const DAY_LABELS = ['E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë', 'E diel']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function startOfDay(value: Date) {
  const next = new Date(value)
  next.setHours(0, 0, 0, 0)
  return next
}

function startOfWeek(value: Date) {
  const next = startOfDay(value)
  const day = next.getDay()
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day))
  return next
}

function addDays(value: Date, amount: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + amount)
  return next
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

function slotDateKey(startAt: string) {
  return dateKey(new Date(startAt))
}

function slotHourKey(startAt: string) {
  const value = new Date(startAt)
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`
}

function isFree(slot: AvailabilitySlot) {
  return slot.status === 'open' && new Date(slot.startAt).getTime() > Date.now()
}

function isBusy(slot: AvailabilitySlot) {
  return slot.status === 'held' || slot.status === 'booked'
}

function weekLabel(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6)
  const from = weekStart.toLocaleDateString('sq-AL', { day: 'numeric', month: 'short' })
  const to = weekEnd.toLocaleDateString('sq-AL', { day: 'numeric', month: 'short' })
  return `${from} – ${to}`
}

export default function ScheduleCalendar({
  slots,
  selectedId = '',
  onSelect,
  selectable = false,
  required = false,
}: Props) {
  const weeks = useMemo(() => {
    const starts = new Set<number>()
    for (const slot of slots) {
      starts.add(startOfWeek(new Date(slot.startAt)).getTime())
    }
    if (!starts.size) starts.add(startOfWeek(new Date()).getTime())
    return [...starts].sort((a, b) => a - b).map((time) => new Date(time))
  }, [slots])

  const [weekIndex, setWeekIndex] = useState(() => {
    const todayWeek = startOfWeek(new Date()).getTime()
    const index = weeks.findIndex((week) => week.getTime() === todayWeek)
    return index >= 0 ? index : 0
  })

  const safeIndex = Math.min(weekIndex, weeks.length - 1)
  const weekStart = weeks[safeIndex] || startOfWeek(new Date())
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const todayKey = dateKey(new Date())

  const weekSlots = useMemo(
    () => slots.filter((slot) => startOfWeek(new Date(slot.startAt)).getTime() === weekStart.getTime()),
    [slots, weekStart],
  )

  const hours = useMemo(() => {
    const unique = new Set(weekSlots.map((slot) => slotHourKey(slot.startAt)))
    return [...unique].sort()
  }, [weekSlots])

  const byDayHour = useMemo(() => {
    const map = new Map<string, AvailabilitySlot>()
    for (const slot of weekSlots) {
      map.set(`${slotDateKey(slot.startAt)}|${slotHourKey(slot.startAt)}`, slot)
    }
    return map
  }, [weekSlots])

  const freeCount = slots.filter(isFree).length
  const busyCount = slots.filter(isBusy).length
  const selected = slots.find((slot) => slot.id === selectedId)

  function pick(slot: AvailabilitySlot) {
    if (!selectable || !onSelect || !isFree(slot)) return
    onSelect(required ? slot.id : selectedId === slot.id ? '' : slot.id)
  }

  if (!slots.length) return null

  return (
    <div className="cal-week">
      <div className="cal-week-toolbar">
        <button
          type="button"
          className="ghost cal-week-nav"
          disabled={safeIndex <= 0}
          onClick={() => setWeekIndex((index) => Math.max(0, index - 1))}
          aria-label="Java e kaluar"
        >
          <ChevronLeft size={18} />
        </button>
        <strong>{weekLabel(weekStart)}</strong>
        <button
          type="button"
          className="ghost cal-week-nav"
          disabled={safeIndex >= weeks.length - 1}
          onClick={() => setWeekIndex((index) => Math.min(weeks.length - 1, index + 1))}
          aria-label="Java tjetër"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="cal-week-legend">
        <span className="cal-legend-free">I lirë ({freeCount})</span>
        <span className="cal-legend-busy">I zënë ({busyCount})</span>
      </div>

      <div className="cal-week-scroll">
        <div className="cal-grid" role="grid" aria-label="Kalendari i termineve">
          <div className="cal-hour-gutter" aria-hidden />
          {days.map((day) => {
            const key = dateKey(day)
            return (
              <div
                key={key}
                className={`cal-day-head${key === todayKey ? ' is-today' : ''}`}
              >
                <span>{DAY_LABELS[(day.getDay() + 6) % 7]}</span>
                <strong>{day.getDate()}</strong>
              </div>
            )
          })}

          {hours.length === 0 ? (
            <p className="muted cal-empty">Nuk ka termine këtë javë.</p>
          ) : (
            hours.flatMap((hour) => [
              <div key={`h-${hour}`} className="cal-hour-label">
                {hour}
              </div>,
              ...days.map((day) => {
                const key = dateKey(day)
                const slot = byDayHour.get(`${key}|${hour}`)
                if (!slot) {
                  return <div key={`${key}|${hour}`} className="cal-cell is-empty" />
                }
                const free = isFree(slot)
                const busy = isBusy(slot)
                const selectedCell = selectedId === slot.id
                const label = `${DAY_LABELS[(day.getDay() + 6) % 7]} ${hour}`
                return (
                  <button
                    key={slot.id}
                    type="button"
                    className={`cal-cell${free ? ' is-free' : ''}${busy ? ' is-busy' : ''}${
                      !free && !busy ? ' is-past' : ''
                    }${selectedCell ? ' is-selected' : ''}`}
                    disabled={!selectable || !free}
                    title={busy ? `${label} është i zënë` : free ? `${label} është i lirë` : `${label} ka kaluar`}
                    onClick={() => pick(slot)}
                  >
                    <strong>{formatSlotTime(slot.startAt)}</strong>
                    <span>{busy ? 'Zënë' : free ? 'Lirë' : 'Kaluar'}</span>
                  </button>
                )
              }),
            ])
          )}
        </div>
      </div>

      {selectable && required && freeCount > 0 && !selectedId ? (
        <p className="muted slot-hint">Zgjidh një orë të gjelbër. Të kuqat janë të zëna.</p>
      ) : null}
      {selected ? (
        <p className="success slot-hint">
          Termini i zgjedhur: {formatSlotDay(selected.startAt)} · {formatSlotTime(selected.startAt)}
        </p>
      ) : null}
    </div>
  )
}
