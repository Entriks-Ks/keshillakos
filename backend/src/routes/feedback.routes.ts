import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  createPlatformFeedback,
  listPlatformFeedback,
  markPlatformFeedbackRead,
} from '../services/platformFeedbackService'

const router = Router()

router.post('/', async (req, res, next) => {
  if (!req.headers.authorization?.startsWith('Bearer ')) return next()
  return requireAuth(req, res, next)
}, async (req, res) => {
  try {
    const item = await createPlatformFeedback({
      message: req.body?.message,
      name: req.body?.name,
      email: req.body?.email,
      userUid: req.user?.uid,
      userName: req.user?.name,
      userEmail: req.user?.email,
    })
    return res.status(201).json({ feedback: item })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Feedback-u nuk u dërgua'
    const status = /karaktere|gjatë|vlefshëm|nevojshëm/.test(message) ? 400 : 500
    return res.status(status).json({ message })
  }
})

router.get('/', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    return res.json({ feedback: await listPlatformFeedback() })
  } catch (err) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Feedback-u nuk u ngarkua' })
  }
})

router.patch('/:id/read', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = String(req.params.id)
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Feedback i pavlefshëm' })
    }
    const item = await markPlatformFeedbackRead(id)
    if (!item) return res.status(404).json({ message: 'Feedback-u nuk u gjet' })
    return res.json({ feedback: item })
  } catch (err) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Nuk u shënua si i lexuar' })
  }
})

export default router
