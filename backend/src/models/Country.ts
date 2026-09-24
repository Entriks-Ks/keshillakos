import mongoose, { Schema } from 'mongoose'

export type CountryDoc = {
  name: { sq: string; en: string }
  slug: string
  order: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const countrySchema = new Schema<CountryDoc>({
  name: {
    sq: { type: String, required: true, trim: true },
    en: { type: String, required: true, trim: true },
  },
  slug: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  order: { type: Number, required: true, min: 1, validate: Number.isInteger },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

countrySchema.index({ slug: 1 }, { unique: true })
countrySchema.index({ isActive: 1, order: 1, slug: 1 })

export const Country = mongoose.model<CountryDoc>('Country', countrySchema)
