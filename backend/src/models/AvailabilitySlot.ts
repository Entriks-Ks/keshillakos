import mongoose, { Schema, Types } from 'mongoose'
import { locationSchema, type Location } from './location'

export const SLOT_STATUSES = ['open', 'held', 'booked', 'cancelled'] as const
export type SlotStatus = (typeof SLOT_STATUSES)[number]

export type AvailabilitySlotDoc = {
  providerUid: string
  providerName: string
  providerProfile?: Types.ObjectId
  business?: Types.ObjectId
  serviceOffer?: Types.ObjectId
  staffUser?: Types.ObjectId
  resourceKey?: string
  startAt: Date
  endAt: Date
  timezone?: string
  mode?: 'online' | 'on_site'
  location?: Location
  capacity: number
  holds: Array<{ requestId: string; state: 'held' | 'booked'; heldAt: Date }>
  status: SlotStatus
  note?: string
  requestId?: string
  createdAt: Date
  updatedAt: Date
}

export const availabilitySlotSchema = new Schema<AvailabilitySlotDoc>(
  {
    providerUid: { type: String, index: true }, // Historical API alias, never a canonical provider ID.
    providerName: { type: String },
    providerProfile: { type: Schema.Types.ObjectId, ref: 'ProviderProfile' },
    business: { type: Schema.Types.ObjectId, ref: 'Business' },
    serviceOffer: { type: Schema.Types.ObjectId, ref: 'ServiceOffer' },
    staffUser: { type: Schema.Types.ObjectId, ref: 'User' },
    resourceKey: { type: String, trim: true, maxlength: 120 },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, trim: true, default: 'Europe/Belgrade' },
    mode: { type: String, enum: ['online', 'on_site'], default: 'online' },
    location: { type: locationSchema },
    capacity: { type: Number, min: 1, max: 100, default: 1 },
    holds: { type: [{ requestId: { type: String, required: true }, state: { type: String, enum: ['held', 'booked'], required: true }, heldAt: { type: Date, required: true } }], default: [] },
    status: {
      type: String,
      enum: SLOT_STATUSES,
      default: 'open',
      index: true,
    },
    note: { type: String, trim: true },
    requestId: { type: String },
  },
  { timestamps: true },
)

availabilitySlotSchema.index({ providerUid: 1, startAt: 1, status: 1 })
availabilitySlotSchema.index({ providerProfile: 1, startAt: 1, endAt: 1, status: 1 })
availabilitySlotSchema.index({ providerProfile: 1, staffUser: 1, resourceKey: 1, startAt: 1 })
availabilitySlotSchema.index({ 'holds.requestId': 1 }, { sparse: true })
availabilitySlotSchema.pre('validate', function () {
  if (!this.providerProfile && !this.providerUid?.trim()) this.invalidate('providerProfile', 'ProviderProfile or legacy provider UID is required')
  if (this.startAt && this.endAt && this.endAt <= this.startAt) this.invalidate('endAt', 'End must follow start')
  if (this.timezone) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: this.timezone }) }
    catch { this.invalidate('timezone', 'Invalid IANA timezone') }
  }
  if (this.holds.length > this.capacity) this.invalidate('holds', 'Holds exceed capacity')
  if (this.mode === 'on_site' && this.location?.online) this.invalidate('location', 'On-site slot cannot be online')
})

export const AvailabilitySlot = mongoose.model<AvailabilitySlotDoc>(
  'AvailabilitySlot',
  availabilitySlotSchema,
)
