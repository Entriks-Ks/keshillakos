import mongoose, { Schema } from 'mongoose'

export type PlatformFeedbackStatus = 'new' | 'read'

export type PlatformFeedbackDoc = {
  message: string
  name: string
  email: string
  userUid: string
  status: PlatformFeedbackStatus
  chatReport?: { conversationId: string; reportedUid: string; reason: string; reviewStatus?: 'new' | 'reviewing' | 'resolved' | 'dismissed' | 'rejected'; adminNote?: string; reviewedBy?: string; reviewedAt?: Date }
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
    chatReport: { type: new Schema({ conversationId: { type: String, required: true }, reportedUid: { type: String, required: true }, reason: { type: String, required: true, maxlength: 500 }, reviewStatus: { type: String, enum: ['new', 'reviewing', 'resolved', 'dismissed', 'rejected'] }, adminNote: { type: String, maxlength: 1000 }, reviewedBy: String, reviewedAt: Date }, { _id: false }), default: undefined },
  },
  { timestamps: true },
)

platformFeedbackSchema.index({ userUid: 1, 'chatReport.conversationId': 1 }, { unique: true, partialFilterExpression: { status: 'new', 'chatReport.conversationId': { $exists: true } } })
platformFeedbackSchema.index({ 'chatReport.reviewStatus': 1, createdAt: -1 }, { partialFilterExpression: { chatReport: { $exists: true } } })

export const PlatformFeedback = mongoose.model<PlatformFeedbackDoc>('PlatformFeedback', platformFeedbackSchema)
