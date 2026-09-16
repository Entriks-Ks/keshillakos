import mongoose, { Schema, Types } from 'mongoose'
import { locationSchema, type Location } from './location'

export type ProviderStatus = 'draft' | 'pending' | 'published' | 'suspended'
export type ProviderProfileDoc = {
  providerType: 'individual' | 'business'
  ownerUser: Types.ObjectId
  business?: Types.ObjectId
  categories: string[]
  languages: string[]
  locations: Location[]
  serviceAreas: Location[]
  modes: Array<'online' | 'on_site'>
  publicProfile: {
    displayName: string
    title?: string
    shortDescription?: string
    description?: string
    photoUrl?: string
    publicEmail?: string
    publicPhone?: string
  }
  status: ProviderStatus
  verification: {
    identity: 'unverified' | 'pending' | 'verified' | 'rejected'
    business: 'unverified' | 'pending' | 'verified' | 'rejected'
    qualification: 'unverified' | 'pending' | 'verified' | 'rejected'
  }
  qualificationClaims?: Array<{ categoryId: string; referenceNumber?: string; status: 'unverified' | 'verified' | 'rejected' }>
  moderation: { status: 'pending' | 'approved' | 'rejected'; reviewedAt?: Date; reviewedBy?: Types.ObjectId; reason?: string }
  createdAt: Date
  updatedAt: Date
}

const verificationStates = ['unverified', 'pending', 'verified', 'rejected']

export const providerProfileSchema = new Schema<ProviderProfileDoc>(
  {
    providerType: { type: String, enum: ['individual', 'business'], required: true },
    ownerUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: function (this: ProviderProfileDoc) { return this.providerType === 'business' } },
    categories: { type: [{ type: String, trim: true }], required: true, validate: [(value: string[]) => value.length > 0 && value.every(Boolean), 'At least one category is required'] },
    languages: { type: [{ type: String, trim: true }], default: [] },
    locations: { type: [locationSchema], default: [] },
    serviceAreas: { type: [locationSchema], default: [] },
    modes: { type: [{ type: String, enum: ['online', 'on_site'] }], default: [] },
    publicProfile: {
      displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
      title: { type: String, trim: true, maxlength: 160 },
      shortDescription: { type: String, trim: true, maxlength: 300 },
      description: { type: String, trim: true, maxlength: 3000 },
      photoUrl: { type: String, trim: true, maxlength: 500 },
      publicEmail: { type: String, trim: true, lowercase: true },
      publicPhone: { type: String, trim: true },
    },
    status: { type: String, enum: ['draft', 'pending', 'published', 'suspended'], default: 'pending' },
    verification: {
      identity: { type: String, enum: verificationStates, default: 'unverified' },
      business: { type: String, enum: verificationStates, default: 'unverified' },
      qualification: { type: String, enum: verificationStates, default: 'unverified' },
    },
    qualificationClaims: {
      type: [{ categoryId: { type: String, required: true, trim: true }, referenceNumber: { type: String, trim: true }, status: { type: String, enum: ['unverified', 'verified', 'rejected'], default: 'unverified' } }],
      default: undefined,
    },
    moderation: {
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      reviewedAt: Date,
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String, trim: true, maxlength: 500 },
    },
  },
  { timestamps: true },
)

providerProfileSchema.pre('validate', function () {
  if (this.modes.includes('on_site') && this.locations.length === 0) {
    this.invalidate('locations', 'On-site providers require a location')
  }
})
providerProfileSchema.index({ ownerUser: 1, status: 1 })
providerProfileSchema.index({ business: 1, status: 1 })
providerProfileSchema.index({ categories: 1, status: 1 })
providerProfileSchema.index({ status: 1, 'moderation.status': 1, updatedAt: -1 })
providerProfileSchema.index({ business: 1, providerType: 1 }, { unique: true, partialFilterExpression: { providerType: 'business' } })

export const ProviderProfile = mongoose.model<ProviderProfileDoc>('ProviderProfile', providerProfileSchema)
