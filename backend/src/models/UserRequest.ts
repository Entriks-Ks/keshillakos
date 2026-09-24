import mongoose, { Schema, Types } from 'mongoose'
import { locationSchema, type Location } from './location'

export const USER_REQUEST_STATUSES = ['draft', 'open', 'closed', 'cancelled'] as const
export type UserRequestStatus = (typeof USER_REQUEST_STATUSES)[number]
export const CONTACT_PREFERENCES = ['chat', 'phone', 'email'] as const
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number]

export type UserRequestDoc = {
  user: Types.ObjectId
  category: Types.ObjectId
  problem: string
  description: string
  location?: Location
  language?: string
  budget?: { min?: number; max?: number; currency: string }
  urgency: 'today' | 'this_week' | 'flexible'
  preferredMode: 'online' | 'on_site' | 'either'
  contactPreference: ContactPreference
  contactPhone?: string
  contactEmail?: string
  portal: string
  source: 'web' | 'admin' | 'legacy'
  status: UserRequestStatus
  createdAt: Date
  updatedAt: Date
}

export const userRequestSchema = new Schema<UserRequestDoc>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  problem: { type: String, required: true, trim: true, minlength: 2, maxlength: 240 },
  description: { type: String, required: true, trim: true, minlength: 8, maxlength: 5000 },
  location: { type: locationSchema },
  language: { type: String, trim: true, lowercase: true, maxlength: 20 },
  budget: {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 },
    currency: { type: String, uppercase: true, trim: true, match: /^[A-Z]{3}$/ },
  },
  urgency: { type: String, enum: ['today', 'this_week', 'flexible'], default: 'flexible' },
  preferredMode: { type: String, enum: ['online', 'on_site', 'either'], default: 'either' },
  contactPreference: { type: String, enum: CONTACT_PREFERENCES, required: true },
  contactPhone: { type: String, trim: true, maxlength: 32 },
  contactEmail: { type: String, trim: true, lowercase: true, maxlength: 160 },
  portal: { type: String, required: true, trim: true, lowercase: true },
  source: { type: String, enum: ['web', 'admin', 'legacy'], default: 'web' },
  status: { type: String, enum: USER_REQUEST_STATUSES, default: 'draft' },
}, { timestamps: true })

const PHONE_PATTERN = /^\+?[0-9]{8,15}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeContactPhone(value?: string) {
  return value?.replace(/[\s()-]/g, '').trim() || undefined
}

userRequestSchema.pre('validate', function () {
  if (this.budget && this.budget.min !== undefined && this.budget.max !== undefined && this.budget.max < this.budget.min) {
    this.invalidate('budget.max', 'Maximum budget cannot be below minimum budget')
  }
  if (this.budget && (this.budget.min !== undefined || this.budget.max !== undefined) && !this.budget.currency) {
    this.invalidate('budget.currency', 'Budget currency is required')
  }
  const phone = normalizeContactPhone(this.contactPhone)
  this.contactPhone = phone
  const email = this.contactEmail?.trim().toLowerCase() || undefined
  this.contactEmail = email
  if (!phone) this.invalidate('contactPhone', 'Numri i telefonit është i detyrueshëm')
  else if (!PHONE_PATTERN.test(phone)) this.invalidate('contactPhone', 'Numri i telefonit nuk është i vlefshëm')
  if (this.contactPreference === 'email') {
    if (!email) this.invalidate('contactEmail', 'Email-i është i detyrueshëm')
    else if (!EMAIL_PATTERN.test(email)) this.invalidate('contactEmail', 'Email-i nuk është i vlefshëm')
  }
})
userRequestSchema.index({ user: 1, createdAt: -1 })
userRequestSchema.index({ portal: 1, category: 1, status: 1, createdAt: -1 })

export const UserRequest = mongoose.model<UserRequestDoc>('UserRequest', userRequestSchema)
