import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Types } from 'mongoose'
import { AvailabilitySlot, availabilitySlotSchema } from '../src/models/AvailabilitySlot'
import { Appointment, appointmentSchema } from '../src/models/Appointment'
import { rangesOverlap } from '../src/services/availabilityService'

test('AvailabilitySlot validates UTC range, IANA zone, capacity and canonical provider', async () => {
  const slot = new AvailabilitySlot({
    providerProfile: new Types.ObjectId(),
    startAt: new Date('2027-01-01T10:00:00Z'), endAt: new Date('2027-01-01T11:00:00Z'),
    timezone: 'Europe/Belgrade', mode: 'online', capacity: 2,
  })
  await slot.validate()
  assert.equal(slot.capacity, 2)
  assert.deepEqual(slot.holds, [])
  slot.endAt = new Date('2027-01-01T09:00:00Z')
  await assert.rejects(slot.validate(), /End must follow start/)
  slot.endAt = new Date('2027-01-01T11:00:00Z')
  slot.timezone = 'Not/A_Zone'
  await assert.rejects(slot.validate(), /Invalid IANA timezone/)
  assert.ok(availabilitySlotSchema.indexes().some(([keys]) => keys.providerProfile === 1 && keys.startAt === 1))
})

test('Appointment is separate from availability and requires cancellation audit', async () => {
  const appointment = new Appointment({
    user: new Types.ObjectId(), providerProfile: new Types.ObjectId(),
    startAt: new Date('2027-01-01T10:00:00Z'), endAt: new Date('2027-01-01T11:00:00Z'),
    timezone: 'Europe/Belgrade', mode: 'online', status: 'confirmed',
  })
  await appointment.validate()
  assert.equal(appointment.availabilitySlot, undefined)
  appointment.status = 'cancelled'
  await assert.rejects(appointment.validate(), /Cancellation audit is required/)
  assert.ok(appointmentSchema.indexes().some(([keys, options]) => keys.requestDelivery === 1 && options.unique))
})

test('adjacent slots do not overlap, but partial overlap does', () => {
  const start = new Date('2027-01-01T10:00:00Z')
  const end = new Date('2027-01-01T11:00:00Z')
  assert.equal(rangesOverlap(start, end, end, new Date('2027-01-01T12:00:00Z')), false)
  assert.equal(rangesOverlap(start, end, new Date('2027-01-01T10:30:00Z'), new Date('2027-01-01T11:30:00Z')), true)
})
