import { Router } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth'
import type { Location } from '../models/location'
import { createProviderProfile, listMyProviderProfiles, listPublishedProviderProfiles, moderateProviderProfile, toPublicProvider, updateProviderProfile } from '../services/providerProfileService'

const router = Router()
const locationInput = z.object({
  countryId: z.string().refine(Types.ObjectId.isValid, 'Invalid country ID'),
  cityId: z.string().refine(Types.ObjectId.isValid, 'Invalid city ID'),
})
const areaInput = z.array(z.string().refine(Types.ObjectId.isValid, 'Invalid city ID')).max(200)

router.get('/', async (_req, res) => {
  try { return res.json({ providers: (await listPublishedProviderProfiles()).map(toPublicProvider) }) }
  catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Profilet nuk u ngarkuan' }) }
})

router.get('/mine', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try { return res.json({ providers: await listMyProviderProfiles(req.user!.uid) }) }
  catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Profilet nuk u ngarkuan' }) }
})

router.post('/', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try {
    const body = req.body as {
      providerType?: 'individual' | 'business'; businessId?: string; categories?: string[]
      languages?: string[]; locations?: Location[]; serviceAreas?: Location[]
      modes?: Array<'online' | 'on_site'>
      publicProfile?: { displayName?: string; title?: string; shortDescription?: string; description?: string; photoUrl?: string; publicEmail?: string; publicPhone?: string }
    }
    if (!['individual', 'business'].includes(body.providerType || '') || !Array.isArray(body.categories) || !body.publicProfile?.displayName?.trim()) {
      return res.status(400).json({ message: 'Lloji, emri dhe kategoritë janë të detyrueshme' })
    }
    const locationFields = z.object({ location: locationInput.optional(), serviceAreaCityIds: areaInput.optional() }).parse(body)
    const provider = await createProviderProfile({
      ownerUid: req.user!.uid,
      providerType: body.providerType!,
      businessId: body.businessId,
      categories: body.categories,
      languages: body.languages,
      locations: body.locations,
      serviceAreas: body.serviceAreas,
      ...locationFields,
      modes: body.modes,
      publicProfile: { ...body.publicProfile, displayName: body.publicProfile.displayName },
    })
    return res.status(201).json({ provider })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Profili nuk u krijua' }) }
})

router.patch('/:id', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try {
    const { categories, languages, locations, serviceAreas, modes, publicProfile } = req.body as {
      categories?: string[]; languages?: string[]; locations?: Location[]; serviceAreas?: Location[]
      modes?: Array<'online' | 'on_site'>; publicProfile?: { displayName: string; title?: string; shortDescription?: string; description?: string; photoUrl?: string; publicEmail?: string; publicPhone?: string }
    }
    if ([categories, languages, locations, serviceAreas, modes].some((value) => value !== undefined && !Array.isArray(value))) {
      return res.status(400).json({ message: 'Lista nuk është e vlefshme' })
    }
    const locationFields = z.object({ location: locationInput.nullable().optional(), serviceAreaCityIds: areaInput.optional() }).parse(req.body)
    const provider = await updateProviderProfile(req.user!.uid, String(req.params.id), { categories, languages, locations, serviceAreas, modes, publicProfile, ...locationFields })
    return res.json({ provider })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Profili nuk u përditësua' }) }
})

router.patch('/:id/moderation', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { decision, reason } = req.body as { decision?: 'approved' | 'rejected'; reason?: string }
    if (decision !== 'approved' && decision !== 'rejected') return res.status(400).json({ message: 'Vendimi nuk është i vlefshëm' })
    const provider = await moderateProviderProfile(String(req.params.id), req.user!.uid, decision, reason)
    return res.json({ provider })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Moderimi dështoi' }) }
})

export default router
