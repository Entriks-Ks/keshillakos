import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Alert, Button, Card, Chip, Input, Label, TextField, toast } from '@heroui/react'
import { CalendarPlus, ChevronDown, Trash2 } from 'lucide-react'
import {
  createAvailabilitySlot,
  createAvailabilitySlotsBulk,
  deleteAvailabilitySlot,
  fetchMyAvailability,
  formatSlotTime,
  type AvailabilitySlot,
} from '../api/availability'
import ScheduleCalendar from '../components/ScheduleCalendar'
import ConfirmActionDialog from '../components/ConfirmActionDialog'
import { getErrorMessage } from '../utils/errors'
import { EmptyBlock, RowsSkeleton, SectionHead } from './OverviewParts'
import './DashboardSections.css'

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => {
  const hour = i + 8 // 08:00 – 20:00
  return `${String(hour).padStart(2, '0')}:00`
})

const WEEKDAYS = [
  { id: 1, label: 'E hënë', short: 'Hën' },
  { id: 2, label: 'E martë', short: 'Mar' },
  { id: 3, label: 'E mërkurë', short: 'Mër' },
  { id: 4, label: 'E enjte', short: 'Enj' },
  { id: 5, label: 'E premte', short: 'Pre' },
  { id: 6, label: 'E shtunë', short: 'Sht' },
  { id: 0, label: 'E diel', short: 'Die' },
] as const

