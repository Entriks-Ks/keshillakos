import mongoose, { Schema } from 'mongoose'
import { CATALOG_OPTION_GROUPS, type CatalogOptionGroup } from '../data/serviceOptions'

export type CatalogOptionDoc = {
  group: CatalogOptionGroup
  name: { sq: string; en: string }
  slug: string
  order: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const catalogOptionSchema = new Schema<CatalogOptionDoc>({
  group: { type: String, required: true, enum: CATALOG_OPTION_GROUPS },
  name: {
    sq: { type: String, required: true, trim: true },
    en: { type: String, required: true, trim: true },
  },
  slug: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  order: { type: Number, required: true, min: 1, validate: Number.isInteger },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

catalogOptionSchema.index({ group: 1, slug: 1 }, { unique: true })
catalogOptionSchema.index({ group: 1, isActive: 1, order: 1, slug: 1 })

export const CatalogOption = mongoose.model<CatalogOptionDoc>('CatalogOption', catalogOptionSchema)
