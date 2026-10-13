import mongoose, { Schema } from 'mongoose'
import type { PlanAudience } from '../plans/catalog'

export type SubscriptionDoc = {
  ownerUid: string
  audience: PlanAudience
  plan: 'basic' | 'pro'
  interval?: 'monthly' | 'yearly'
  status: 'active' | 'trialing' | 'expired'
  trialEndsAt?: Date
  periodEndsAt?: Date
  trialUsed: boolean
  stats: { visits: number; contacts: number; requests: number; clicks: number }
  createdAt: Date
  updatedAt: Date
}

const subscriptionSchema = new Schema<SubscriptionDoc>(
  {
    ownerUid: { type: String, required: true, trim: true },
    audience: { type: String, enum: ['provider', 'company'], required: true },
    plan: { type: String, enum: ['basic', 'pro'], default: 'basic' },
    interval: { type: String, enum: ['monthly', 'yearly'] },
    status: { type: String, enum: ['active', 'trialing', 'expired'], default: 'active' },
    trialEndsAt: Date,
    periodEndsAt: Date,
    trialUsed: { type: Boolean, default: false },
    stats: {
      visits: { type: Number, default: 0 },
      contacts: { type: Number, default: 0 },
      requests: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
)

subscriptionSchema.index({ ownerUid: 1, audience: 1 }, { unique: true })

export const Subscription = mongoose.model<SubscriptionDoc>('Subscription', subscriptionSchema)
