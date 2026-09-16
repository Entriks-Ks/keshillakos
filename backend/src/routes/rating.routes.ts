import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth, requireRole } from '../middleware/auth'
import { RatingAggregate } from '../models/RatingAggregate'
import { Review } from '../models/Review'
import {
  createReview, eligibleInteractions, findMyRating, getProviderStats, isCanonicalReviewSubmission,
  listProviderRatings, listRateableProviders, moderateReview, respondToReview,
} from '../services/ratingService'

const router = Router()

router.get('/providers', requireAuth, requireRole('user', 'admin'), async (req, res) => {
  try { return res.json({ providers: await listRateableProviders(req.user!.uid) }) }
  catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Nuk u ngarkuan ofruesit' }) }
})

router.get('/eligible/:providerId', requireAuth, requireRole('user', 'admin'), async (req, res) => {
  try {
    const providerId = String(req.params.providerId)
    if (!Types.ObjectId.isValid(providerId)) return res.status(400).json({ message: 'Provider ID i pavlefshëm' })
    return res.json({ interactions: await eligibleInteractions(req.user!.uid, providerId) })
  } catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Ndërveprimet nuk u ngarkuan' }) }
})

router.get('/provider/:providerUid', async (req, res) => {
  try {
    const providerUid = String(req.params.providerUid)
    const [stats, ratings] = await Promise.all([getProviderStats(providerUid), listProviderRatings(providerUid)])
    return res.json({ stats, ratings })
  } catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Nuk u ngarkuan vlerësimet' }) }
})

router.get('/subject/:scope/:id', async (req, res) => {
  try {
    const scope = String(req.params.scope)
    const id = String(req.params.id)
    if ((scope !== 'provider' && scope !== 'business') || !Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Subjekti nuk është i vlefshëm' })
    const [aggregate, reviews] = await Promise.all([
      RatingAggregate.findOne({ portal: 'keshillakos', scope, subjectId: id }),
      Review.find({ portal: 'keshillakos', subjectType: scope, subjectId: id, 'moderation.status': 'published', 'abuse.status': 'clear', 'interaction.eligible': true, publishedAt: { $exists: true } })
        .select('stars dimensions text language response.text publishedAt interaction.verified').sort({ publishedAt: -1 }).limit(20),
    ])
    return res.json({ aggregate, reviews })
  } catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Vlerësimet nuk u ngarkuan' }) }
})

router.get('/mine/:providerUid', requireAuth, async (req, res) => {
  try { return res.json({ rating: await findMyRating(req.user!.uid, String(req.params.providerUid)) }) }
  catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Nuk u ngarkua vlerësimi' }) }
})

router.post('/', requireAuth, requireRole('user', 'admin'), async (req, res) => {
  try {
    const body = req.body as {
      providerId?: string; businessId?: string; interactionKind?: 'appointment' | 'request_delivery'
      interactionId?: string; stars?: number; dimensions?: Record<string, number>; text?: string; language?: string
    }
    // Deliberately no providerUid + stars compatibility write: that path allowed arbitrary ratings.
    if (!isCanonicalReviewSubmission(body)) {
      return res.status(400).json({ message: 'Kërkohet ndërveprim i përfunduar dhe subjekt kanonik' })
    }
    const review = await createReview({
      reviewerUid: req.user!.uid, providerId: body.providerId, businessId: body.businessId,
      interactionKind: body.interactionKind!, interactionId: body.interactionId!,
      stars: Number(body.stars), dimensions: body.dimensions, text: body.text, language: body.language,
    })
    return res.status(201).json({ review })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Vlerësimi dështoi' }) }
})

router.get('/moderation/pending', requireAuth, requireRole('admin'), async (_req, res) => {
  try { return res.json({ reviews: await Review.find({ 'moderation.status': 'pending' }).sort({ createdAt: 1 }).limit(100) }) }
  catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Vlerësimet nuk u ngarkuan' }) }
})

router.patch('/:id/moderation', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { decision, abuseStatus, reason } = req.body as { decision?: 'published' | 'rejected'; abuseStatus?: 'clear' | 'flagged' | 'confirmed'; reason?: string }
    if (!decision || !['published', 'rejected'].includes(decision) || abuseStatus && !['clear', 'flagged', 'confirmed'].includes(abuseStatus)) return res.status(400).json({ message: 'Vendim i pavlefshëm' })
    return res.json({ review: await moderateReview(String(req.params.id), req.user!.uid, decision, abuseStatus, reason) })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Moderimi dështoi' }) }
})

router.patch('/:id/response', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  try {
    const { text } = req.body as { text?: string }
    if (!text?.trim()) return res.status(400).json({ message: 'Përgjigjja është e detyrueshme' })
    return res.json({ review: await respondToReview(req.user!.uid, String(req.params.id), text) })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Përgjigjja dështoi' }) }
})

export default router
