import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import type { ServiceOfferDoc } from '../models/ServiceOffer'
import type { Location } from '../models/location'
import { createServiceOffer, listMyServiceOffers, listPublishedServiceOffers, reviewServiceOffer, toPublicServiceOffer, updateServiceOffer } from '../services/serviceOfferService'

const router = Router()

router.get('/', async (_req, res) => {
  try { return res.json({ offers: (await listPublishedServiceOffers()).map(toPublicServiceOffer) }) }
  catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Shërbimet nuk u ngarkuan' }) }
})

router.get('/mine', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try { return res.json({ offers: await listMyServiceOffers(req.user!.uid) }) }
  catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Shërbimet nuk u ngarkuan' }) }
})

router.post('/', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try {
    const body = req.body as {
      providerId?: string; portal?: string; categoryId?: string; name?: string; subtitle?: string
      description?: string; price?: ServiceOfferDoc['price']; durationMinutes?: number
      formats?: ServiceOfferDoc['formats']; modes?: ServiceOfferDoc['modes']; languages?: string[]
      serviceAreas?: Location[]; availabilityMode?: ServiceOfferDoc['availabilityMode']
      visibility?: ServiceOfferDoc['visibility']; extensions?: Record<string, unknown>
    }
    if (!body.providerId || !body.categoryId || !body.name?.trim() || !body.description?.trim() || !body.price?.model) {
      return res.status(400).json({ message: 'Profili, kategoria, emri, përshkrimi dhe çmimi janë të detyrueshme' })
    }
    const offer = await createServiceOffer({
      ownerUid: req.user!.uid, providerId: body.providerId, portal: body.portal,
      categoryId: body.categoryId, name: body.name, subtitle: body.subtitle,
      description: body.description, price: body.price, durationMinutes: body.durationMinutes,
      formats: body.formats, modes: body.modes, languages: body.languages,
      serviceAreas: body.serviceAreas, availabilityMode: body.availabilityMode,
      visibility: body.visibility, extensions: body.extensions,
    })
    return res.status(201).json({ offer })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Shërbimi nuk u krijua' }) }
})

router.patch('/:id', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try {
    const body = req.body as Partial<ServiceOfferDoc>
    const offer = await updateServiceOffer(req.user!.uid, String(req.params.id), {
      name: body.name, subtitle: body.subtitle, description: body.description,
      price: body.price, durationMinutes: body.durationMinutes, formats: body.formats,
      modes: body.modes, languages: body.languages, serviceAreas: body.serviceAreas,
      availabilityMode: body.availabilityMode, visibility: body.visibility, extensions: body.extensions,
    })
    return res.json({ offer })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Shërbimi nuk u përditësua' }) }
})

router.patch('/:id/review', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { decision } = req.body as { decision?: 'approved' | 'rejected' }
    if (decision !== 'approved' && decision !== 'rejected') return res.status(400).json({ message: 'Vendimi nuk është i vlefshëm' })
    const offer = await reviewServiceOffer(String(req.params.id), req.user!.uid, decision)
    return res.json({ offer })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Moderimi dështoi' }) }
})

export default router
