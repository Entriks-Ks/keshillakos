import mongoose, { Schema, Types } from 'mongoose'
import { locationSchema, type Location } from './location'

export type ServiceOfferDoc = {
  portal: string
  providerProfile: Types.ObjectId
  business?: Types.ObjectId
  category: Types.ObjectId
  categoryVersion: number
  name: string
  subtitle?: string
  description: string
  price: {
    model: 'free' | 'fixed' | 'hourly' | 'starting_at' | 'quote'
    amountFrom?: number
    amountTo?: number
    currency?: string
  }
  durationMinutes?: number
  formats: Array<'individual' | 'group' | 'project' | 'course'>
  modes: Array<'online' | 'on_site'>
  languages: string[]
  serviceAreas: Location[]
  photos: string[]
  availabilityMode: 'by_arrangement' | 'request' | 'slots'
  status: 'draft' | 'pending' | 'published' | 'suspended'
  visibility: 'public' | 'unlisted' | 'private'
  extensions: Record<string, unknown>
  moderation: { status: 'pending' | 'approved' | 'rejected'; reviewedAt?: Date; reviewedBy?: Types.ObjectId }
  createdAt: Date
  updatedAt: Date
}

export const serviceOfferSchema = new Schema<ServiceOfferDoc>({
  portal: { type: String, required: true, trim: true, lowercase: true },
  providerProfile: { type: Schema.Types.ObjectId, ref: 'ProviderProfile', required: true },
  business: { type: Schema.Types.ObjectId, ref: 'Business' },
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  categoryVersion: { type: Number, required: true, min: 1 },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
  subtitle: { type: String, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
  price: {
    model: { type: String, enum: ['free', 'fixed', 'hourly', 'starting_at', 'quote'], required: true },
    amountFrom: { type: Number, min: 0 },
    amountTo: { type: Number, min: 0 },
    currency: { type: String, uppercase: true, trim: true, match: /^[A-Z]{3}$/ },
  },
  durationMinutes: { type: Number, min: 1 },
  formats: { type: [{ type: String, enum: ['individual', 'group', 'project', 'course'] }], default: [] },
  modes: { type: [{ type: String, enum: ['online', 'on_site'] }], default: [] },
  languages: { type: [String], default: [] },
  serviceAreas: { type: [locationSchema], default: [] },
  photos: { type: [String], default: [] },
  availabilityMode: { type: String, enum: ['by_arrangement', 'request', 'slots'], default: 'request' },
  status: { type: String, enum: ['draft', 'pending', 'published', 'suspended'], default: 'pending' },
  visibility: { type: String, enum: ['public', 'unlisted', 'private'], default: 'public' },
  extensions: { type: Schema.Types.Mixed, default: {} },
  moderation: {
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
}, { timestamps: true })

serviceOfferSchema.pre('validate', function () {
  const { model, amountFrom, amountTo, currency } = this.price ?? {}
  if (['fixed', 'hourly', 'starting_at'].includes(model) && (amountFrom === undefined || !currency)) {
    this.invalidate('price', 'Priced offers require amount and currency')
  }
  if (amountFrom !== undefined && amountTo !== undefined && amountTo < amountFrom) {
    this.invalidate('price.amountTo', 'Maximum price cannot be below minimum price')
  }
})

serviceOfferSchema.index({ providerProfile: 1, status: 1, updatedAt: -1 })
serviceOfferSchema.index({ portal: 1, category: 1, status: 1, visibility: 1 })
serviceOfferSchema.index({ business: 1, status: 1 })

export const ServiceOffer = mongoose.model<ServiceOfferDoc>('ServiceOffer', serviceOfferSchema)
