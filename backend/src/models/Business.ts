import mongoose, { Schema, Types } from 'mongoose'
import { locationSchema, type Location } from './location'
import { socialLinksSchemaDefinition, type SocialLinks } from './socialLinks'

export type BusinessStatus = 'draft' | 'active' | 'suspended' | 'closed'
export type BusinessDoc = {
  publicName: string
  legalName?: string
  logoUrl?: string
  description?: string
  website?: string
  contactEmail?: string
  contactPhone?: string
  /** Domain/category stableIds — same canonical ids as ProviderProfile.categories. */
  categoryIds: string[]
  location?: { countryId: Types.ObjectId; cityId: Types.ObjectId }
  socialLinks?: SocialLinks
  owners: Types.ObjectId[]
  members: Array<{ user: Types.ObjectId; role: 'manager' | 'member' }>
  invitations: Array<{ user: Types.ObjectId; invitedBy: Types.ObjectId; invitedAt: Date }>
  branches: Array<{ name: string; location: Location }>
  verification: { status: 'unverified' | 'pending' | 'verified' | 'rejected'; reviewedAt?: Date; reviewedBy?: Types.ObjectId }
  status: BusinessStatus
  createdAt: Date
  updatedAt: Date
}

const businessLocationSchema = new Schema({
  countryId: { type: Schema.Types.ObjectId, ref: 'Country', required: true },
  cityId: { type: Schema.Types.ObjectId, ref: 'City', required: true },
}, { _id: false })

export const businessSchema = new Schema<BusinessDoc>(
  {
    publicName: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
    legalName: { type: String, trim: true, maxlength: 200 },
    logoUrl: { type: String, trim: true, maxlength: 500 },
    description: { type: String, trim: true, maxlength: 3000 },
    website: { type: String, trim: true, maxlength: 500 },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      validate: {
        validator: (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: 'Invalid email',
      },
    },
    contactPhone: {
      type: String,
      trim: true,
      maxlength: 32,
      validate: {
        validator: (value: string) => !value || /^\+[1-9]\d{1,14}$/.test(value),
        message: 'Invalid phone',
      },
    },
    categoryIds: { type: [{ type: String, trim: true }], default: [] },
    location: { type: businessLocationSchema, default: undefined },
    socialLinks: { type: socialLinksSchemaDefinition(), default: undefined },
    owners: { type: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }], required: true, validate: [(value: Types.ObjectId[]) => value.length > 0 && new Set(value.map(String)).size === value.length, 'At least one distinct owner is required'] },
    members: {
      type: [{ user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, role: { type: String, enum: ['manager', 'member'], required: true } }],
      default: [],
    },
    invitations: {
      type: [{
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        invitedAt: { type: Date, required: true },
      }],
      default: [],
    },
    branches: {
      type: [{ name: { type: String, required: true, trim: true }, location: { type: locationSchema, required: true } }],
      default: [],
    },
    verification: {
      status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' },
      reviewedAt: Date,
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    status: { type: String, enum: ['draft', 'active', 'suspended', 'closed'], default: 'draft' },
  },
  { timestamps: true },
)

businessSchema.index({ owners: 1, status: 1 })
businessSchema.index({ 'members.user': 1, status: 1 })
businessSchema.index({ 'invitations.user': 1 })
businessSchema.index({ status: 1, publicName: 1 })

businessSchema.pre('validate', function () {
  if (this.verification?.status === 'verified' && !this.legalName?.trim()) {
    this.invalidate('legalName', 'Verified businesses require a legal name')
  }
})

export const Business = mongoose.model<BusinessDoc>('Business', businessSchema)
