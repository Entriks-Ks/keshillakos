import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  fetchMyAvailability,
  formatSlotDay,
  formatSlotTime,
  type AvailabilitySlot,
  type SlotStatus,
} from '../api/availability'
import { getErrorMessage } from '../utils/errors'

const STATUS_LABELS: Record<SlotStatus, string> = {
  open: 'I lirë',
  held: 'I zënë (në pritje)',
  booked: 'I zënë (i konfirmuar)',
  cancelled: 'Anuluar',
}

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const hour = i + 8 // 08:00 – 19:00
  return `${String(hour).padStart(2, '0')}:00`
})

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

export default function AvailabilityPanel() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [date, setDate] = useState(todayInputDate())
  const [selectedHours, setSelectedHours] = useState<string[]>(['14:00', '15:00'])
  const [note, setNote] = useState('')

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

  const takenHoursOnDate = useMemo(() => {
    const set = new Set<string>()
    for (const slot of slots) {
      if (slot.status === 'cancelled') continue
      const local = new Date(slot.startAt)
      const pad = (n: number) => String(n).padStart(2, '0')
      const day = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`
      if (day !== date) continue
      set.add(`${pad(local.getHours())}:00`)
    }
    return set
  }, [slots, date])

  function toggleHour(hour: string) {
    if (takenHoursOnDate.has(hour)) return
    setSelectedHours((prev) =>
      prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour].sort(),
    )
  }

  async function onSubmit(e: FormEvent) {
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
      setSuccess('Orari u fshi.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const freeSlots = slots.filter((s) => s.status === 'open')
  const busySlots = slots.filter((s) => s.status === 'held' || s.status === 'booked')

  return (
    <section className="provider-section">
      <h2>Disponueshmëria</h2>
      <p className="muted">
        Shto orë konkrete (p.sh. 14:00, 15:00). Kërkesa e klientit e mban orën përkohësisht;
        pranimi nga ofruesi e konfirmon rezervimin.
      </p>

      <form onSubmit={onSubmit} className="service-form">
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
        <label className="full">
          Shënim (opsionale)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="p.sh. Online / Zyrë / Telefon"
          />
        </label>

        <div className="full">
          <p className="provider-details-label">Zgjidh orët e lira për këtë ditë</p>
          <div className="slot-time-grid">
            {HOUR_OPTIONS.map((hour) => {
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

        {error ? <p className="error full">{error}</p> : null}
        {success ? <p className="success full">{success}</p> : null}
        <button type="submit" className="full" disabled={submitting || selectedHours.length === 0}>
          {submitting
            ? 'Duke shtuar...'
            : selectedHours.length
              ? `Publiko ${selectedHours.length} orë të lira`
              : 'Zgjidh orë'}
        </button>
      </form>

      <div className="services-list">
        <h3>
          Oraret · {freeSlots.length} të lira · {busySlots.length} të zëna
        </h3>
        {loading ? <p className="muted">Duke u ngarkuar...</p> : null}
        {!loading && slots.length === 0 ? (
          <p className="muted">Ende nuk ke shtuar asnjë orë.</p>
        ) : null}
        <ul className="availability-list">
          {slots.map((slot) => (
            <li key={slot.id}>
              <div className="request-list-head">
                <strong>
                  {formatSlotDay(slot.startAt)} · {formatSlotTime(slot.startAt)}
                </strong>
                <span className={`status-pill status-slot-${slot.status}`}>
                  {STATUS_LABELS[slot.status]}
                </span>
              </div>
              {slot.note ? <p className="muted">{slot.note}</p> : null}
              {slot.status === 'open' ? (
                <button
                  type="button"
                  className="ghost danger-ghost"
                  disabled={busyId === slot.id}
                  onClick={() => void onDelete(slot.id)}
                >
                  Fshi
                </button>
              ) : (
                <p className="muted">Kjo orë është e zënë dhe nuk mund të fshihet.</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
