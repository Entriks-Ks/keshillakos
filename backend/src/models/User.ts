import mongoose, { Schema, Types } from 'mongoose'
import { ROLES, type UserRole } from '../types/roles'
import { socialLinksSchemaDefinition, type SocialLinks } from './socialLinks'

export type UserDoc = {
  uid: string // Firebase Authentication identity; never a password store.
  email: string
  name: string // Legacy display name, retained for existing consumers.
  firstName?: string
  lastName?: string
  phone?: string
  locale?: string
  country?: string
  city?: string
  role: UserRole // Legacy UI label; never an authorization grant.
  roles?: UserRole[] // Server/admin-granted capabilities.
  /** Which dashboard context the user is currently working in (persisted). */
  activeContext?: 'user' | 'provider' | 'company'
  requestedRole?: UserRole // Legacy; no longer used for normal Expert/Company creation.
  verification?: { email: boolean; phone: boolean; identity: boolean }
  privacy?: { profileVisibility: 'public' | 'private'; marketingConsent: boolean }
  accountStatus?: 'active' | 'suspended' | 'closed'
  // Legacy stored fields are read-only until ProviderProfile migration.
  headline?: string
  bio?: string
  location?: { countryId: Types.ObjectId; cityId: Types.ObjectId }
  legacyLocation?: string // Preserves pre-catalog free-text profile locations.
  skills?: string[]
  languages?: string[]
  profilePhoto?: string
  socialLinks?: SocialLinks
  createdAt: Date
  updatedAt: Date
}

const optionalText = (max: number) => ({
  type: String,
  trim: true,
  maxlength: max,
  set: (value: unknown) => typeof value === 'string' ? value.trim() || undefined : value,
})

const savedLocationSchema = new Schema({
  countryId: { type: Schema.Types.ObjectId, ref: 'Country', required: true },
  cityId: { type: Schema.Types.ObjectId, ref: 'City', required: true },
}, { _id: false })

export const userSchema = new Schema<UserDoc>(
  {
    uid: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String, required: true, unique: true, trim: true, lowercase: true,
      validate: { validator: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), message: 'Invalid email' },
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    firstName: optionalText(80),
    lastName: optionalText(80),
    phone: { ...optionalText(32), match: /^\+[1-9]\d{1,14}$/ },
    locale: optionalText(35),
    country: { ...optionalText(2), uppercase: true, match: /^[A-Z]{2}$/ },
    city: optionalText(120),
    role: { type: String, enum: ROLES, required: true, default: 'user' },
    roles: { type: [{ type: String, enum: ROLES }], default: undefined },
    activeContext: { type: String, enum: ['user', 'provider', 'company'], default: 'user' },
    requestedRole: { type: String, enum: ROLES },
    verification: {
      email: { type: Boolean, default: false },
      phone: { type: Boolean, default: false },
      identity: { type: Boolean, default: false },
    },
    privacy: {
      profileVisibility: { type: String, enum: ['public', 'private'], default: 'private' },
      marketingConsent: { type: Boolean, default: false },
    },
    accountStatus: { type: String, enum: ['active', 'suspended', 'closed'], default: 'active' },
    // Existing documents retain these fields; new account writes do not populate them.
    headline: String,
    bio: String,
    location: { type: savedLocationSchema, default: undefined },
    legacyLocation: String,
    skills: { type: [String], default: undefined },
    languages: { type: [String], default: undefined },
    profilePhoto: String,
    socialLinks: { type: socialLinksSchemaDefinition(), default: undefined },
  },
  { timestamps: true },
)

userSchema.pre('init', (raw: Record<string, unknown>) => {
  if (typeof raw.location === 'string') {
    raw.legacyLocation = raw.location
    delete raw.location
  }
})

// Unverified phone numbers must not reserve a unique identity.
userSchema.index({ phone: 1 }, { sparse: true })
userSchema.index({ roles: 1, accountStatus: 1 })

export const User = mongoose.model<UserDoc>('User', userSchema)
