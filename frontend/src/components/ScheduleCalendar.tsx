import { useEffect, useMemo, useState } from 'react'
import { Button, Calendar, Chip } from '@heroui/react'
import { CalendarDate, getLocalTimeZone, today, type DateValue } from '@internationalized/date'
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

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

function fromParts(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`
}

function toCalendarDate(value: Date) {
  return new CalendarDate(value.getFullYear(), value.getMonth() + 1, value.getDate())
}

function fromDateValue(value: DateValue) {
  return new CalendarDate(value.year, value.month, value.day)
}

function slotDateKey(startAt: string) {
  return dateKey(new Date(startAt))
}

function isFree(slot: AvailabilitySlot) {
  return slot.status === 'open' && new Date(slot.startAt).getTime() > Date.now()
}

function isBusy(slot: AvailabilitySlot) {
  return slot.status === 'held' || slot.status === 'booked'
}

function dayLabel(date: CalendarDate) {
  return date.toDate(getLocalTimeZone()).toLocaleDateString('sq-AL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default function ScheduleCalendar({
  slots,
  selectedId = '',
  onSelect,
  selectable = false,
  required = false,
}: Props) {
  const tz = getLocalTimeZone()
  const now = today(tz)

  const byDay = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>()
    for (const slot of slots) {
      const key = slotDateKey(slot.startAt)
      const list = map.get(key)
      if (list) list.push(slot)
      else map.set(key, [slot])
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    }
    return map
  }, [slots])

  const freeDays = useMemo(() => {
    const set = new Set<string>()
    for (const [key, list] of byDay) {
      if (list.some(isFree)) set.add(key)
    }
    return set
  }, [byDay])

  const busyDays = useMemo(() => {
    const set = new Set<string>()
    for (const [key, list] of byDay) {
      if (list.some(isBusy)) set.add(key)
    }
    return set
  }, [byDay])

  const range = useMemo(() => {
    let min: CalendarDate | null = null
    let max: CalendarDate | null = null
    for (const slot of slots) {
      const date = toCalendarDate(new Date(slot.startAt))
      if (!min || date.compare(min) < 0) min = date
      if (!max || date.compare(max) > 0) max = date
    }
    return { min, max }
  }, [slots])

  const selected = slots.find((slot) => slot.id === selectedId)

  const [pickedDate, setPickedDate] = useState<CalendarDate | null>(() => {
    if (selected) return toCalendarDate(new Date(selected.startAt))
    const firstFree = slots.find(isFree)
    if (firstFree) return toCalendarDate(new Date(firstFree.startAt))
    if (range.min) return range.min
    return now
  })

  const [focusedDate, setFocusedDate] = useState<DateValue>(pickedDate ?? now)

  useEffect(() => {
    if (!selected) return
    const next = toCalendarDate(new Date(selected.startAt))
    setPickedDate(next)
    setFocusedDate(next)
  }, [selectedId])

  const pickedKey = pickedDate ? fromParts(pickedDate.year, pickedDate.month, pickedDate.day) : ''
  const daySlots = pickedKey ? (byDay.get(pickedKey) ?? []) : []

  const freeCount = slots.filter(isFree).length
  const busyCount = slots.filter(isBusy).length

  const minValue = required ? now : range.min ?? now
  const maxValue = range.max && range.max.compare(minValue) >= 0 ? range.max : minValue

  function pick(slot: AvailabilitySlot) {
    if (!selectable || !onSelect || !isFree(slot)) return
    onSelect(required ? slot.id : selectedId === slot.id ? '' : slot.id)
  }

  function onDateChange(next: DateValue | null) {
    if (!next) return
    const date = fromDateValue(next)
    setPickedDate(date)
    setFocusedDate(date)
    if (selected && slotDateKey(selected.startAt) !== fromParts(date.year, date.month, date.day)) {
      onSelect?.('')
    }
  }

  if (!slots.length) return null

  return (
    <div className="schedule-cal">
      <div className="schedule-cal-legend">
        <Chip size="sm" variant="soft" color="success">
          <Chip.Label>I lirë ({freeCount})</Chip.Label>
        </Chip>
        <Chip size="sm" variant="soft" color="danger">
          <Chip.Label>I zënë ({busyCount})</Chip.Label>
        </Chip>
      </div>

      <Calendar
        aria-label="Kalendari i termineve"
        className="schedule-cal-month"
        firstDayOfWeek="mon"
        weeksInMonth={6}
        minValue={minValue}
        maxValue={maxValue}
        value={pickedDate}
        focusedValue={focusedDate}
        onFocusChange={setFocusedDate}
        onChange={onDateChange}
        isDateUnavailable={(date) => !byDay.has(fromParts(date.year, date.month, date.day))}
      >
        <Calendar.Header>
          <Calendar.Heading />
          <Calendar.NavButton slot="previous" />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid weekdayStyle="short">
          <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
          <Calendar.GridBody>
            {(date) => {
              const key = fromParts(date.year, date.month, date.day)
              const hasFree = freeDays.has(key)
              const hasBusy = busyDays.has(key)
              return (
                <Calendar.Cell date={date}>
                  {({ formattedDate, isUnavailable }) => (
                    <>
                      {formattedDate}
                      {!isUnavailable && (hasFree || hasBusy) ? (
                        <Calendar.CellIndicator className={hasFree ? 'bg-success' : 'bg-danger'} />
                      ) : null}
                    </>
                  )}
                </Calendar.Cell>
              )
            }}
          </Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>

      <div className="schedule-cal-times">
        <p className="schedule-cal-times-label">
          {pickedDate ? `Orët · ${dayLabel(pickedDate)}` : 'Zgjidh një ditë'}
        </p>
        {daySlots.length === 0 ? (
          <p className="muted">Nuk ka termine këtë ditë.</p>
        ) : (
          <div className="schedule-cal-slot-grid">
            {daySlots.map((slot) => {
              const free = isFree(slot)
              const busy = isBusy(slot)
              const selectedCell = selectedId === slot.id
              return (
                <Button
                  key={slot.id}
                  type="button"
                  size="sm"
                  fullWidth
                  variant={selectedCell ? 'primary' : free ? 'outline' : 'ghost'}
                  isDisabled={!selectable || !free}
                  className={`schedule-cal-slot${free ? ' is-free' : ''}${busy ? ' is-busy' : ''}${
                    !free && !busy ? ' is-past' : ''
                  }${selectedCell ? ' is-selected' : ''}`}
                  onPress={() => pick(slot)}
                >
                  <span>{formatSlotTime(slot.startAt)}</span>
                  <small>{busy ? 'Zënë' : free ? 'Lirë' : 'Kaluar'}</small>
                </Button>
              )
            })}
          </div>
        )}
      </div>

      {selectable && required && freeCount > 0 && !selectedId ? (
        <p className="muted slot-hint">Zgjidh ditën, pastaj një orë të lirë.</p>
      ) : null}
      {selected ? (
        <p className="success slot-hint">
          Termini i zgjedhur: {formatSlotDay(selected.startAt)} · {formatSlotTime(selected.startAt)}
        </p>
      ) : null}
    </div>
  )
}