type ErrorSource = 'load' | 'weekly' | 'extra'

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
  const [errorSource, setErrorSource] = useState<ErrorSource>('weekly')
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
  const [deleteTarget, setDeleteTarget] = useState<AvailabilitySlot | null>(null)

  function fail(source: ErrorSource, message: string) {
    setErrorSource(source)
    setError(message)
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      setSlots(await fetchMyAvailability())
    } catch (err) {
      fail('load', getErrorMessage(err))
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
    if (days.length === 0) {
      fail('weekly', 'Zgjidh të paktën një ditë.')
      return
    }
    const generated = weeklySlots(days, fromHour, toHour, weeks)
    if (generated.length > 400) {
      fail('weekly', 'Intervali është shumë i madh. Zgjidh më pak javë ose orë.')
      return
    }
    if (!generated.length) {
      fail('weekly', 'Nuk ka orë të vlefshme në këtë interval. Zgjidh orë në të ardhmen.')
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
        toast.success(`U publikuan ${result.created.length} orë të lira. ${result.skipped} ekzistonin tashmë.`)
      } else if (result.created.length) {
        toast.success(`U publikuan ${result.created.length} orë të lira.`)
      } else {
        fail('weekly', 'Këto orë ekzistojnë tashmë. Ndrysho ditët ose orët.')
      }
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function onExtraSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (selectedHours.length === 0) {
      fail('extra', 'Zgjidh të paktën një orë të lirë')
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
        toast.success(
          created.length === 1
            ? `U shtua ora ${formatSlotTime(created[0].startAt)} si e lirë.`
            : `U shtuan ${created.length} orë të lira.`,
        )
      }
      if (failures.length > 0) {
        fail('extra', failures.join(' · '))
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete() {
    const id = deleteTarget?.id
    if (!id || busyId) return
    setBusyId(id)
    setError('')
    try {
      await deleteAvailabilitySlot(id)
      setSlots((prev) => prev.filter((s) => s.id !== id))
      setSelectedSlotId('')
      toast.success('Orari u fshi.')
      setDeleteTarget(null)
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const freeSlots = slots.filter((s) => s.status === 'open')
  const busySlots = slots.filter((s) => s.status === 'held' || s.status === 'booked')
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId)
  const weeklyError = error && errorSource === 'weekly' ? error : ''
  const extraError = error && errorSource === 'extra' ? error : ''
  const loadError = error && errorSource === 'load' ? error : ''

  return (
    <section className="uo ds">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>Disponueshmëria</h1>
          <p>
            Vendos orët kur je i lirë për takime, p.sh. e hënë–e premte 09:00–17:00. Klienti zgjedh një nga këto orë kur
            dërgon kërkesë.
          </p>
        </div>
      </header>

      {loadError ? (
        <Alert status="danger" className="uo-alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Orari nuk u ngarkua</Alert.Title>
            <Alert.Description>{loadError}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="outline" onPress={() => void load()}>
            Provo përsëri
          </Button>
        </Alert>
      ) : null}

      <div className="ds-av-grid">
        <Card className="uo-card">
          <SectionHead title="Orari javor" meta={<span className="uo-card-meta">Orë 1-orëshe</span>} />
          <Card.Content className="uo-card-body">
            <form onSubmit={onWeeklySubmit} className="ds-form">
              <fieldset className="ds-field">
                <legend className="ds-label">Ditët e punës</legend>
                <div className="ds-day-grid">
                  {WEEKDAYS.map((day) => {
                    const selected = days.includes(day.id)
                    return (
                      <button
                        key={day.id}
                        type="button"
                        className={`ds-day${selected ? ' is-selected' : ''}`}
                        onClick={() => toggleDay(day.id)}
                        aria-pressed={selected}
                        aria-label={day.label}
                      >
                        {day.short}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="ds-field-row">
                <label className="ds-field">
                  <span className="ds-label">Nga ora</span>
                  <span className="ds-select">
                    <select value={fromHour} onChange={(e) => setFromHour(e.target.value)}>
                      {HOUR_OPTIONS.slice(0, -1).map((hour) => (
                        <option key={hour} value={hour}>
                          {hour}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} aria-hidden />
                  </span>
                </label>
                <label className="ds-field">
                  <span className="ds-label">Deri ora</span>
                  <span className="ds-select">
                    <select value={toHour} onChange={(e) => setToHour(e.target.value)}>
                      {HOUR_OPTIONS.slice(1).map((hour) => (
                        <option key={hour} value={hour}>
                          {hour}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} aria-hidden />
                  </span>
                </label>
                <label className="ds-field">
                  <span className="ds-label">Sa javë përpara</span>
                  <span className="ds-select">
                    <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                      {[1, 2, 3, 4, 6, 8].map((count) => (
                        <option key={count} value={count}>
                          {count} javë
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} aria-hidden />
                  </span>
                </label>
              </div>

              <TextField fullWidth value={note} onChange={setNote} isDisabled={submitting}>
                <Label>Shënim (opsionale)</Label>
                <Input placeholder="p.sh. Online / Zyrë / Telefon" maxLength={200} />
              </TextField>

              <p className={`ds-hint${previewCount > 400 ? ' is-danger' : ''}`}>
                {previewCount > 400
                  ? 'Intervali është shumë i madh. Zgjidh më pak javë ose orë.'
                  : previewCount
                    ? `Do të publikohen deri ${previewCount} orë të lira (1 orë secila).`
                    : 'Zgjidh ditët dhe një interval orësh në të ardhmen.'}
              </p>
              {weeklyError ? <p className="ds-error">{weeklyError}</p> : null}

              <div className="ds-actions">
                <Button
                  type="submit"
                  variant="primary"
                  isPending={submitting}
                  isDisabled={previewCount === 0 || previewCount > 400}
                >
                  {submitting ? 'Duke publikuar…' : 'Publiko orarin javor'}
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>

        <Card className="uo-card">
          <SectionHead
            title="Orë shtesë për një datë"
            action={
              <Button size="sm" variant="ghost" onPress={() => setExtraOpen((open) => !open)} aria-expanded={extraOpen}>
                {extraOpen ? 'Mbyll' : 'Hap'}
                <ChevronDown size={14} aria-hidden className={`ds-chevron${extraOpen ? ' is-open' : ''}`} />
              </Button>
            }
          />
          <Card.Content className="uo-card-body">
            {extraOpen ? (
              <form onSubmit={onExtraSubmit} className="ds-form">
                <label className="ds-field ds-field-date">
                  <span className="ds-label">Data</span>
                  <input
                    type="date"
                    className="ds-input"
                    value={date}
                    min={todayInputDate()}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </label>
                <fieldset className="ds-field">
                  <legend className="ds-label">Zgjidh orët e lira për këtë ditë</legend>
                  <div className="ds-hour-grid">
                    {HOUR_OPTIONS.slice(0, -1).map((hour) => {
                      const taken = takenHoursOnDate.has(hour)
                      const selected = selectedHours.includes(hour)
                      return (
                        <button
                          key={hour}
                          type="button"
                          className={`ds-hour${taken ? ' is-taken' : ''}${selected ? ' is-selected' : ''}`}
                          disabled={taken}
                          onClick={() => toggleHour(hour)}
                          aria-pressed={selected}
                          title={taken ? `${hour} ekziston tashmë` : `Shto ${hour}`}
                        >
                          {hour}
                          <small>{taken ? 'Ekziston' : selected ? 'Zgjedhur' : 'Shto'}</small>
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
                {extraError ? <p className="ds-error">{extraError}</p> : null}
                <div className="ds-actions">
                  <Button type="submit" variant="primary" isPending={submitting} isDisabled={selectedHours.length === 0}>
                    {submitting
                      ? 'Duke shtuar…'
                      : selectedHours.length
                        ? `Publiko ${selectedHours.length} orë të lira`
                        : 'Zgjidh orë'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="ds-collapsed">
                <span className="ds-collapsed-icon" aria-hidden>
                  <CalendarPlus size={18} />
                </span>
                <p>
                  Shto orë të veçanta jashtë orarit javor, p.sh. një të shtunë ose një ditë me orar të ndryshëm.
                </p>
              </div>
            )}
          </Card.Content>
        </Card>
      </div>

      <Card className="uo-card">
        <SectionHead
          title="Kalendari"
          meta={
            slots.length > 0 ? (
              <span className="ds-cal-counts">
                <Chip size="sm" variant="soft" color="success">
                  {freeSlots.length} të lira
                </Chip>
                <Chip size="sm" variant="soft" color="danger">
                  {busySlots.length} të zëna
                </Chip>
              </span>
            ) : null
          }
        />
        <Card.Content className="uo-card-body">
          {loading ? (
            <RowsSkeleton rows={3} />
          ) : slots.length === 0 ? (
            <EmptyBlock
              title="Ende nuk ke shtuar asnjë orë"
              text="Publiko orarin javor që klientët të mund të zgjedhin një orë kur dërgojnë kërkesë."
            />
          ) : (
            <div className="ds-cal">
              <p className="ds-hint">Zgjidh ditën, pastaj një orë të lirë për ta fshirë. Pikat e gjelbra kanë orë të lira.</p>
              <ScheduleCalendar slots={slots} selectedId={selectedSlotId} onSelect={setSelectedSlotId} selectable />
              <div className="ds-cal-foot">
                {selectedSlot && selectedSlot.status === 'open' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ds-danger-btn"
                    isPending={busyId === selectedSlot.id}
                    onPress={() => setDeleteTarget(selectedSlot)}
                  >
                    <Trash2 size={14} aria-hidden />
                    {busyId === selectedSlot.id ? 'Duke fshirë…' : `Fshi ${formatSlotTime(selectedSlot.startAt)}`}
                  </Button>
                ) : selectedSlot ? (
                  <p className="ds-hint">Kjo orë është e zënë dhe nuk mund të fshihet.</p>
                ) : (
                  <p className="ds-hint">Zgjidh një orë të gjelbër për ta fshirë.</p>
                )}
              </div>
            </div>
          )}
        </Card.Content>
      </Card>
      <ConfirmActionDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => void onDelete()} pending={Boolean(busyId)} title="Fshi orën e lirë?" description={`Ora ${deleteTarget ? formatSlotTime(deleteTarget.startAt) : ''} do të hiqet nga disponueshmëria. Ky veprim nuk mund të zhbëhet.`} confirmLabel="Fshi" />
    </section>
  )
}
