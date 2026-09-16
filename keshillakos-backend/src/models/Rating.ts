import mongoose, { Schema } from 'mongoose'

export type RatingDoc = {
  providerUid: string
  providerName: string
  raterUid: string
  raterName: string
  score: number
  comment?: string
  createdAt: Date
  updatedAt: Date
}

const ratingSchema = new Schema<RatingDoc>(
  {
    providerUid: { type: String, required: true, index: true },
    providerName: { type: String, required: true },
    raterUid: { type: String, required: true, index: true },
    raterName: { type: String, required: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
)

ratingSchema.index({ raterUid: 1, providerUid: 1 }, { unique: true })

export const Rating = mongoose.model<RatingDoc>('Rating', ratingSchema)
