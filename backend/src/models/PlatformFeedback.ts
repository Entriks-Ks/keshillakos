import mongoose, { Schema } from 'mongoose'

export type PlatformFeedbackStatus = 'new' | 'read'

export type PlatformFeedbackDoc = {
  message: string
  name: string
  email: string
  userUid: string
  status: PlatformFeedbackStatus
  createdAt: Date
  updatedAt: Date
}

const platformFeedbackSchema = new Schema<PlatformFeedbackDoc>(
  {
    message: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    name: { type: String, trim: true, maxlength: 80, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
    userUid: { type: String, trim: true, default: '', index: true },
    status: { type: String, enum: ['new', 'read'], default: 'new', index: true },
  },
  { timestamps: true },
)

export const PlatformFeedback = mongoose.model<PlatformFeedbackDoc>('PlatformFeedback', platformFeedbackSchema)
