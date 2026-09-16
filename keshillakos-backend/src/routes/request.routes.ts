import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  CONTACT_METHODS,
  REQUEST_STATUSES,
  type ContactMethod,
  type RequestStatus,
} from '../models/ServiceRequest'
import {
  countPendingForProvider,
  createServiceRequest,
  listAllRequests,
  listRequestsByProvider,
  listRequestsBySeeker,
  updateRequestStatus,
} from '../services/requestService'

const router = Router()

router.post('/', requireAuth, requireRole('user', 'admin'), async (req, res) => {
  try {
    const {
      providerUid,
      providerName,
      serviceId,
      serviceTitle,
      need,
      message,
      location,
      language,
      urgency,
      contactMethod,
      slotId,
    } = req.body as {
      providerUid?: string
      providerName?: string
      serviceId?: string
      serviceTitle?: string
      need?: string
      message?: string
      location?: string
      language?: string
      urgency?: string
      contactMethod?: string
      slotId?: string
    }

    if (!providerUid?.trim() || !providerName?.trim()) {
      return res.status(400).json({ message: 'Ofruesi është i detyrueshëm' })
    }
    if (!need?.trim() || !message?.trim()) {
      return res.status(400).json({ message: 'Nevoja dhe mesazhi janë të detyrueshme' })
    }
    if (!contactMethod || !CONTACT_METHODS.includes(contactMethod as ContactMethod)) {
      return res.status(400).json({ message: 'Zgjidh mënyrën e kontaktit' })
    }

    const request = await createServiceRequest({
      seekerUid: req.user!.uid,
      seekerName: req.user!.name,
      seekerEmail: req.user!.email,
      providerUid: providerUid.trim(),
      providerName: providerName.trim(),
      serviceId,
      serviceTitle,
      need,
      message,
      location,
      language,
      urgency,
      contactMethod: contactMethod as ContactMethod,
      slotId,
    })

    return res.status(201).json({ request })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Dërgimi i kërkesës dështoi',
    })
  }
})

router.get('/mine', requireAuth, requireRole('user', 'admin'), async (req, res) => {
  try {
    const requests = await listRequestsBySeeker(req.user!.uid)
    return res.json({ requests })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan kërkesat',
    })
  }
})

router.get('/inbox', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try {
    const [requests, pendingCount] = await Promise.all([
      listRequestsByProvider(req.user!.uid),
      countPendingForProvider(req.user!.uid),
    ])
    return res.json({ requests, pendingCount })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkua inbox-i',
    })
  }
})

router.get('/all', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const requests = await listAllRequests()
    return res.json({ requests })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan kërkesat',
    })
  }
})

router.patch('/:id/status', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try {
    const { status, providerNote } = req.body as {
      status?: string
      providerNote?: string
    }

    if (!status || !REQUEST_STATUSES.includes(status as RequestStatus)) {
      return res.status(400).json({ message: 'Status i pavlefshëm' })
    }

    const request = await updateRequestStatus({
      id: String(req.params.id),
      providerUid: req.user!.uid,
      status: status as RequestStatus,
      providerNote,
      asAdmin: req.user!.role === 'admin',
    })

    return res.json({ request })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Përditësimi dështoi',
    })
  }
})

export default router
