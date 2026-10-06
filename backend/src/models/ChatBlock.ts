import mongoose, { Schema } from 'mongoose'

const schema = new Schema({
  blockerUid: { type: String, required: true },
  blockedUid: { type: String, required: true },
}, { timestamps: true })
schema.index({ blockerUid: 1, blockedUid: 1 }, { unique: true })
schema.index({ blockedUid: 1, blockerUid: 1 })
export const ChatBlock = mongoose.model('ChatBlock', schema)
