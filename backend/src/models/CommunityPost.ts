import mongoose, { Schema, type Document } from 'mongoose'

export type CommunityCategory =
  | 'avokat'
  | 'kontabilitet'
  | 'noter'
  | 'biznes'
  | 'patundshmeri'
  | 'tjeter'

export type CommunityPostStatus = 'open' | 'resolved' | 'closed'

export interface CommunityPostDoc extends Document {
  authorUid: string
  authorName: string
  authorRole: string
  authorPhoto?: string
  title: string
  content: string
  category: CommunityCategory
  city?: string
  budget?: string
  likes: string[]
  commentsCount: number
  status: CommunityPostStatus
  createdAt: Date
  updatedAt: Date
}

const communityPostSchema = new Schema<CommunityPostDoc>(
  {
    authorUid: { type: String, required: true, index: true },
    authorName: { type: String, required: true, trim: true },
    authorRole: { type: String, default: 'user' },
    authorPhoto: { type: String, default: '' },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    content: { type: String, required: true, trim: true, minlength: 10, maxlength: 3000 },
    category: {
      type: String,
      enum: ['avokat', 'kontabilitet', 'noter', 'biznes', 'patundshmeri', 'tjeter'],
      default: 'avokat',
      index: true,
    },
    city: { type: String, trim: true, default: '', index: true },
    budget: { type: String, trim: true, default: '' },
    likes: { type: [String], default: [] },
    commentsCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['open', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
  },
  { timestamps: true },
)

communityPostSchema.index({ createdAt: -1 })
communityPostSchema.index({ category: 1, createdAt: -1 })
communityPostSchema.index({ status: 1, createdAt: -1 })

export const CommunityPost = mongoose.model<CommunityPostDoc>('CommunityPost', communityPostSchema)
