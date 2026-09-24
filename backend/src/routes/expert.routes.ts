import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  createExpert,
  listActiveExperts,
  listExpertsByCompany,
} from '../services/expertService'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const experts = await listActiveExperts()
    return res.json({ experts })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan ekspertët',
    })
  }
})

router.get('/mine', requireAuth, requireRole('company', 'admin'), async (req, res) => {
  try {
    const experts = await listExpertsByCompany(req.user!.uid)
    return res.json({ experts })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan ekspertët',
    })
  }
})

router.post('/', requireAuth, requireRole('company', 'admin'), async (req, res) => {
  try {
    const {
      name,
      title,
      categoryId,
      specialty,
      bio,
      location,
      licenseNumber,
      languageFrom,
      languageTo,
      deliveryModes,
      crossBorder,
    } = req.body as {
      name?: string
      title?: string
      categoryId?: string
      specialty?: string
      bio?: string
      location?: string
      licenseNumber?: string
      languageFrom?: string
      languageTo?: string
      deliveryModes?: Array<'online' | 'physical' | 'group'>
      crossBorder?: boolean
    }

    if (
      !name?.trim() ||
      !title?.trim() ||
      !categoryId?.trim() ||
      !specialty?.trim() ||
      !bio?.trim() ||
      !location?.trim()
    ) {
      return res.status(400).json({
        message: 'Emri, titulli, kategoria, specialiteti, bio dhe lokacioni janë të detyrueshme',
      })
    }

    const expert = await createExpert({
      name,
      title,
      categoryId,
      specialty,
      bio,
      location,
      licenseNumber,
      languageFrom,
      languageTo,
      deliveryModes,
      crossBorder,
      ownerUid: req.user!.uid,
      ownerName: req.user!.name,
    })

    return res.status(201).json({ expert })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Shtimi i ekspertit dështoi',
    })
  }
})

export default router
