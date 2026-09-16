import mongoose, { Schema } from 'mongoose'
import { ROLES, type UserRole } from '../types/roles'

export type UserDoc = {
  uid: string
  email: string
  name: string
  role: UserRole
  headline?: string
  bio?: string
  location?: string
  skills: string[]
  languages: string[]
  profilePhoto?: string
  createdAt: Date
}

const userSchema = new Schema<UserDoc>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ROLES,
      required: true,
      default: 'user',
      index: true,
    },
    headline: { type: String, default: '' },
    bio: { type: String, default: '' },
    location: { type: String, default: '' },
    skills: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    profilePhoto: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
)

export const User = mongoose.model<UserDoc>('User', userSchema)
