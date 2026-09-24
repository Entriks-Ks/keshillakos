import mongoose, { Schema, Types } from 'mongoose'
import { locationSchema, type Location } from './location'
import {
  certificationEntrySchema,
  educationEntrySchema,
  workExperienceEntrySchema,
  type CertificationEntry,
  type EducationEntry,
  type WorkExperienceEntry,
} from './providerCareer'
import { socialLinksSchemaDefinition, type SocialLinks } from './socialLinks'

export type ProviderStatus = 'draft' | 'pending' | 'published' | 'suspended'
export type ProviderProfileDoc = {
  providerType: 'individual' | 'business'
  ownerUser: Types.ObjectId
  business?: Types.ObjectId
  categories: string[]
  /** Canonical catalog Subcategory refs for the expert profile. */
  subcategoryIds: Types.ObjectId[]
  languages: string[]
  locations: Location[]
  serviceAreas: Location[]
  location?: { countryId: Types.ObjectId; cityId: Types.ObjectId }
  serviceAreaCityIds: Types.ObjectId[]
  modes: Array<'online' | 'on_site'>
  /** Years of professional experience (required for expert completion). */
  yearsOfExperience?: number
  /** @deprecated Legacy free-text experience; prefer yearsOfExperience + workExperience. */
  experience?: string
  /** Expert specializations (independent from private User.skills). */
  specializations?: string[]
  socialLinks?: SocialLinks
  workExperience?: WorkExperienceEntry[]
  education?: EducationEntry[]
  certifications?: CertificationEntry[]
  publicProfile: {
    displayName: string
    title?: string
    shortDescription?: string
    description?: string
    photoUrl?: string
    coverUrl?: string
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
const baseLocationSchema = new Schema({
  countryId: { type: Schema.Types.ObjectId, ref: 'Country', required: true },
  cityId: { type: Schema.Types.ObjectId, ref: 'City', required: true },
}, { _id: false })

export const providerProfileSchema = new Schema<ProviderProfileDoc>(
  {
    providerType: { type: String, enum: ['individual', 'business'], required: true },
    ownerUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: function (this: ProviderProfileDoc) { return this.providerType === 'business' } },
    categories: { type: [{ type: String, trim: true }], required: true, validate: [(value: string[]) => value.length > 0 && value.every(Boolean), 'At least one category is required'] },
    subcategoryIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Subcategory' }], default: [] },
    languages: { type: [{ type: String, trim: true }], default: [] },
    locations: { type: [locationSchema], default: [] },
    serviceAreas: { type: [locationSchema], default: [] },
    location: { type: baseLocationSchema, default: undefined },
    serviceAreaCityIds: { type: [{ type: Schema.Types.ObjectId, ref: 'City' }], default: [] },
    modes: { type: [{ type: String, enum: ['online', 'on_site'] }], default: [] },
    yearsOfExperience: { type: Number, min: 0, max: 60 },
    experience: { type: String, trim: true, maxlength: 2000 },
    specializations: { type: [{ type: String, trim: true }], default: undefined },
    socialLinks: { type: socialLinksSchemaDefinition(), default: undefined },
    workExperience: { type: [new Schema(workExperienceEntrySchema, { _id: false })], default: [] },
    education: { type: [new Schema(educationEntrySchema, { _id: false })], default: [] },
    certifications: { type: [new Schema(certificationEntrySchema, { _id: false })], default: [] },
    publicProfile: {
      displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
      title: { type: String, trim: true, maxlength: 160 },
      shortDescription: { type: String, trim: true, maxlength: 300 },
      description: { type: String, trim: true, maxlength: 3000 },
      photoUrl: { type: String, trim: true, maxlength: 500 },
      coverUrl: { type: String, trim: true, maxlength: 500 },
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
  if (this.modes.includes('on_site') && !this.location && this.locations.length === 0) {
    this.invalidate('location', 'On-site providers require a location')
  }
  if (new Set(this.serviceAreaCityIds.map(String)).size !== this.serviceAreaCityIds.length) this.invalidate('serviceAreaCityIds', 'Duplicate service-area cities')
  if (new Set(this.subcategoryIds.map(String)).size !== this.subcategoryIds.length) this.invalidate('subcategoryIds', 'Duplicate subcategories')
})
providerProfileSchema.index({ ownerUser: 1, status: 1 })
providerProfileSchema.index({ business: 1, status: 1 })
providerProfileSchema.index({ categories: 1, status: 1 })
providerProfileSchema.index({ status: 1, 'moderation.status': 1, updatedAt: -1 })
providerProfileSchema.index({ business: 1, providerType: 1 }, { unique: true, partialFilterExpression: { providerType: 'business' } })
/** One individual expert profile per user (Company-linked business profiles are separate). */
providerProfileSchema.index(
  { ownerUser: 1 },
  { unique: true, partialFilterExpression: { providerType: 'individual', business: { $exists: false } } },
)
providerProfileSchema.index({ 'location.countryId': 1, 'location.cityId': 1, status: 1 })
providerProfileSchema.index({ serviceAreaCityIds: 1, status: 1 })

export const ProviderProfile = mongoose.model<ProviderProfileDoc>('ProviderProfile', providerProfileSchema)
