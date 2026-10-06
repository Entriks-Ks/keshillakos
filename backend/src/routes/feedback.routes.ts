import { paginationInput, validatePagination } from '../services/pagination'
import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  createPlatformFeedback,
  listPlatformFeedback,
  markPlatformFeedbackRead,
} from '../services/platformFeedbackService'
import { listUserReports, reportListOptions, reportConversationEvidence, reportRequestEvidence, updateReportStatus, userReportDetails } from '../services/adminReportService'

const router = Router()
router.use(validatePagination)

router.get('/reports', requireAuth, requireRole('admin'), async (req, res) => {
  try { const reports = await listUserReports(paginationInput(req.query, 20), reportListOptions(req.query)); return res.json({ reports, pagination: reports.pagination, summary: reports.summary }) }
  catch (error) { return res.status((error as { status?: number }).status || 500).json({ message: 'Raportimet nuk u ngarkuan' }) }
})
router.get('/reports/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = String(req.params.id)
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Raportimi është i pavlefshëm' })
  try { const report = await userReportDetails(id); return report ? res.json({ report }) : res.status(404).json({ message: 'Raportimi nuk u gjet' }) }
  catch (error) { return res.status((error as { status?: number }).status || 500).json({ message: 'Raportimi nuk u ngarkua' }) }
})
router.patch('/reports/:id/status', requireAuth, requireRole('admin'), async (req, res) => {
  const id = String(req.params.id)
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Raportimi është i pavlefshëm' })
    try { return res.json({ report: await updateReportStatus(id, req.body?.status, req.user!.uid, req.body?.note) }) }
  catch (error) { const status = (error as { status?: number }).status || 500; return res.status(status).json({ message: status === 500 ? 'Statusi i raportimit nuk u ruajt' : (error as Error).message }) }
})

router.get('/reports/:id/conversation', requireAuth, requireRole('admin'), async (req, res) => {
  const id = String(req.params.id)
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Raportimi është i pavlefshëm' })
  try { const messages = await reportConversationEvidence(id, paginationInput(req.query, 30), typeof req.query.before === 'string' ? req.query.before : undefined, typeof req.query.beforeId === 'string' ? req.query.beforeId : undefined); return res.json({ messages, pagination: messages.pagination }) }
  catch (error) { return res.status((error as { status?: number }).status || 500).json({ message: 'Biseda nuk është e disponueshme për shqyrtim' }) }
})
router.get('/reports/:id/request', requireAuth, requireRole('admin'), async (req, res) => {
  const id = String(req.params.id)
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Raportimi është i pavlefshëm' })
  try { return res.json({ request: await reportRequestEvidence(id) }) }
  catch (error) { return res.status((error as { status?: number }).status || 500).json({ message: 'Nuk ka kërkesë të lidhur të konfirmuar' }) }
})

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

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const feedback = await listPlatformFeedback(paginationInput(req.query, 20)); return res.json({ feedback, pagination: feedback.pagination, unreadTotal: feedback.unreadTotal })
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
