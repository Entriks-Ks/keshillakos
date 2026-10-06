import { notifyAdmins } from './notificationService'
import { queryPage, type PaginationInput } from './pagination'
import { PlatformFeedback, type PlatformFeedbackStatus } from '../models/PlatformFeedback'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type FeedbackInput = {
  message?: unknown
  name?: unknown
  email?: unknown
  userUid?: string
  userName?: string
  userEmail?: string
}

export function normalizeFeedbackInput(input: FeedbackInput) {
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  const providedName = typeof input.name === 'string' ? input.name.trim() : ''
  const providedEmail = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const name = providedName || input.userName?.trim() || ''
  const email = providedEmail || input.userEmail?.trim().toLowerCase() || ''

  if (message.length < 5) {
    throw new Error('Shkruaj të paktën 5 karaktere.')
  }
  if (message.length > 1000) {
    throw new Error('Feedback-u është shumë i gjatë.')
  }
  if (name.length > 80) {
    throw new Error('Emri është shumë i gjatë.')
  }
  if (email && !EMAIL_RE.test(email)) {
    throw new Error('Email-i nuk është i vlefshëm.')
  }
  if (!email) {
    throw new Error('Email-i është i nevojshëm që admini të të përgjigjet.')
  }

  return {
    message,
    name,
    email,
    userUid: input.userUid?.trim() || '',
  }
}

export async function createPlatformFeedback(input: FeedbackInput) {
  const data = normalizeFeedbackInput(input)
  const doc = await PlatformFeedback.create(data)
  await notifyAdmins({ type: 'feedback:new', title: 'Feedback i ri', href: '/dashboard/admin/feedback', eventKey: `feedback:${doc._id}`, actorUid: input.userUid })
  return toFeedbackItem(doc)
}

export async function listPlatformFeedback(input: PaginationInput = { page: 1, limit: 20 }) {
  const result = await queryPage(input, () => PlatformFeedback.countDocuments(), (skip, limit) => PlatformFeedback.find().sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean())
  return Object.assign(result.items.map(toFeedbackItem), { pagination: result.pagination, unreadTotal: await PlatformFeedback.countDocuments({ status: "new" }) })
}

export async function markPlatformFeedbackRead(id: string) {
  const doc = await PlatformFeedback.findByIdAndUpdate(
    id,
    { status: 'read' satisfies PlatformFeedbackStatus },
    { new: true },
  ).lean()
  if (!doc) return null
  return toFeedbackItem(doc)
}

function toFeedbackItem(doc: {
  _id?: { toString(): string }
  id?: string
  message: string
  name: string
  email: string
  userUid: string
  status: PlatformFeedbackStatus
  createdAt?: Date
}) {
  return {
    id: doc._id ? doc._id.toString() : doc.id || '',
    message: doc.message,
    name: doc.name,
    email: doc.email,
    userUid: doc.userUid,
    status: doc.status,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
  }
}
