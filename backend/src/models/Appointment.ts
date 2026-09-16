import mongoose, { Schema, Types } from 'mongoose'
import { locationSchema, type Location } from './location'

export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export type AppointmentDoc = {
  user: Types.ObjectId
  providerProfile: Types.ObjectId
  business?: Types.ObjectId
  serviceOffer?: Types.ObjectId
  userRequest?: Types.ObjectId
  requestDelivery?: Types.ObjectId
  availabilitySlot?: Types.ObjectId
  startAt: Date
  endAt: Date
  timezone: string
  mode: 'online' | 'on_site'
  location?: Location
  status: AppointmentStatus
  cancellation?: { cancelledAt: Date; cancelledBy: Types.ObjectId; reason?: string }
  createdAt: Date
  updatedAt: Date
}

export const appointmentSchema = new Schema<AppointmentDoc>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  providerProfile: { type: Schema.Types.ObjectId, ref: 'ProviderProfile', required: true },
  business: { type: Schema.Types.ObjectId, ref: 'Business' },
  serviceOffer: { type: Schema.Types.ObjectId, ref: 'ServiceOffer' },
  userRequest: { type: Schema.Types.ObjectId, ref: 'UserRequest' },
  requestDelivery: { type: Schema.Types.ObjectId, ref: 'RequestDelivery' },
  availabilitySlot: { type: Schema.Types.ObjectId, ref: 'AvailabilitySlot' },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  timezone: { type: String, required: true, trim: true },
  mode: { type: String, enum: ['online', 'on_site'], required: true },
  location: { type: locationSchema },
  status: { type: String, enum: APPOINTMENT_STATUSES, default: 'confirmed' },
  cancellation: {
    cancelledAt: Date,
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, trim: true, maxlength: 1000 },
  },
}, { timestamps: true })

appointmentSchema.pre('validate', function () {
  if (this.startAt && this.endAt && this.endAt <= this.startAt) this.invalidate('endAt', 'End must follow start')
  if (this.timezone) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: this.timezone }) }
    catch { this.invalidate('timezone', 'Invalid IANA timezone') }
  }
  if (this.mode === 'on_site' && this.location?.online) this.invalidate('location', 'On-site appointment cannot be online')
  if (this.status === 'cancelled' && (!this.cancellation?.cancelledAt || !this.cancellation.cancelledBy)) this.invalidate('cancellation', 'Cancellation audit is required')
})
appointmentSchema.index({ user: 1, startAt: -1 })
appointmentSchema.index({ providerProfile: 1, startAt: -1, status: 1 })
appointmentSchema.index({ business: 1, startAt: -1 })
appointmentSchema.index({ requestDelivery: 1 }, { unique: true, partialFilterExpression: { requestDelivery: { $exists: true } } })
appointmentSchema.index({ availabilitySlot: 1, startAt: 1 })

export const Appointment = mongoose.model<AppointmentDoc>('Appointment', appointmentSchema)
