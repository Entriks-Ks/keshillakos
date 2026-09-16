import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  createService,
  listActiveServices,
  listServicesByProvider,
} from '../services/serviceService'
import type { ServiceDetails } from '../models/Service'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const services = await listActiveServices()
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
    } = req.body as {
      title?: string
      description?: string
      categoryId?: string
      category?: string
      subcategory?: string
      location?: string
      priceFrom?: number | string
      details?: ServiceDetails
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
    })

    return res.status(201).json({ service })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Krijimi i shërbimit dështoi',
    })
  }
})

export default router
