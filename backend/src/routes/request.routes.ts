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
  listAllRequests,
  listRequestsByProvider,
  listRequestsBySeeker,
  updateRequestStatus,
} from '../services/requestService'
import { RequestDelivery, DELIVERY_STATUSES, type DeliveryStatus } from '../models/RequestDelivery'
import { createUserRequest, sendExistingRequest, updateUserRequestLifecycle, listMyUserRequests, listProviderDeliveries, listAllUserRequests, updateDeliveryStatus, countPendingDeliveries } from '../services/userRequestService'

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
      providerId,
      providerIds,
      categoryId,
      locationDetail,
      budget,
      preferredMode,
      portal,
      draft,
    } = req.body as {
      providerId?: string
      providerIds?: string[]
      categoryId?: string
      locationDetail?: import('../models/location').Location
      budget?: import('../models/UserRequest').UserRequestDoc['budget']
      preferredMode?: import('../models/UserRequest').UserRequestDoc['preferredMode']
      portal?: string
      draft?: boolean
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

    if (!draft && !providerUid?.trim() && !providerId && !providerIds?.length) {
      return res.status(400).json({ message: 'Ofruesi është i detyrueshëm' })
    }
    if (!need?.trim() || !message?.trim()) {
      return res.status(400).json({ message: 'Nevoja dhe mesazhi janë të detyrueshme' })
    }
    if (!contactMethod || !CONTACT_METHODS.includes(contactMethod as ContactMethod)) {
      return res.status(400).json({ message: 'Zgjidh mënyrën e kontaktit' })
    }

    const created = await createUserRequest({
      uid: req.user!.uid, providerIds: providerIds ?? (providerId ? [providerId] : undefined),
      providerUid: providerUid?.trim(), categoryId, serviceId,
      problem: need, description: message,
      location: locationDetail, legacyLocation: location,
      language, urgency: urgency as import('../models/UserRequest').UserRequestDoc['urgency'],
      budget, preferredMode, contactPreference: contactMethod as ContactMethod,
      portal, slotId, draft,
    })
    const request = (await listMyUserRequests(req.user!.uid)).find((item) => item.requestId === String(created.request._id))

    return res.status(201).json({ request })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Dërgimi i kërkesës dështoi',
    })
  }
})

router.get('/mine', requireAuth, requireRole('user', 'admin'), async (req, res) => {
  try {
    const [canonical, legacy] = await Promise.all([listMyUserRequests(req.user!.uid), listRequestsBySeeker(req.user!.uid)])
    const requests = [...canonical, ...legacy]
    return res.json({ requests })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan kërkesat',
    })
  }
})

router.get('/inbox', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try {
    const [canonical, legacy, canonicalPending, legacyPending] = await Promise.all([
      listProviderDeliveries(req.user!.uid), listRequestsByProvider(req.user!.uid),
      countPendingDeliveries(req.user!.uid), countPendingForProvider(req.user!.uid),
    ])
    const requests = [...canonical, ...legacy]
    const pendingCount = canonicalPending + legacyPending
    return res.json({ requests, pendingCount })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkua inbox-i',
    })
  }
})

router.get('/all', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const [canonical, legacy] = await Promise.all([listAllUserRequests(), listAllRequests()])
    const requests = [...canonical, ...legacy]
    return res.json({ requests })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan kërkesat',
    })
  }
})

router.post('/:id/deliver', requireAuth, requireRole('user', 'admin'), async (req, res) => {
  try {
    const { providerIds } = req.body as { providerIds?: string[] }
    if (!Array.isArray(providerIds) || !providerIds.length) return res.status(400).json({ message: 'Zgjidh të paktën një ofrues' })
    const requests = await sendExistingRequest(req.user!.uid, String(req.params.id), providerIds)
    return res.json({ requests })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Dërgimi dështoi' }) }
})

router.patch('/:id/lifecycle', requireAuth, requireRole('user', 'admin'), async (req, res) => {
  try {
    const { status } = req.body as { status?: 'closed' | 'cancelled' }
    if (status !== 'closed' && status !== 'cancelled') return res.status(400).json({ message: 'Status i pavlefshëm' })
    const requests = await updateUserRequestLifecycle(req.user!.uid, String(req.params.id), status)
    return res.json({ requests })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Përditësimi dështoi' }) }
})

router.patch('/:id/status', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try {
    const { status, providerNote, offer } = req.body as {
      status?: string
      providerNote?: string
      offer?: { description: string; amount?: number; currency?: string }
    }

    if (!status || (!REQUEST_STATUSES.includes(status as RequestStatus) && !DELIVERY_STATUSES.includes(status as DeliveryStatus))) {
      return res.status(400).json({ message: 'Status i pavlefshëm' })
    }
    const id = String(req.params.id)
    const isCanonical = await RequestDelivery.exists({ _id: id })
    const request = isCanonical
      ? await updateDeliveryStatus(req.user!.uid, id, status as DeliveryStatus, providerNote, req.user!.roles.includes('admin'), offer)
      : await updateRequestStatus({ id, providerUid: req.user!.uid, status: status as RequestStatus, providerNote, asAdmin: req.user!.roles.includes('admin') })

    return res.json({ request })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Përditësimi dështoi',
    })
  }
})

export default router
