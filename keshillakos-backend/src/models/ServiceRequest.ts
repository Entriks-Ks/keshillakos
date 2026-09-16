import mongoose, { Schema } from 'mongoose'

export const REQUEST_STATUSES = ['pending', 'accepted', 'rejected', 'completed'] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export const CONTACT_METHODS = ['chat', 'phone', 'email'] as const
export type ContactMethod = (typeof CONTACT_METHODS)[number]

export type ServiceRequestDoc = {
  seekerUid: string
  seekerName: string
  seekerEmail: string
  providerUid: string
  providerName: string
  serviceId?: string
  serviceTitle?: string
  need: string
  message: string
  location?: string
  language?: string
  urgency?: string
  contactMethod: ContactMethod
  status: RequestStatus
  providerNote?: string
  slotId?: string
  requestedStartAt?: Date
  requestedEndAt?: Date
  createdAt: Date
  updatedAt: Date
}

const serviceRequestSchema = new Schema<ServiceRequestDoc>(
  {
    seekerUid: { type: String, required: true, index: true },
    seekerName: { type: String, required: true },
    seekerEmail: { type: String, required: true },
    providerUid: { type: String, required: true, index: true },
    providerName: { type: String, required: true },
    serviceId: { type: String },
    serviceTitle: { type: String },
    need: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    location: { type: String },
    language: { type: String },
    urgency: { type: String },
    contactMethod: {
      type: String,
      enum: CONTACT_METHODS,
      required: true,
    },
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: 'pending',
      index: true,
    },
    providerNote: { type: String, trim: true },
    slotId: { type: String, index: true },
    requestedStartAt: { type: Date },
    requestedEndAt: { type: Date },
  },
  { timestamps: true },
)

export const ServiceRequest = mongoose.model<ServiceRequestDoc>(
  'ServiceRequest',
  serviceRequestSchema,
)
