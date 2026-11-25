import { collectionSummary } from '../api/pagination'
import KeshillaPagination from '../components/KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Alert, Button, Card, Chip, Input, Label, TextField, toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
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
  { id: 1, key: 'mon' },
  { id: 2, key: 'tue' },
  { id: 3, key: 'wed' },
  { id: 4, key: 'thu' },
  { id: 5, key: 'fri' },
  { id: 6, key: 'sat' },
  { id: 0, key: 'sun' },
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
  const { t } = useTranslation()
  const { page, setPage, pagination, receivePagination } = usePagination()
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

  const loadVersion = useRef(0)
  async function load() {
    const version = ++loadVersion.current
    setLoading(true)
    setError('')
    try {
      const result = await fetchMyAvailability({ page, limit: 50 }); if (version !== loadVersion.current) return; setSlots(result); receivePagination(result.pagination)
    } catch (err) {
      if (version === loadVersion.current) fail('load', getErrorMessage(err))
    } finally {
      if (version === loadVersion.current) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [page])

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
      fail('weekly', t('availability.pickDay'))
      return
    }
    const generated = weeklySlots(days, fromHour, toHour, weeks)
    if (generated.length > 400) {
      fail('weekly', t('availability.rangeTooLarge'))
      return
    }
    if (!generated.length) {
      fail('weekly', t('availability.noValidHours'))
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
        toast.success(t('availability.publishedSkipped', { count: result.created.length, skipped: result.skipped }))
      } else if (result.created.length) {
        toast.success(t('availability.published', { count: result.created.length }))
      } else {
        fail('weekly', t('availability.alreadyExist'))
      }
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSubmitting(false)
      await load()
    }
  }

  async function onExtraSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (selectedHours.length === 0) {
      fail('extra', t('availability.pickHour'))
      return
    }

    setSubmitting(true)
    const created: AvailabilitySlot[] = []
    const failures: string[] = []

    try {
      for (const hour of selectedHours) {
        if (takenHoursOnDate.has(hour)) {
          failures.push(t('availability.hourTaken', { hour }))
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
            ? t('availability.addedOne', { time: formatSlotTime(created[0].startAt) })
            : t('availability.addedMany', { count: created.length }),
        )
      }
      if (failures.length > 0) {
        fail('extra', failures.join(' · '))
      }
    } finally {
      setSubmitting(false)
      await load()
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
      toast.success(t('availability.deleted'))
      setDeleteTarget(null)
      await load()
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const slotSummary = collectionSummary(slots)
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId)
  const weeklyError = error && errorSource === 'weekly' ? error : ''
  const extraError = error && errorSource === 'extra' ? error : ''
  const loadError = error && errorSource === 'load' ? error : ''

  return (
    <section className="uo ds">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>{t('dash.availability')}</h1>
          <p>{t('availability.lead')}</p>
        </div>
      </header>

      {loadError ? (
        <Alert status="danger" className="uo-alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('availability.loadError')}</Alert.Title>
            <Alert.Description>{loadError}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="outline" onPress={() => void load()}>
            {t('page.retry')}
          </Button>
        </Alert>
      ) : null}

      <div className="ds-av-grid">
        <Card className="uo-card">
          <SectionHead title={t('availability.weeklyTitle')} meta={<span className="uo-card-meta">{t('availability.slotLength')}</span>} />
          <Card.Content className="uo-card-body">
            <form onSubmit={onWeeklySubmit} className="ds-form">
              <fieldset className="ds-field">
                <legend className="ds-label">{t('availability.workDays')}</legend>
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
                        aria-label={t(`availability.weekdays.${day.key}`)}
                      >
                        {t(`availability.weekdaysShort.${day.key}`)}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="ds-field-row">
                <label className="ds-field">
                  <span className="ds-label">{t('availability.fromHour')}</span>
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
                  <span className="ds-label">{t('availability.toHour')}</span>
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
                  <span className="ds-label">{t('availability.weeksAhead')}</span>
                  <span className="ds-select">
                    <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                      {[1, 2, 3, 4, 6, 8].map((count) => (
                        <option key={count} value={count}>
                          {t('availability.weeks', { count })}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} aria-hidden />
                  </span>
                </label>
              </div>

              <TextField fullWidth value={note} onChange={setNote} isDisabled={submitting}>
                <Label>{t('availability.noteLabel')}</Label>
                <Input placeholder={t('availability.notePlaceholder')} maxLength={200} />
              </TextField>

              <p className={`ds-hint${previewCount > 400 ? ' is-danger' : ''}`}>
                {previewCount > 400
                  ? t('availability.rangeTooLarge')
                  : previewCount
                    ? t('availability.preview', { count: previewCount })
                    : t('availability.previewEmpty')}
              </p>
              {weeklyError ? <p className="ds-error">{weeklyError}</p> : null}

              <div className="ds-actions">
                <Button
                  type="submit"
                  variant="primary"
                  isPending={submitting}
                  isDisabled={previewCount === 0 || previewCount > 400}
                >
                  {submitting ? t('availability.publishing') : t('availability.publishWeekly')}
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>

        <Card className="uo-card">
          <SectionHead
            title={t('availability.extraTitle')}
            action={
              <Button size="sm" variant="ghost" onPress={() => setExtraOpen((open) => !open)} aria-expanded={extraOpen}>
                {extraOpen ? t('feedback.close') : t('availability.expand')}
                <ChevronDown size={14} aria-hidden className={`ds-chevron${extraOpen ? ' is-open' : ''}`} />
              </Button>
            }
          />
          <Card.Content className="uo-card-body">
            {extraOpen ? (
              <form onSubmit={onExtraSubmit} className="ds-form">
                <label className="ds-field ds-field-date">
                  <span className="ds-label">{t('availability.date')}</span>
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
                  <legend className="ds-label">{t('availability.pickHoursForDay')}</legend>
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
                          title={taken ? t('availability.hourExists', { hour }) : t('availability.addHour', { hour })}
                        >
                          {hour}
                          <small>{taken ? t('availability.exists') : selected ? t('availability.selected') : t('availability.add')}</small>
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
                {extraError ? <p className="ds-error">{extraError}</p> : null}
                <div className="ds-actions">
                  <Button type="submit" variant="primary" isPending={submitting} isDisabled={selectedHours.length === 0}>
                    {submitting
                      ? t('availability.adding')
                      : selectedHours.length
                        ? t('availability.publishHours', { count: selectedHours.length })
                        : t('availability.pickHours')}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="ds-collapsed">
                <span className="ds-collapsed-icon" aria-hidden>
                  <CalendarPlus size={18} />
                </span>
                <p>{t('availability.extraCollapsed')}</p>
              </div>
            )}
          </Card.Content>
        </Card>
      </div>

      <Card className="uo-card">
        <SectionHead
          title={t('availability.calendar')}
          meta={
            slots.length > 0 ? (
              <span className="ds-cal-counts">
                <Chip size="sm" variant="soft" color="success">
                  {t('availability.freeCount', { count: slotSummary.free ?? 0 })}
                </Chip>
                <Chip size="sm" variant="soft" color="danger">
                  {t('availability.busyCount', { count: slotSummary.busy ?? 0 })}
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
              title={t('availability.emptyTitle')}
              text={t('availability.emptyText')}
            />
          ) : (
            <div className="ds-cal">
              <p className="ds-hint">{t('availability.calHint')}</p>
              <ScheduleCalendar key={page} slots={slots} selectedId={selectedSlotId} onSelect={setSelectedSlotId} selectable />
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
                    {busyId === selectedSlot.id ? t('availability.deleting') : t('availability.deleteSlot', { time: formatSlotTime(selectedSlot.startAt) })}
                  </Button>
                ) : selectedSlot ? (
                  <p className="ds-hint">{t('availability.slotBusy')}</p>
                ) : (
                  <p className="ds-hint">{t('availability.pickGreen')}</p>
                )}
              </div>
            </div>
          )}
        </Card.Content>
      </Card>
      <KeshillaPagination pagination={pagination} onPageChange={setPage} isDisabled={loading || submitting} />
      <ConfirmActionDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => void onDelete()} pending={Boolean(busyId)} title={t('availability.deleteTitle')} description={t('availability.deleteDesc', { time: deleteTarget ? formatSlotTime(deleteTarget.startAt) : '' })} confirmLabel={t('availability.deleteConfirm')} />
    </section>
  )
}
