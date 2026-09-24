import mongoose, { Schema, Types } from 'mongoose'

export type CityDoc = {
  countryId: Types.ObjectId
  name: { sq: string; en: string }
  slug: string
  order: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const citySchema = new Schema<CityDoc>({
  countryId: { type: Schema.Types.ObjectId, ref: 'Country', required: true },
  name: {
    sq: { type: String, required: true, trim: true },
    en: { type: String, required: true, trim: true },
  },
  slug: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  order: { type: Number, required: true, min: 1, validate: Number.isInteger },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

citySchema.index({ countryId: 1, slug: 1 }, { unique: true })
citySchema.index({ countryId: 1, isActive: 1, order: 1, slug: 1 })
citySchema.index({ slug: 1, isActive: 1 })

export const City = mongoose.model<CityDoc>('City', citySchema)
