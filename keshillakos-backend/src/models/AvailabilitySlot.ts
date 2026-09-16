import mongoose, { Schema } from 'mongoose'

export const SLOT_STATUSES = ['open', 'held', 'booked', 'cancelled'] as const
export type SlotStatus = (typeof SLOT_STATUSES)[number]

export type AvailabilitySlotDoc = {
  providerUid: string
  providerName: string
  startAt: Date
  endAt: Date
  status: SlotStatus
  note?: string
  requestId?: string
  createdAt: Date
  updatedAt: Date
}

const availabilitySlotSchema = new Schema<AvailabilitySlotDoc>(
  {
    providerUid: { type: String, required: true, index: true },
    providerName: { type: String, required: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
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

export const AvailabilitySlot = mongoose.model<AvailabilitySlotDoc>(
  'AvailabilitySlot',
  availabilitySlotSchema,
)
