import mongoose, { Schema, Types } from 'mongoose'

export type PolicyRules = {
  privacy: {
    requireConsent: boolean
    reviewerDisplay: 'first_name' | 'anonymous'
    contactDisclosure: 'never' | 'after_interaction'
  }
  sensitiveData: {
    publicRedactions: string[]
    prohibitFreeTextSecrets: boolean
    exportRequiresApproval: boolean
  }
  providerVerification: {
    requiredChecks: Array<'identity' | 'business' | 'qualification'>
    requireBusinessVerification: boolean
  }
  reviewEligibility: {
    completedDelivery: boolean
    completedAppointment: boolean
  }
  moderation: {
    reviewRequiresApproval: boolean
    abuseBlocksPublication: boolean
    responseRequiresApproval: boolean
  }
  retention: {
    userRequestDays?: number
    deliveryDays?: number
    appointmentDays?: number
    reviewDays?: number
    legalHold: boolean
  }
  categoryRequirements: {
    requiredProviderFields: string[]
    requiredOfferExtensions: string[]
    allowedModes: Array<'online' | 'on_site'>
  }
}

export type PolicyDoc = {
  portal: string
  key: string
  category?: Types.ObjectId
  version: number
  status: 'draft' | 'active' | 'retired'
  effectiveFrom?: Date
  effectiveUntil?: Date
  supersedes?: Types.ObjectId
  rules: PolicyRules
  publishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const policyKey = /^[a-z][a-z0-9-]*$/
const fieldKey = /^[a-z][A-Za-z0-9.]*$/
const days = { type: Number, min: 1, max: 36500 }

export const policySchema = new Schema<PolicyDoc>({
  portal: { type: String, required: true, trim: true, lowercase: true, match: policyKey },
  key: { type: String, required: true, trim: true, lowercase: true, match: policyKey },
  category: { type: Schema.Types.ObjectId, ref: 'Category' },
  version: { type: Number, required: true, min: 1, validate: Number.isInteger },
  status: { type: String, enum: ['draft', 'active', 'retired'], default: 'draft' },
  effectiveFrom: Date,
  effectiveUntil: Date,
  supersedes: { type: Schema.Types.ObjectId, ref: 'Policy' },
  rules: {
    privacy: {
      requireConsent: { type: Boolean, default: true },
      reviewerDisplay: { type: String, enum: ['first_name', 'anonymous'], default: 'anonymous' },
      contactDisclosure: { type: String, enum: ['never', 'after_interaction'], default: 'after_interaction' },
    },
    sensitiveData: {
      publicRedactions: { type: [String], default: [] },
      prohibitFreeTextSecrets: { type: Boolean, default: true },
      exportRequiresApproval: { type: Boolean, default: true },
    },
    providerVerification: {
      requiredChecks: { type: [{ type: String, enum: ['identity', 'business', 'qualification'] }], default: [] },
      requireBusinessVerification: { type: Boolean, default: false },
    },
    reviewEligibility: {
      completedDelivery: { type: Boolean, default: true },
      completedAppointment: { type: Boolean, default: true },
    },
    moderation: {
      reviewRequiresApproval: { type: Boolean, default: true },
      abuseBlocksPublication: { type: Boolean, default: true },
      responseRequiresApproval: { type: Boolean, default: false },
    },
    retention: {
      userRequestDays: days, deliveryDays: days, appointmentDays: days, reviewDays: days,
      legalHold: { type: Boolean, default: false },
    },
    categoryRequirements: {
      requiredProviderFields: { type: [String], default: [] },
      requiredOfferExtensions: { type: [String], default: [] },
      allowedModes: { type: [{ type: String, enum: ['online', 'on_site'] }], default: ['online', 'on_site'] },
    },
  },
  publishedAt: Date,
}, { timestamps: true })

policySchema.pre('validate', function () {
  if (this.effectiveFrom && this.effectiveUntil && this.effectiveUntil <= this.effectiveFrom) this.invalidate('effectiveUntil', 'Policy end must follow start')
  if (this.status === 'active' && !this.publishedAt) this.invalidate('publishedAt', 'Active policy requires publication time')
  if (this.supersedes?.equals(this._id)) this.invalidate('supersedes', 'Policy cannot supersede itself')
  for (const value of [
    ...(this.rules?.sensitiveData?.publicRedactions ?? []),
    ...(this.rules?.categoryRequirements?.requiredProviderFields ?? []),
    ...(this.rules?.categoryRequirements?.requiredOfferExtensions ?? []),
  ]) if (!fieldKey.test(value)) this.invalidate('rules', `Invalid policy field reference: ${value}`)
})

policySchema.index({ portal: 1, key: 1, category: 1, version: 1 }, { unique: true })
policySchema.index({ portal: 1, key: 1, category: 1 }, { unique: true, partialFilterExpression: { status: 'active' } })
policySchema.index({ portal: 1, category: 1, status: 1, effectiveFrom: -1 })

export const Policy = mongoose.model<PolicyDoc>('Policy', policySchema)
