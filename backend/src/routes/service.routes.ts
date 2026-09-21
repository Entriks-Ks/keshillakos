import { Router } from 'express'
import fs from 'fs'
import multer from 'multer'
import path from 'path'
import { Types } from 'mongoose'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  createService,
  deleteService,
  getActiveServiceById,
  listActiveServices,
  listServicesByProvider,
  updateService,
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

const servicesDir = path.join(path.resolve(process.cwd(), 'uploads'), 'services')
fs.mkdirSync(servicesDir, { recursive: true })

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, servicesDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg'
      cb(null, `${req.user!.uid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`)
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Ngarko vetëm foto (JPG, PNG, WEBP)'))
      return
    }
    cb(null, true)
  },
})

function parseServicePayload(body: {
  title?: string
  description?: string
  categoryId?: string
  category?: string
  subcategory?: string
  location?: string
  priceFrom?: number | string | null
  details?: ServiceDetails
}) {
  const title = body.title?.trim()
  const description = body.description?.trim()
  const categoryId = body.categoryId?.trim() || body.category?.trim()
  const subcategory = body.subcategory?.trim()
  const location = body.location?.trim()
  if (!title || !description || !categoryId || !subcategory || !location) {
    throw new Error('Titulli, përshkrimi, kategoria, nënkategoria dhe lokacioni janë të detyrueshme')
  }
  let priceFrom: number | undefined
  if (body.priceFrom !== undefined && body.priceFrom !== '' && body.priceFrom !== null) {
    priceFrom = typeof body.priceFrom === 'number' ? body.priceFrom : Number(body.priceFrom)
    if (Number.isNaN(priceFrom) || priceFrom < 0) throw new Error('Çmimi fillestar nuk është i vlefshëm')
  }
  return { title, description, categoryId, subcategory, location, priceFrom, details: body.details }
}

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

router.post('/photos', requireAuth, requireRole('provider', 'admin'), (req, res) => {
  photoUpload.single('photo')(req, res, (err) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? 'Fotoja duhet të jetë më e vogël se 2MB'
          : err instanceof Error
            ? err.message
            : 'Ngarkimi i fotos dështoi'
      return res.status(400).json({ message })
    }
    if (!req.file) return res.status(400).json({ message: 'Zgjidh një foto për shërbimin' })
    return res.status(201).json({ url: `/uploads/services/${req.file.filename}` })
  })
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
    const payload = parseServicePayload(req.body)
    const service = await createService({
      ...payload,
      providerUid: req.user!.uid,
      providerName: req.user!.name,
      providerId: typeof req.body.providerId === 'string' ? req.body.providerId : undefined,
    })
    return res.status(201).json({ service })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Krijimi i shërbimit dështoi',
    })
  }
})

router.patch('/:id', requireAuth, requireRole('provider', 'admin'), async (req, res) => {
  try {
    const payload = parseServicePayload(req.body)
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const service = await updateService(id, req.user!.uid, payload)
    return res.json({ service })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Përditësimi i shërbimit dështoi'
    const status = message.includes('nuk u gjet') ? 404 : message.includes('leje') ? 403 : 400
    return res.status(status).json({ message })
  }
})

router.delete('/:id', requireAuth, requireRole('provider', 'admin'), async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const result = await deleteService(id, req.user!.uid)
    return res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fshirja e shërbimit dështoi'
    const status = message.includes('nuk u gjet') ? 404 : message.includes('leje') ? 403 : 400
    return res.status(status).json({ message })
  }
})

export default router
