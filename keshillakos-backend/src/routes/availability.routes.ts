import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  listMyAvailability,
  listOpenAvailabilityForProvider,
  listScheduleForProvider,
} from '../services/availabilityService'

const router = Router()

router.get('/provider/:uid', async (req, res) => {
  try {
    const uid = String(req.params.uid || '').trim()
    if (!uid) return res.status(400).json({ message: 'Mungon ofruesi' })
    const view = typeof req.query.view === 'string' ? req.query.view : 'open'
    if (view === 'schedule') {
      const schedule = await listScheduleForProvider(uid)
      return res.json(schedule)
    }
    const slots = await listOpenAvailabilityForProvider(uid)
    return res.json({ slots })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan oraret',
    })
  }
})

router.get('/mine', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try {
    const slots = await listMyAvailability(req.user!.uid)
    return res.json({ slots })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan oraret',
    })
  }
})

router.post('/', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try {
    const { startAt, endAt, note } = req.body as {
      startAt?: string
      endAt?: string
      note?: string
    }

    if (!startAt || !endAt) {
      return res.status(400).json({ message: 'Data dhe ora janë të detyrueshme' })
    }

    const slot = await createAvailabilitySlot({
      providerUid: req.user!.uid,
      providerName: req.user!.name,
      startAt,
      endAt,
      note,
    })

    return res.status(201).json({ slot })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Shtimi i orarit dështoi',
    })
  }
})

router.delete('/:id', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try {
    const result = await deleteAvailabilitySlot({
      id: String(req.params.id),
      providerUid: req.user!.uid,
      asAdmin: req.user!.role === 'admin',
    })
    return res.json(result)
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Fshirja e orarit dështoi',
    })
  }
})

export default router
