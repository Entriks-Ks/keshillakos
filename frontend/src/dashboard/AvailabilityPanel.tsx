import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createAvailabilitySlot,
  createAvailabilitySlotsBulk,
  deleteAvailabilitySlot,
  fetchMyAvailability,
  formatSlotTime,
  type AvailabilitySlot,
} from '../api/availability'
import ScheduleCalendar from '../components/ScheduleCalendar'
import { getErrorMessage } from '../utils/errors'
import DashPageHeader from './DashPageHeader'

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => {
  const hour = i + 8 // 08:00 – 20:00
  return `${String(hour).padStart(2, '0')}:00`
})

const WEEKDAYS = [
  { id: 1, label: 'E hënë' },
  { id: 2, label: 'E martë' },
  { id: 3, label: 'E mërkurë' },
  { id: 4, label: 'E enjte' },
  { id: 5, label: 'E premte' },
  { id: 6, label: 'E shtunë' },
  { id: 0, label: 'E diel' },
] as const

function todayInputDate() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function buildSlotIso(date: string, hour: string) {
  const start = new Date(`${date}T${hour}:00`)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return { startAt: start.toISOString(), endAt: end.toISOString() }
}

function hoursInRange(from: string, to: string) {
  const start = HOUR_OPTIONS.indexOf(from)
  const end = HOUR_OPTIONS.indexOf(to)
  if (start < 0 || end < 0 || end <= start) return []
  return HOUR_OPTIONS.slice(start, end)
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toInputDate(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

function weeklySlots(days: number[], from: string, to: string, weeks: number) {
  const hours = hoursInRange(from, to)
  const slots: Array<{ startAt: string; endAt: string }> = []
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + weeks * 7)
  for (const cursor = new Date(start); cursor < end; cursor.setDate(cursor.getDate() + 1)) {
    if (!days.includes(cursor.getDay())) continue
    const date = toInputDate(cursor)
    for (const hour of hours) {
      const range = buildSlotIso(date, hour)
      if (new Date(range.startAt).getTime() <= Date.now()) continue
      slots.push(range)
    }
  }
  return slots
}

export default function AvailabilityPanel() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [fromHour, setFromHour] = useState('09:00')
  const [toHour, setToHour] = useState('17:00')
  const [weeks, setWeeks] = useState(2)
  const [note, setNote] = useState('')
  const [extraOpen, setExtraOpen] = useState(false)
  const [date, setDate] = useState(todayInputDate())
  const [selectedHours, setSelectedHours] = useState<string[]>([])
  const [selectedSlotId, setSelectedSlotId] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setSlots(await fetchMyAvailability())
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const previewCount = useMemo(
    () => weeklySlots(days, fromHour, toHour, weeks).length,
    [days, fromHour, toHour, weeks],
  )

  const takenHoursOnDate = useMemo(() => {
    const set = new Set<string>()
    for (const slot of slots) {
      if (slot.status === 'cancelled') continue
      const local = new Date(slot.startAt)
      const day = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`
      if (day !== date) continue
      set.add(`${pad(local.getHours())}:00`)
    }
    return set
  }, [slots, date])

  function toggleDay(id: number) {
    setDays((prev) => (prev.includes(id) ? prev.filter((day) => day !== id) : [...prev, id].sort()))
  }

  function toggleHour(hour: string) {
    if (takenHoursOnDate.has(hour)) return
    setSelectedHours((prev) =>
      prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour].sort(),
    )
  }

  async function onWeeklySubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (days.length === 0) {
      setError('Zgjidh të paktën një ditë.')
      return
    }
    const generated = weeklySlots(days, fromHour, toHour, weeks)
    if (generated.length > 400) {
      setError('Intervali është shumë i madh. Zgjidh më pak javë ose orë.')
      return
    }
    if (!generated.length) {
      setError('Nuk ka orë të vlefshme në këtë interval. Zgjidh orë në të ardhmen.')
      return
    }
    setSubmitting(true)
    try {
      const result = await createAvailabilitySlotsBulk({
        slots: generated,
        note: note.trim() || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      if (result.created.length) {
        setSlots((prev) =>
          [...prev, ...result.created].sort((a, b) => a.startAt.localeCompare(b.startAt)),
        )
      }
      if (result.created.length && result.skipped) {
        setSuccess(`U publikuan ${result.created.length} orë të lira. ${result.skipped} ekzistonin tashmë.`)
      } else if (result.created.length) {
        setSuccess(`U publikuan ${result.created.length} orë të lira.`)
      } else {
        setError('Këto orë ekzistojnë tashmë. Ndrysho ditët ose orët.')
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function onExtraSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (selectedHours.length === 0) {
      setError('Zgjidh të paktën një orë të lirë')
      return
    }

    setSubmitting(true)
    const created: AvailabilitySlot[] = []
    const failures: string[] = []

    try {
      for (const hour of selectedHours) {
        if (takenHoursOnDate.has(hour)) {
          failures.push(`${hour} është tashmë e zënë`)
          continue
        }
        try {
          const range = buildSlotIso(date, hour)
          const slot = await createAvailabilitySlot({
            ...range,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            note: note.trim() || undefined,
          })
          created.push(slot)
        } catch (err) {
          failures.push(`${hour}: ${getErrorMessage(err)}`)
        }
      }

      if (created.length > 0) {
        setSlots((prev) =>
          [...prev, ...created].sort((a, b) => a.startAt.localeCompare(b.startAt)),
        )
        setSelectedHours([])
        setSuccess(
          created.length === 1
            ? `U shtua ora ${formatSlotTime(created[0].startAt)} si e lirë.`
            : `U shtuan ${created.length} orë të lira.`,
        )
      }
      if (failures.length > 0) {
        setError(failures.join(' · '))
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete(id: string) {
    setBusyId(id)
    setError('')
    setSuccess('')
    try {
      await deleteAvailabilitySlot(id)
      setSlots((prev) => prev.filter((s) => s.id !== id))
      setSelectedSlotId('')
      setSuccess('Orari u fshi.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const freeSlots = slots.filter((s) => s.status === 'open')
  const busySlots = slots.filter((s) => s.status === 'held' || s.status === 'booked')
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId)

  return (
    <section className="provider-section">
      <DashPageHeader
        title="Disponueshmëria"
        description="Vendos orarin javor, p.sh. e hënë–e premte 09:00–17:00. Klienti duhet të zgjedhë një orë kur dërgon kërkesë."
      />

      <form onSubmit={onWeeklySubmit} className="service-form">
        <div className="full">
          <p className="provider-details-label">Ditët</p>
          <div className="weekday-grid">
            {WEEKDAYS.map((day) => {
              const selected = days.includes(day.id)
              return (
                <button
                  key={day.id}
                  type="button"
                  className={`weekday-chip${selected ? ' is-selected' : ''}`}
                  onClick={() => toggleDay(day.id)}
                  aria-pressed={selected}
                >
                  {day.label}
                </button>
              )
            })}
          </div>
        </div>

        <label>
          Nga ora
          <select value={fromHour} onChange={(e) => setFromHour(e.target.value)}>
            {HOUR_OPTIONS.slice(0, -1).map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </label>
        <label>
          Deri ora
          <select value={toHour} onChange={(e) => setToHour(e.target.value)}>
            {HOUR_OPTIONS.slice(1).map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sa javë përpara
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            {[1, 2, 3, 4, 6, 8].map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? 'javë' : 'javë'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Shënim (opsionale)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="p.sh. Online / Zyrë / Telefon"
          />
        </label>
        <p className="muted full">
        {previewCount > 400
          ? 'Intervali është shumë i madh. Zgjidh më pak javë ose orë.'
          : previewCount
            ? `Do të publikohen deri ${previewCount} orë të lira (1 orë secila).`
            : 'Zgjidh ditët dhe një interval orësh në të ardhmen.'}
        </p>
        {error ? <p className="error full">{error}</p> : null}
        {success ? <p className="success full">{success}</p> : null}
        <button type="submit" className="full" disabled={submitting || previewCount === 0 || previewCount > 400}>
          {submitting ? 'Duke publikuar...' : 'Publiko orarin javor'}
        </button>
      </form>

      <button
        type="button"
        className="ghost"
        onClick={() => setExtraOpen((open) => !open)}
      >
        {extraOpen ? 'Mbyll orë shtesë' : 'Shto orë shtesë për një datë'}
      </button>

      {extraOpen ? (
        <form onSubmit={onExtraSubmit} className="service-form">
          <label>
            Data
            <input
              type="date"
              value={date}
              min={todayInputDate()}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <div className="full">
            <p className="provider-details-label">Zgjidh orët e lira për këtë ditë</p>
            <div className="slot-time-grid">
              {HOUR_OPTIONS.slice(0, -1).map((hour) => {
                const taken = takenHoursOnDate.has(hour)
                const selected = selectedHours.includes(hour)
                return (
                  <button
                    key={hour}
                    type="button"
                    className={`slot-time-btn${taken ? ' is-busy' : ' is-free'}${
                      selected ? ' is-selected' : ''
                    }`}
                    disabled={taken}
                    onClick={() => toggleHour(hour)}
                    title={taken ? `${hour} ekziston tashmë` : `Shto ${hour}`}
                  >
                    <strong>{hour}</strong>
                    <span>{taken ? 'Ekziston' : selected ? 'Zgjedhur' : 'Shto'}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <button type="submit" className="full" disabled={submitting || selectedHours.length === 0}>
            {submitting
              ? 'Duke shtuar...'
              : selectedHours.length
                ? `Publiko ${selectedHours.length} orë të lira`
                : 'Zgjidh orë'}
          </button>
        </form>
      ) : null}

      <div className="services-list">
        <h3>
          Kalendari · {freeSlots.length} të lira · {busySlots.length} të zëna
        </h3>
        {loading ? <p className="muted">Duke u ngarkuar...</p> : null}
        {!loading && slots.length === 0 ? (
          <p className="muted">Ende nuk ke shtuar asnjë orë. Publiko orarin javor që klientët të mund të dërgojnë kërkesë.</p>
        ) : null}
        {slots.length > 0 ? (
          <>
            <p className="muted">Zgjidh ditën, pastaj një orë të lirë për ta fshirë. Pikat e gjelbra kanë orë të lira.</p>
            <ScheduleCalendar
              slots={slots}
              selectedId={selectedSlotId}
              onSelect={setSelectedSlotId}
              selectable
            />
            {selectedSlot && selectedSlot.status === 'open' ? (
              <button
                type="button"
                className="ghost danger-ghost"
                disabled={busyId === selectedSlot.id}
                onClick={() => void onDelete(selectedSlot.id)}
              >
                {busyId === selectedSlot.id ? 'Duke fshirë...' : `Fshi ${formatSlotTime(selectedSlot.startAt)}`}
              </button>
            ) : selectedSlot ? (
              <p className="muted">Kjo orë është e zënë dhe nuk mund të fshihet.</p>
            ) : (
              <p className="muted">Zgjidh një orë të gjelbër për ta fshirë.</p>
            )}
          </>
        ) : null}
      </div>
    </section>
  )
}
