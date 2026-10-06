import { paginationInput, validatePagination } from '../services/pagination'
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import { cancelAppointment, listMyAppointments, listProviderAppointments } from '../services/appointmentService'

const router = Router()
router.use(validatePagination)

router.get('/mine', requireAuth, async (req, res) => {
  try { const appointments = await listMyAppointments(req.user!.uid, paginationInput(req.query, 20), req.query.upcoming === "true"); return res.json({ appointments, pagination: appointments.pagination, summary: appointments.summary }) }
  catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Rezervimet nuk u ngarkuan' }) }
})

router.get('/provider', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try { const appointments = await listProviderAppointments(req.user!.uid, paginationInput(req.query, 20), req.query.upcoming === "true"); return res.json({ appointments, pagination: appointments.pagination, summary: appointments.summary }) }
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
