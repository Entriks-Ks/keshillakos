import mongoose, { Schema, Types } from 'mongoose'

export type ReviewDoc = {
  reviewer: Types.ObjectId
  subjectType: 'provider' | 'business'
  subjectId: Types.ObjectId
  providerProfile?: Types.ObjectId
  business?: Types.ObjectId
  portal: string
  source: 'web' | 'admin'
  policy?: Types.ObjectId
  policyVersion?: number
  interaction: { kind: 'appointment' | 'request_delivery'; ref: Types.ObjectId; eligible: boolean; verified: boolean }
  userRequest?: Types.ObjectId
  appointment?: Types.ObjectId
  stars: number
  dimensions: Map<string, number>
  text?: string
  language?: string
  moderation: { status: 'pending' | 'published' | 'rejected'; reviewedAt?: Date; reviewedBy?: Types.ObjectId; reason?: string }
  abuse: { status: 'clear' | 'flagged' | 'confirmed'; reason?: string }
  response?: { text: string; respondedBy: Types.ObjectId; respondedAt: Date }
  publishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export const reviewSchema = new Schema<ReviewDoc>({
  reviewer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  subjectType: { type: String, enum: ['provider', 'business'], required: true },
  subjectId: { type: Schema.Types.ObjectId, required: true },
  providerProfile: { type: Schema.Types.ObjectId, ref: 'ProviderProfile' },
  business: { type: Schema.Types.ObjectId, ref: 'Business' },
  portal: { type: String, required: true, trim: true, lowercase: true },
  source: { type: String, enum: ['web', 'admin'], default: 'web' },
  policy: { type: Schema.Types.ObjectId, ref: 'Policy' },
  policyVersion: { type: Number, min: 1 },
  interaction: {
    kind: { type: String, enum: ['appointment', 'request_delivery'], required: true },
    ref: { type: Schema.Types.ObjectId, required: true },
    eligible: { type: Boolean, required: true },
    verified: { type: Boolean, required: true },
  },
  userRequest: { type: Schema.Types.ObjectId, ref: 'UserRequest' },
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  stars: { type: Number, required: true, min: 1, max: 5 },
  dimensions: { type: Map, of: { type: Number, min: 1, max: 5 }, default: {} },
  text: { type: String, trim: true, maxlength: 2000 },
  language: { type: String, trim: true, lowercase: true, maxlength: 20 },
  moderation: {
    status: { type: String, enum: ['pending', 'published', 'rejected'], default: 'pending' },
    reviewedAt: Date, reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, trim: true, maxlength: 1000 },
  },
  abuse: {
    status: { type: String, enum: ['clear', 'flagged', 'confirmed'], default: 'clear' },
    reason: { type: String, trim: true, maxlength: 1000 },
  },
  response: {
    text: { type: String, trim: true, maxlength: 2000 },
    respondedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    respondedAt: Date,
  },
  publishedAt: Date,
}, { timestamps: true })

export function reviewIsAggregateEligible(review: Pick<ReviewDoc, 'moderation' | 'abuse' | 'interaction' | 'publishedAt'>) {
  return review.moderation.status === 'published' && review.abuse.status === 'clear' &&
    review.interaction.eligible && Boolean(review.publishedAt)
}

reviewSchema.pre('validate', function () {
  if (!Number.isInteger(this.stars)) this.invalidate('stars', 'Stars must be an integer')
  if (this.subjectType === 'provider' && (!this.providerProfile || !this.subjectId.equals(this.providerProfile) || this.business)) this.invalidate('subjectId', 'Provider subject is inconsistent')
  if (this.subjectType === 'business' && (!this.business || !this.subjectId.equals(this.business) || this.providerProfile)) this.invalidate('subjectId', 'Business subject is inconsistent')
  if (!this.interaction?.eligible) this.invalidate('interaction', 'A legitimate interaction is required')
  if (Boolean(this.policy) !== Boolean(this.policyVersion)) this.invalidate('policy', 'Policy reference and version must be paired')
  if (this.interaction?.kind === 'appointment' && (!this.appointment?.equals(this.interaction.ref) || !this.interaction.verified)) this.invalidate('appointment', 'Verified appointment reference is required')
  if (this.interaction?.kind === 'request_delivery' && (!this.userRequest || this.appointment || this.interaction.verified)) this.invalidate('interaction', 'Delivery reviews cannot be verified appointments')
  if (this.moderation?.status === 'published' && !this.publishedAt) this.invalidate('publishedAt', 'Publication timestamp is required')
  for (const [key, value] of this.dimensions ?? []) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key) || !Number.isInteger(value) || value < 1 || value > 5) this.invalidate(`dimensions.${key}`, 'Invalid review dimension')
  }
})
reviewSchema.index({ 'interaction.kind': 1, 'interaction.ref': 1 }, { unique: true })
reviewSchema.index({ portal: 1, subjectType: 1, subjectId: 1, 'moderation.status': 1, 'abuse.status': 1, publishedAt: -1 })
reviewSchema.index({ reviewer: 1, createdAt: -1 })

export const Review = mongoose.model<ReviewDoc>('Review', reviewSchema)
