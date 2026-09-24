import mongoose, { Schema, type Types } from 'mongoose'

export type MessageDoc = {
  conversation: Types.ObjectId
  senderUid: string
  body: string
  createdAt: Date
  updatedAt: Date
}

const messageSchema = new Schema<MessageDoc>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderUid: { type: String, required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: true },
)

messageSchema.index({ conversation: 1, createdAt: -1 })

export const Message = mongoose.model<MessageDoc>('Message', messageSchema)
