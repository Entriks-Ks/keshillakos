import mongoose, { Schema, type Document, Types } from 'mongoose'

export interface CommunityCommentDoc extends Document {
  postId: Types.ObjectId
  authorUid: string
  authorName: string
  authorRole: string
  authorPhoto?: string
  content: string
  suggestedPrice?: string
  suggestedProviderUid?: string
  suggestedProviderName?: string
  likes: string[]
  createdAt: Date
  updatedAt: Date
}

const communityCommentSchema = new Schema<CommunityCommentDoc>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'CommunityPost', required: true, index: true },
    authorUid: { type: String, required: true, index: true },
    authorName: { type: String, required: true, trim: true },
    authorRole: { type: String, default: 'user' },
    authorPhoto: { type: String, default: '' },
    content: { type: String, required: true, trim: true, minlength: 2, maxlength: 2000 },
    suggestedPrice: { type: String, trim: true, default: '' },
    suggestedProviderUid: { type: String, trim: true, default: '' },
    suggestedProviderName: { type: String, trim: true, default: '' },
    likes: { type: [String], default: [] },
  },
  { timestamps: true },
)

communityCommentSchema.index({ postId: 1, createdAt: 1 })

export const CommunityComment = mongoose.model<CommunityCommentDoc>('CommunityComment', communityCommentSchema)
