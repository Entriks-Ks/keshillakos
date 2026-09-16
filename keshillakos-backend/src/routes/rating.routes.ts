import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  findMyRating,
  getProviderStats,
  listProviderRatings,
  listRateableProviders,
  upsertRating,
} from '../services/ratingService'

const router = Router()

router.get('/providers', async (_req, res) => {
  try {
    const providers = await listRateableProviders()
    return res.json({ providers })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan ofruesit',
    })
  }
})

router.get('/provider/:providerUid', async (req, res) => {
  try {
    const providerUid = String(req.params.providerUid)
    const [stats, ratings] = await Promise.all([
      getProviderStats(providerUid),
      listProviderRatings(providerUid),
    ])
    return res.json({ stats, ratings })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan vlerësimet',
    })
  }
})

router.get('/mine/:providerUid', requireAuth, async (req, res) => {
  try {
    const rating = await findMyRating(req.user!.uid, String(req.params.providerUid))
    return res.json({ rating })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkua vlerësimi',
    })
  }
})

router.post('/', requireAuth, requireRole('user', 'admin'), async (req, res) => {
  try {
    const { providerUid, providerName, score, comment } = req.body as {
      providerUid?: string
      providerName?: string
      score?: number
      comment?: string
    }

    if (!providerUid?.trim() || !providerName?.trim()) {
      return res.status(400).json({ message: 'Ofruesi është i detyrueshëm' })
    }

    const rating = await upsertRating({
      providerUid: providerUid.trim(),
      providerName: providerName.trim(),
      raterUid: req.user!.uid,
      raterName: req.user!.name,
      score: Number(score),
      comment,
    })

    const stats = await getProviderStats(providerUid.trim())

    return res.status(201).json({ rating, stats })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Vlerësimi dështoi',
    })
  }
})

export default router
