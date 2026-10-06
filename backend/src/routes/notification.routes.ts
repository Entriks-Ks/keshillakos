import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { notificationHistory, markRead, unreadCount } from '../services/notificationService'
const router = Router()
router.use(requireAuth, (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next() })
router.get('/', async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1)
    if (!Number.isInteger(page) || page < 1 || page > 10000) return res.status(400).json({ message: 'Faqe e pavlefshme' })
    res.json(await notificationHistory(req.user!.uid, page))
  } catch (error) { next(error) }
})
router.get('/unread-count', async (req, res, next) => {
  try { res.json({ unreadCount: await unreadCount(req.user!.uid) }) } catch (error) { next(error) }
})
router.patch('/read-all', async (req, res, next) => {
  try { res.json(await markRead(req.user!.uid)) } catch (error) { next(error) }
})
router.patch('/:id/read', async (req, res, next) => {
  try { res.json(await markRead(req.user!.uid, String(req.params.id))) } catch (error) { res.status(400).json({ message: error instanceof Error ? error.message : 'Gabim' }) }
})
export default router
