import { queryPage, paginationInput, validatePagination } from '../services/pagination'
import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth, requireRole } from '../middleware/auth'
import { ProviderProfile } from '../models/ProviderProfile'
import { RatingAggregate } from '../models/RatingAggregate'
import { Review } from '../models/Review'
import { User } from '../models/User'
import {
  createReview, listEligibleInteractionPage, findMyRating, getProviderStats, isCanonicalReviewSubmission,
  listModerationQueue, listProviderRatings, listRateableProviders, moderateReview, respondToReview,
} from '../services/ratingService'

const router = Router()
router.use(validatePagination)

router.get('/providers', requireAuth, requireRole('user', 'provider', 'company', 'admin'), async (req, res) => {
  try { const providers = await listRateableProviders(req.user!.uid, paginationInput(req.query, 20)); return res.json({ providers, pagination: providers.pagination }) }
  catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Nuk u ngarkuan ofruesit' }) }
})

router.get('/eligible/:providerId', requireAuth, requireRole('user', 'provider', 'company', 'admin'), async (req, res) => {
  try {
    const providerId = String(req.params.providerId)
    if (!Types.ObjectId.isValid(providerId)) return res.status(400).json({ message: 'Provider ID i pavlefshëm' })
    const result = await listEligibleInteractionPage(req.user!.uid, paginationInput(req.query, 20), [new Types.ObjectId(providerId)])
    return res.json({ interactions: result.items, pagination: result.pagination })
  } catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Ndërveprimet nuk u ngarkuan' }) }
})

router.get('/eligible-uid/:providerUid', requireAuth, requireRole('user', 'provider', 'company', 'admin'), async (req, res) => {
  try {
    const providerUid = String(req.params.providerUid)
    const owner = await User.findOne({ uid: providerUid }).select('_id').lean()
    if (!owner) { const result = await listEligibleInteractionPage(req.user!.uid, paginationInput(req.query, 20), []); return res.json({ interactions: result.items, providerId: null, pagination: result.pagination }) }
    const profiles = await ProviderProfile.find({ ownerUser: owner._id }).select('_id').lean()
    const result = await listEligibleInteractionPage(req.user!.uid, paginationInput(req.query, 20), profiles.map((profile) => profile._id))
    return res.json({
      interactions: result.items,
      pagination: result.pagination,
      providerId: result.items[0]?.providerId || (profiles[0] ? String(profiles[0]._id) : null),
    })
  } catch (err) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ndërveprimet nuk u ngarkuan' })
  }
})


router.get('/provider/:providerUid', async (req, res) => {
  try {
    const providerUid = String(req.params.providerUid)
    const [stats, ratings] = await Promise.all([getProviderStats(providerUid), listProviderRatings(providerUid, paginationInput(req.query, 12))])
    return res.json({ stats, ratings, pagination: ratings.pagination, buckets: ratings.buckets })
  } catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Nuk u ngarkuan vlerësimet' }) }
})

router.get('/subject/:scope/:id', async (req, res) => {
  try {
    const scope = String(req.params.scope)
    const id = String(req.params.id)
    if ((scope !== 'provider' && scope !== 'business') || !Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Subjekti nuk është i vlefshëm' })
    const query: Record<string, unknown> = { portal: 'keshillakos', subjectType: scope, subjectId: new Types.ObjectId(id), 'moderation.status': 'published', 'abuse.status': 'clear', 'interaction.eligible': true, publishedAt: { $exists: true } }
    const aggregate = await RatingAggregate.findOne({ portal: 'keshillakos', scope, subjectId: id })
    const result = await queryPage(paginationInput(req.query), () => Review.countDocuments(query), (skip, limit) => Review.find(query).select('stars dimensions text language response.text publishedAt interaction.verified').sort({ publishedAt: -1, _id: -1 }).skip(skip).limit(limit))
    return res.json({ aggregate, reviews: result.items, pagination: result.pagination })
  } catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Vlerësimet nuk u ngarkuan' }) }
})

router.get('/mine/:providerUid', requireAuth, async (req, res) => {
  try { return res.json({ rating: await findMyRating(req.user!.uid, String(req.params.providerUid)) }) }
  catch (err) { return res.status(500).json({ message: err instanceof Error ? err.message : 'Nuk u ngarkua vlerësimi' }) }
})

router.post('/', requireAuth, requireRole('user', 'provider', 'company', 'admin'), async (req, res) => {
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

router.get('/moderation/pending', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const queue = await listModerationQueue(paginationInput(req.query, 20), paginationInput({ ...req.query, page: req.query.publishedPage }, 20))
    return res.json({ reviews: queue.pending, published: queue.published, pagination: queue.pagination, publishedPagination: queue.publishedPagination })
  }
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
