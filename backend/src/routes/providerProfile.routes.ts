import { Router } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth'
import type { Location } from '../models/location'
import {
  profilePhotoUpload,
  requireUploadedImage,
  toPublicUploadPath,
  withImageUpload,
} from '../services/mediaService'
import {
  createProviderProfile,
  listMyProviderProfiles,
  listPublishedProviderProfiles,
  moderateProviderProfile,
  toPublicProvider,
  updateProviderPhoto,
  updateProviderProfile,
} from '../services/providerProfileService'

const router = Router()
const locationInput = z.object({
  countryId: z.string().refine(Types.ObjectId.isValid, 'Invalid country ID'),
  cityId: z.string().refine(Types.ObjectId.isValid, 'Invalid city ID'),
})
const areaInput = z.array(z.string().refine(Types.ObjectId.isValid, 'Invalid city ID')).max(200)

const monthYearInput = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(1950).max(2100),
})

const workExperienceInput = z.array(z.object({
  position: z.string().trim().min(1).max(160),
  organization: z.string().trim().min(1).max(160),
  from: monthYearInput,
  to: monthYearInput.optional(),
  current: z.boolean().optional(),
  description: z.string().trim().max(2000).optional(),
})).max(30)

const educationInput = z.array(z.object({
  institution: z.string().trim().min(1).max(160),
  degree: z.string().trim().min(1).max(160),
  fieldOfStudy: z.string().trim().min(1).max(160),
  from: monthYearInput,
  to: monthYearInput.optional(),
  current: z.boolean().optional(),
})).max(20)

const certificationsInput = z.array(z.object({
  name: z.string().trim().min(1).max(160),
  issuer: z.string().trim().min(1).max(160),
  year: z.number().int().min(1950).max(2100),
  credentialUrl: z.string().trim().max(500).optional(),
})).max(30)

router.get('/', async (_req, res) => {
  try { return res.json({ providers: (await listPublishedProviderProfiles()).map(toPublicProvider) }) }
  catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Profilet nuk u ngarkuan' }) }
})

router.get('/mine', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try { return res.json({ providers: (await listMyProviderProfiles(req.user!.uid)).map(toPublicProvider) }) }
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
    return res.status(201).json({ provider: toPublicProvider(provider) })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Profili nuk u krijua' }) }
})

router.patch('/:id', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try {
    const body = z.object({
      categories: z.array(z.string()).optional(),
      subcategoryIds: z.array(z.string()).optional(),
      languages: z.array(z.string()).optional(),
      locations: z.array(z.any()).optional(),
      serviceAreas: z.array(z.any()).optional(),
      modes: z.array(z.enum(['online', 'on_site'])).optional(),
      experience: z.string().optional(),
      yearsOfExperience: z.number().int().min(0).max(60).nullable().optional(),
      specializations: z.array(z.string()).optional(),
      socialLinks: z.record(z.string(), z.string().optional()).nullable().optional(),
      publicProfile: z.object({
        displayName: z.string().optional(),
        title: z.string().optional(),
        shortDescription: z.string().optional(),
        description: z.string().optional(),
        photoUrl: z.string().optional(),
        publicEmail: z.string().optional(),
        publicPhone: z.string().optional(),
      }).optional(),
      qualificationClaims: z.array(z.object({
        categoryId: z.string(),
        referenceNumber: z.string().optional(),
        status: z.enum(['unverified', 'verified', 'rejected']).optional(),
      })).optional(),
      workExperience: workExperienceInput.optional(),
      education: educationInput.optional(),
      certifications: certificationsInput.optional(),
      location: locationInput.nullable().optional(),
      serviceAreaCityIds: areaInput.optional(),
    }).parse(req.body)

    if ([body.categories, body.subcategoryIds, body.languages, body.locations, body.serviceAreas, body.modes, body.specializations].some((value) => value !== undefined && !Array.isArray(value))) {
      return res.status(400).json({ message: 'Lista nuk është e vlefshme' })
    }

    const provider = await updateProviderProfile(req.user!.uid, String(req.params.id), {
      categories: body.categories,
      subcategoryIds: body.subcategoryIds,
      languages: body.languages,
      locations: body.locations as Location[] | undefined,
      serviceAreas: body.serviceAreas as Location[] | undefined,
      modes: body.modes,
      publicProfile: body.publicProfile,
      experience: body.experience,
      yearsOfExperience: body.yearsOfExperience === undefined ? undefined : body.yearsOfExperience,
      specializations: body.specializations,
      socialLinks: body.socialLinks,
      workExperience: body.workExperience?.map((entry) => ({
        ...entry,
        current: Boolean(entry.current),
      })),
      education: body.education?.map((entry) => ({
        ...entry,
        current: Boolean(entry.current),
      })),
      certifications: body.certifications,
      qualificationClaims: body.qualificationClaims?.map((claim) => ({
        categoryId: claim.categoryId,
        referenceNumber: claim.referenceNumber,
        status: claim.status ?? 'unverified',
      })),
      location: body.location,
      serviceAreaCityIds: body.serviceAreaCityIds,
    })
    return res.json({ provider: toPublicProvider(provider) })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.issues[0]?.message || 'Të dhënat nuk janë të vlefshme' })
    }
    return res.status(400).json({ message: err instanceof Error ? err.message : 'Profili nuk u përditësua' })
  }
})

router.post(
  '/:id/photo',
  requireAuth,
  requireRole('provider', 'company', 'admin'),
  withImageUpload(profilePhotoUpload),
  async (req, res) => {
    try {
      const file = requireUploadedImage(req, 'Zgjidh një foto për profilin e ekspertit')
      const photoUrl = toPublicUploadPath('profiles', file.filename)
      const provider = await updateProviderPhoto(req.user!.uid, String(req.params.id), photoUrl)
      return res.json({ provider: toPublicProvider(provider) })
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Ngarkimi i fotos dështoi' })
    }
  },
)

router.patch('/:id/moderation', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { decision, reason } = req.body as { decision?: 'approved' | 'rejected'; reason?: string }
    if (decision !== 'approved' && decision !== 'rejected') return res.status(400).json({ message: 'Vendimi nuk është i vlefshëm' })
    const provider = await moderateProviderProfile(String(req.params.id), req.user!.uid, decision, reason)
    return res.json({ provider: toPublicProvider(provider) })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Moderimi dështoi' }) }
})

export default router
