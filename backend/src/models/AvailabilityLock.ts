import mongoose, { Schema } from 'mongoose'

type AvailabilityLockDoc = { _id: string; token: string; leaseUntil: Date }

const availabilityLockSchema = new Schema<AvailabilityLockDoc>({
  _id: String,
  token: { type: String, required: true },
  leaseUntil: { type: Date, required: true },
}, { versionKey: false })
availabilityLockSchema.index({ leaseUntil: 1 }, { expireAfterSeconds: 0 })

export const AvailabilityLock = mongoose.model<AvailabilityLockDoc>('AvailabilityLock', availabilityLockSchema)
