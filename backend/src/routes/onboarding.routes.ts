import { Router } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { ProviderProfile } from '../models/ProviderProfile'
import {
  createBusiness,
  findOwnedOpenBusiness,
  userIdForUid,
} from '../services/businessService'
import { createProviderProfile } from '../services/providerProfileService'
import { grantCapability } from '../services/userService'
import { User } from '../models/User'
import type { Location } from '../models/location'

const router = Router()
const locationInput = z.object({
  countryId: z.string().refine(Types.ObjectId.isValid, 'Invalid country ID'),
  cityId: z.string().refine(Types.ObjectId.isValid, 'Invalid city ID'),
})
const locationFieldsInput = z.object({
  location: locationInput.optional(),
  serviceAreaCityIds: z.array(z.string().refine(Types.ObjectId.isValid, 'Invalid city ID')).max(200).optional(),
})

function serializeBusiness(business: {
  _id: Types.ObjectId
  publicName: string
  legalName?: string
  logoUrl?: string
  description?: string
  website?: string
  contactEmail?: string
  contactPhone?: string
  categoryIds?: string[]
  location?: { countryId: Types.ObjectId; cityId: Types.ObjectId }
  status: string
  verification?: { status: string }
}) {
  return {
    _id: String(business._id),
    publicName: business.publicName,
    legalName: business.legalName,
    logoUrl: business.logoUrl,
    description: business.description,
    website: business.website,
    contactEmail: business.contactEmail,
    contactPhone: business.contactPhone,
    categoryIds: business.categoryIds ?? [],
    location: business.location
      ? { countryId: String(business.location.countryId), cityId: String(business.location.cityId) }
      : undefined,
    status: business.status,
    verification: business.verification,
  }
}

router.use(requireAuth)

router.post('/expert', async (req, res) => {
  try {
    const { title, description, categories, languages, mode, city } = req.body as {
      title?: string; description?: string; categories?: string[]
      languages?: string[]; mode?: 'online' | 'on_site'; city?: string
    }
    const locationFields = locationFieldsInput.parse(req.body)
    if (!Array.isArray(categories) || categories.length === 0 ||
      !categories.every((value) => typeof value === 'string') ||
      (mode !== 'online' && mode !== 'on_site') || (mode === 'on_site' && !city?.trim() && !locationFields.location)) {
      return res.status(400).json({ message: 'Kategoria dhe mënyra e punës janë të detyrueshme' })
    }
    const ownerUser = await userIdForUid(req.user!.uid)
    const owner = await User.findById(ownerUser).select('firstName lastName name').lean()
    if (!owner) return res.status(400).json({ message: 'Përdoruesi nuk u gjet' })
    const displayName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.name
    if (!displayName?.trim()) {
      return res.status(400).json({ message: 'Plotëso emrin dhe mbiemrin në profilin privat para se të bëhesh ekspert' })
    }

    let provider = await ProviderProfile.findOne({ ownerUser, providerType: 'individual', business: { $exists: false } })
    if (!provider) {
      provider = await createProviderProfile({
        ownerUid: req.user!.uid, providerType: 'individual', categories,
        languages: Array.isArray(languages) ? languages : [],
        modes: [mode],
        locations: mode === 'on_site' && city?.trim() ? [{ countryCode: 'XK', cityName: city.trim(), online: false }] : [],
        serviceAreas: city?.trim() ? [{ countryCode: 'XK', cityName: city.trim(), online: mode === 'online' }] : [],
        ...locationFields,
        publicProfile: { displayName, title: title?.trim(), description: description?.trim() },
      })
    }
    // Capability is granted immediately — no admin approval for becoming an Expert.
    const user = await grantCapability(req.user!.uid, 'provider')
    return res.status(201).json({ provider, user })
  } catch (err) {
    return res.status(400).json({ message: err instanceof Error ? err.message : 'Regjistrimi i ekspertit dështoi' })
  }
})

router.get('/company', async (req, res) => {
  try {
    const business = await findOwnedOpenBusiness(req.user!.uid)
    return res.json({ business: business ? serializeBusiness(business) : null })
  } catch (err) {
    return res.status(400).json({ message: err instanceof Error ? err.message : 'Kompania nuk u ngarkua' })
  }
})

router.post('/company', async (req, res) => {
  try {
    const body = req.body as {
      publicName?: string
      contactEmail?: string
      contactPhone?: string
      description?: string
      categoryIds?: string[]
      website?: string
      logoUrl?: string
      legalName?: string
      location?: { countryId: string; cityId: string }
      address?: string
    }

    const location = locationInput.parse(body.location)
    const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds : []
    if (!body.publicName?.trim() || !body.contactEmail?.trim() || !body.contactPhone?.trim() || !body.description?.trim() || !categoryIds.length) {
      return res.status(400).json({
        message: 'Emri, email, telefoni, qyteti, përshkrimi dhe kategoria janë të detyrueshme',
      })
    }

    const address = body.address?.trim()
    const branches: Array<{ name: string; location: Location }> | undefined = address
      ? [{
        name: body.publicName.trim(),
        location: {
          countryCode: 'XK',
          cityId: location.cityId,
          address,
          online: false,
        },
      }]
      : undefined

    const business = await createBusiness({
      ownerUid: req.user!.uid,
      publicName: body.publicName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      description: body.description,
      categoryIds,
      location,
      website: body.website,
      logoUrl: body.logoUrl,
      legalName: body.legalName,
      branches,
    })

    // Capability is granted immediately — company exists without admin approval.
    const user = await grantCapability(req.user!.uid, 'company')
    return res.status(201).json({ business: serializeBusiness(business), user })
  } catch (err) {
    return res.status(400).json({ message: err instanceof Error ? err.message : 'Krijimi i kompanisë dështoi' })
  }
})

export default router
