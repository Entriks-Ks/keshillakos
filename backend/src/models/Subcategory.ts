import mongoose, { Schema, Types } from 'mongoose'

export type SubcategoryDoc = {
  categoryId: Types.ObjectId
  name: { sq: string; en: string }
  slug: string
  order: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const subcategorySchema = new Schema<SubcategoryDoc>({
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  name: {
    sq: { type: String, required: true, trim: true },
    en: { type: String, required: true, trim: true },
  },
  slug: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

subcategorySchema.index({ categoryId: 1, slug: 1 }, { unique: true })
subcategorySchema.index({ categoryId: 1, isActive: 1, order: 1 })
subcategorySchema.index({ slug: 1, isActive: 1 })

export const Subcategory = mongoose.model<SubcategoryDoc>('Subcategory', subcategorySchema)
