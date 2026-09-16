import mongoose, { Schema } from 'mongoose'

export type ServiceDetails = {
  licenseNumber?: string
  licenseVerified?: boolean
  documentsNote?: string
  deadlineNote?: string
  serviceTypeDetail?: string
  audience?: 'b2c' | 'b2b' | 'both'
  deliveryModes?: Array<'online' | 'physical' | 'group'>
  languageFrom?: string
  languageTo?: string
  certifiedTranslation?: boolean
  offerType?: 'package' | 'project' | 'service'
  priceTo?: number
  portfolioUrl?: string
  references?: string
  regulatoryNotice?: string
  coachingDisclaimerAccepted?: boolean
  crossBorder?: boolean
  supportLanguages?: string[]
}

export type ServiceDoc = {
  title: string
  description: string
  categoryId: string
  categoryLabel: string
  subcategory: string
  location: string
  priceFrom?: number
  details: ServiceDetails
  providerUid: string
  providerName: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const serviceSchema = new Schema<ServiceDoc>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    categoryId: { type: String, required: true, index: true },
    categoryLabel: { type: String, required: true, trim: true },
    subcategory: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    priceFrom: { type: Number, min: 0 },
    details: {
      type: new Schema(
        {
          licenseNumber: String,
          licenseVerified: { type: Boolean, default: false },
          documentsNote: String,
          deadlineNote: String,
          serviceTypeDetail: String,
          audience: { type: String, enum: ['b2c', 'b2b', 'both'] },
          deliveryModes: [{ type: String, enum: ['online', 'physical', 'group'] }],
          languageFrom: String,
          languageTo: String,
          certifiedTranslation: Boolean,
          offerType: { type: String, enum: ['package', 'project', 'service'] },
          priceTo: { type: Number, min: 0 },
          portfolioUrl: String,
          references: String,
          regulatoryNotice: String,
          coachingDisclaimerAccepted: Boolean,
          crossBorder: Boolean,
          supportLanguages: [String],
        },
        { _id: false },
      ),
      default: {},
    },
    providerUid: { type: String, required: true, index: true },
    providerName: { type: String, required: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
)

export const Service = mongoose.model<ServiceDoc>('Service', serviceSchema)
