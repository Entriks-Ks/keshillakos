import mongoose, { Schema, type Types } from 'mongoose'

export type MessageDoc = {
  conversation: Types.ObjectId
  senderUid: string
  body: string
  editedAt?: Date | null
  deletedAt?: Date | null
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
    body: {
      type: String,
      required: function (this: { deletedAt?: Date | null }) { return !this.deletedAt },
      trim: true,
      maxlength: 4000,
      default: '',
    },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

messageSchema.index({ conversation: 1, createdAt: -1 })

export const Message = mongoose.model<MessageDoc>('Message', messageSchema)
