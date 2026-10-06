import mongoose, { Schema } from 'mongoose'

export type ConversationDoc = {
  seekerUid: string
  providerUid: string
  serviceId?: string
  serviceTitle?: string
  requestDeliveryId?: mongoose.Types.ObjectId
  lastMessageAt?: Date
  lastMessagePreview?: string
  seekerUnread: number
  providerUnread: number
  createdAt: Date
  updatedAt: Date
}

const conversationSchema = new Schema<ConversationDoc>(
  {
    seekerUid: { type: String, required: true, index: true },
    providerUid: { type: String, required: true, index: true },
    serviceId: { type: String, default: '' },
    serviceTitle: { type: String, default: '' },
    requestDeliveryId: { type: Schema.Types.ObjectId, ref: 'RequestDelivery' },
    lastMessageAt: { type: Date },
    lastMessagePreview: { type: String, default: '' },
    seekerUnread: { type: Number, default: 0 },
    providerUnread: { type: Number, default: 0 },
  },
  { timestamps: true },
)

conversationSchema.index({ seekerUid: 1, providerUid: 1 }, { unique: true })

export const Conversation = mongoose.model<ConversationDoc>('Conversation', conversationSchema)
