import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import { cancelAppointment, listMyAppointments, listProviderAppointments } from '../services/appointmentService'

const router = Router()

router.get('/mine', requireAuth, async (req, res) => {
  try { return res.json({ appointments: await listMyAppointments(req.user!.uid) }) }
  catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Rezervimet nuk u ngarkuan' }) }
})

router.get('/provider', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try { return res.json({ appointments: await listProviderAppointments(req.user!.uid) }) }
  catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Rezervimet nuk u ngarkuan' }) }
})

router.patch('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { reason } = req.body as { reason?: string }
    const appointment = await cancelAppointment(req.user!.uid, String(req.params.id), reason, req.user!.roles.includes('admin'))
    return res.json({ appointment })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Anulimi dështoi' }) }
})

export default router
