import mongoose, { Schema, Types } from 'mongoose'

export const DELIVERY_STATUSES = ['pending', 'read', 'accepted', 'rejected', 'completed', 'withdrawn'] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export type RequestDeliveryDoc = {
  request: Types.ObjectId
  providerProfile: Types.ObjectId
  serviceOffer?: Types.ObjectId
  status: DeliveryStatus
  sentAt: Date
  readAt?: Date
  respondedAt?: Date
  response?: string
  offer?: { description: string; amount?: number; currency?: string }
  slotId?: string
  requestedStartAt?: Date
  requestedEndAt?: Date
  createdAt: Date
  updatedAt: Date
}

export const requestDeliverySchema = new Schema<RequestDeliveryDoc>({
  request: { type: Schema.Types.ObjectId, ref: 'UserRequest', required: true },
  providerProfile: { type: Schema.Types.ObjectId, ref: 'ProviderProfile', required: true },
  serviceOffer: { type: Schema.Types.ObjectId, ref: 'ServiceOffer' },
  status: { type: String, enum: DELIVERY_STATUSES, default: 'pending' },
  sentAt: { type: Date, required: true, default: Date.now },
  readAt: Date,
  respondedAt: Date,
  response: { type: String, trim: true, maxlength: 3000 },
  offer: {
    description: { type: String, trim: true, maxlength: 2000 },
    amount: { type: Number, min: 0 },
    currency: { type: String, uppercase: true, trim: true, match: /^[A-Z]{3}$/ },
  },
  slotId: String,
  requestedStartAt: Date,
  requestedEndAt: Date,
}, { timestamps: true })

requestDeliverySchema.pre('validate', function () {
  if (this.offer?.amount !== undefined && !this.offer.currency) this.invalidate('offer.currency', 'Offer currency is required')
})
requestDeliverySchema.index({ request: 1, providerProfile: 1 }, { unique: true })
requestDeliverySchema.index({ providerProfile: 1, status: 1, sentAt: -1 })
requestDeliverySchema.index({ request: 1, sentAt: -1 })

export const RequestDelivery = mongoose.model<RequestDeliveryDoc>('RequestDelivery', requestDeliverySchema)
