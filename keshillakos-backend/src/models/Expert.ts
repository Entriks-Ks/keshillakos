import mongoose, { Schema } from 'mongoose'

export type ExpertDoc = {
  name: string
  title: string
  categoryId: string
  categoryLabel: string
  specialty: string
  bio: string
  location: string
  licenseNumber?: string
  licenseVerified: boolean
  languageFrom?: string
  languageTo?: string
  deliveryModes?: Array<'online' | 'physical' | 'group'>
  crossBorder?: boolean
  companyUid: string
  companyName: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const expertSchema = new Schema<ExpertDoc>(
  {
    name: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    categoryId: { type: String, required: true, index: true },
    categoryLabel: { type: String, required: true, trim: true },
    specialty: { type: String, required: true, trim: true, index: true },
    bio: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    licenseNumber: { type: String, trim: true },
    licenseVerified: { type: Boolean, default: false, index: true },
    languageFrom: { type: String, trim: true },
    languageTo: { type: String, trim: true },
    deliveryModes: [{ type: String, enum: ['online', 'physical', 'group'] }],
    crossBorder: { type: Boolean, default: false },
    companyUid: { type: String, required: true, index: true },
    companyName: { type: String, required: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
)

export const Expert = mongoose.model<ExpertDoc>('Expert', expertSchema)
