import mongoose, { Schema } from 'mongoose'

export type CustomCategoryDoc = {
  slug: string
  labelSq: string
  labelDe: string
  examples: string[]
  keywords: string[]
  createdByUid: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const customCategorySchema = new Schema<CustomCategoryDoc>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    labelSq: { type: String, required: true, trim: true },
    labelDe: { type: String, required: true, trim: true },
    examples: { type: [String], default: [] },
    keywords: { type: [String], default: [] },
    createdByUid: { type: String, required: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
)

export const CustomCategory = mongoose.model<CustomCategoryDoc>(
  'CustomCategory',
  customCategorySchema,
)
