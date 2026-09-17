import { Router } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  createService,
  getActiveServiceById,
  listActiveServices,
  listServicesByProvider,
} from '../services/serviceService'
import type { ServiceDetails } from '../models/Service'

const router = Router()
const discoveryQuery = z.object({
  cityId: z.string().refine(Types.ObjectId.isValid, 'Invalid city ID').optional(),
  categoryId: z.string().trim().min(1).max(120).optional(),
  subcategoryId: z.string().trim().min(1).max(120).optional(),
  serviceId: z.string().refine(Types.ObjectId.isValid, 'Invalid service ID').optional(),
  q: z.string().trim().max(160).optional(),
})

router.get('/', async (req, res) => {
  try {
    const parsed = discoveryQuery.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ message: 'Filtrat nuk janë të vlefshëm', errors: parsed.error.issues })
    const services = await listActiveServices(parsed.data)
    return res.json({ services })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan shërbimet',
    })
  }
})

router.get('/mine', requireAuth, requireRole('provider', 'admin'), async (req, res) => {
  try {
    const services = await listServicesByProvider(req.user!.uid)
    return res.json({ services })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan shërbimet',
    })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const service = await getActiveServiceById(req.params.id)
    if (!service) {
      return res.status(404).json({ message: 'Shërbimi nuk u gjet' })
    }
    return res.json({ service })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkua shërbimi',
    })
  }
})

router.post('/', requireAuth, requireRole('provider', 'admin'), async (req, res) => {
  try {
    const {
      title,
      description,
      categoryId,
      subcategory,
      location,
      priceFrom,
      details,
      providerId,
    } = req.body as {
      title?: string
      description?: string
      categoryId?: string
      category?: string
      subcategory?: string
      location?: string
      priceFrom?: number | string
      details?: ServiceDetails
      providerId?: string
    }

    const resolvedCategoryId = categoryId?.trim() || (req.body as { category?: string }).category?.trim()

    if (
      !title?.trim() ||
      !description?.trim() ||
      !resolvedCategoryId ||
      !subcategory?.trim() ||
      !location?.trim()
    ) {
      return res.status(400).json({
        message: 'Titulli, përshkrimi, kategoria, nënkategoria dhe lokacioni janë të detyrueshme',
      })
    }

    let parsedPrice: number | undefined
    if (priceFrom !== undefined && priceFrom !== '' && priceFrom !== null) {
      parsedPrice = typeof priceFrom === 'number' ? priceFrom : Number(priceFrom)
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ message: 'Çmimi fillestar nuk është i vlefshëm' })
      }
    }

    const service = await createService({
      title,
      description,
      categoryId: resolvedCategoryId,
      subcategory,
      location,
      priceFrom: parsedPrice,
      details,
      providerUid: req.user!.uid,
      providerName: req.user!.name,
      providerId,
    })

    return res.status(201).json({ service })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Krijimi i shërbimit dështoi',
    })
  }
})

export default router
