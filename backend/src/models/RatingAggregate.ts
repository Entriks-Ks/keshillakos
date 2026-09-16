import mongoose, { Schema, Types } from 'mongoose'

export type RatingAggregateDoc = {
  portal: string
  scope: 'provider' | 'business'
  subjectId: Types.ObjectId
  average: number
  count: number
  verifiedCount: number
  dimensions: Map<string, { average: number; count: number }>
  calculatedAt: Date
}

export const ratingAggregateSchema = new Schema<RatingAggregateDoc>({
  portal: { type: String, required: true, trim: true, lowercase: true },
  scope: { type: String, enum: ['provider', 'business'], required: true },
  subjectId: { type: Schema.Types.ObjectId, required: true },
  average: { type: Number, min: 0, max: 5, default: 0 },
  count: { type: Number, min: 0, default: 0 },
  verifiedCount: { type: Number, min: 0, default: 0 },
  dimensions: { type: Map, of: new Schema({ average: { type: Number, min: 0, max: 5 }, count: { type: Number, min: 0 } }, { _id: false }), default: {} },
  calculatedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: false })
ratingAggregateSchema.pre('validate', function () {
  if (this.verifiedCount > this.count) this.invalidate('verifiedCount', 'Verified count exceeds count')
})
ratingAggregateSchema.index({ portal: 1, scope: 1, subjectId: 1 }, { unique: true })

export const RatingAggregate = mongoose.model<RatingAggregateDoc>('RatingAggregate', ratingAggregateSchema)
