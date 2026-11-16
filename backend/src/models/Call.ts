import mongoose, { Schema, type Types } from 'mongoose'

export type CallType = 'video' | 'audio'
export type CallStatus =
  | 'ringing'
  | 'accepted'
  | 'rejected'
  | 'missed'
  | 'busy'
  | 'timeout'
  | 'completed'

export type CallDoc = {
  callerId: string
  receiverId: string
  conversationId: Types.ObjectId | string
  roomName: string
  callType: CallType
  status: CallStatus
  startedAt: Date
  answeredAt?: Date | null
  endedAt?: Date | null
  duration?: number
  createdAt: Date
  updatedAt: Date
}

const callSchema = new Schema<CallDoc>(
  {
    callerId: {
      type: String,
      required: true,
      index: true,
    },
    receiverId: {
      type: String,
      required: true,
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    roomName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    callType: {
      type: String,
      enum: ['video', 'audio'],
      required: true,
      default: 'video',
    },
    status: {
      type: String,
      enum: ['ringing', 'accepted', 'rejected', 'missed', 'busy', 'timeout', 'completed'],
      required: true,
      default: 'ringing',
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

callSchema.index({ callerId: 1, createdAt: -1 })
callSchema.index({ receiverId: 1, createdAt: -1 })
callSchema.index({ conversationId: 1, createdAt: -1 })

export const Call = mongoose.model<CallDoc>('Call', callSchema)
