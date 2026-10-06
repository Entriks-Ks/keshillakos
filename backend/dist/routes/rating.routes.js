"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pagination_1 = require("../services/pagination");
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const auth_1 = require("../middleware/auth");
const ProviderProfile_1 = require("../models/ProviderProfile");
const RatingAggregate_1 = require("../models/RatingAggregate");
const Review_1 = require("../models/Review");
const User_1 = require("../models/User");
const ratingService_1 = require("../services/ratingService");
const router = (0, express_1.Router)();
router.use(pagination_1.validatePagination);
router.get('/providers', auth_1.requireAuth, (0, auth_1.requireRole)('user', 'provider', 'company', 'admin'), async (req, res) => {
    try {
        const providers = await (0, ratingService_1.listRateableProviders)(req.user.uid, (0, pagination_1.paginationInput)(req.query, 20));
        return res.json({ providers, pagination: providers.pagination });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Nuk u ngarkuan ofruesit' });
    }
});
router.get('/eligible/:providerId', auth_1.requireAuth, (0, auth_1.requireRole)('user', 'provider', 'company', 'admin'), async (req, res) => {
    try {
        const providerId = String(req.params.providerId);
        if (!mongoose_1.Types.ObjectId.isValid(providerId))
            return res.status(400).json({ message: 'Provider ID i pavlefshëm' });
        const result = await (0, ratingService_1.listEligibleInteractionPage)(req.user.uid, (0, pagination_1.paginationInput)(req.query, 20), [new mongoose_1.Types.ObjectId(providerId)]);
        return res.json({ interactions: result.items, pagination: result.pagination });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Ndërveprimet nuk u ngarkuan' });
    }
});
router.get('/eligible-uid/:providerUid', auth_1.requireAuth, (0, auth_1.requireRole)('user', 'provider', 'company', 'admin'), async (req, res) => {
    try {
        const providerUid = String(req.params.providerUid);
        const owner = await User_1.User.findOne({ uid: providerUid }).select('_id').lean();
        if (!owner) {
            const result = await (0, ratingService_1.listEligibleInteractionPage)(req.user.uid, (0, pagination_1.paginationInput)(req.query, 20), []);
            return res.json({ interactions: result.items, providerId: null, pagination: result.pagination });
        }
        const profiles = await ProviderProfile_1.ProviderProfile.find({ ownerUser: owner._id }).select('_id').lean();
        const result = await (0, ratingService_1.listEligibleInteractionPage)(req.user.uid, (0, pagination_1.paginationInput)(req.query, 20), profiles.map((profile) => profile._id));
        return res.json({
            interactions: result.items,
            pagination: result.pagination,
            providerId: result.items[0]?.providerId || (profiles[0] ? String(profiles[0]._id) : null),
        });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Ndërveprimet nuk u ngarkuan' });
    }
});
router.get('/provider/:providerUid', async (req, res) => {
    try {
        const providerUid = String(req.params.providerUid);
        const [stats, ratings] = await Promise.all([(0, ratingService_1.getProviderStats)(providerUid), (0, ratingService_1.listProviderRatings)(providerUid, (0, pagination_1.paginationInput)(req.query, 12))]);
        return res.json({ stats, ratings, pagination: ratings.pagination, buckets: ratings.buckets });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Nuk u ngarkuan vlerësimet' });
    }
});
router.get('/subject/:scope/:id', async (req, res) => {
    try {
        const scope = String(req.params.scope);
        const id = String(req.params.id);
        if ((scope !== 'provider' && scope !== 'business') || !mongoose_1.Types.ObjectId.isValid(id))
            return res.status(400).json({ message: 'Subjekti nuk është i vlefshëm' });
        const query = { portal: 'keshillakos', subjectType: scope, subjectId: new mongoose_1.Types.ObjectId(id), 'moderation.status': 'published', 'abuse.status': 'clear', 'interaction.eligible': true, publishedAt: { $exists: true } };
        const aggregate = await RatingAggregate_1.RatingAggregate.findOne({ portal: 'keshillakos', scope, subjectId: id });
        const result = await (0, pagination_1.queryPage)((0, pagination_1.paginationInput)(req.query), () => Review_1.Review.countDocuments(query), (skip, limit) => Review_1.Review.find(query).select('stars dimensions text language response.text publishedAt interaction.verified').sort({ publishedAt: -1, _id: -1 }).skip(skip).limit(limit));
        return res.json({ aggregate, reviews: result.items, pagination: result.pagination });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Vlerësimet nuk u ngarkuan' });
    }
});
router.get('/mine/:providerUid', auth_1.requireAuth, async (req, res) => {
    try {
        return res.json({ rating: await (0, ratingService_1.findMyRating)(req.user.uid, String(req.params.providerUid)) });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Nuk u ngarkua vlerësimi' });
    }
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('user', 'provider', 'company', 'admin'), async (req, res) => {
    try {
        const body = req.body;
        // Deliberately no providerUid + stars compatibility write: that path allowed arbitrary ratings.
        if (!(0, ratingService_1.isCanonicalReviewSubmission)(body)) {
            return res.status(400).json({ message: 'Kërkohet ndërveprim i përfunduar dhe subjekt kanonik' });
        }
        const review = await (0, ratingService_1.createReview)({
            reviewerUid: req.user.uid, providerId: body.providerId, businessId: body.businessId,
            interactionKind: body.interactionKind, interactionId: body.interactionId,
            stars: Number(body.stars), dimensions: body.dimensions, text: body.text, language: body.language,
        });
        return res.status(201).json({ review });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Vlerësimi dështoi' });
    }
});
router.get('/moderation/pending', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const queue = await (0, ratingService_1.listModerationQueue)((0, pagination_1.paginationInput)(req.query, 20), (0, pagination_1.paginationInput)({ ...req.query, page: req.query.publishedPage }, 20));
        return res.json({ reviews: queue.pending, published: queue.published, pagination: queue.pagination, publishedPagination: queue.publishedPagination });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Vlerësimet nuk u ngarkuan' });
    }
});
router.patch('/:id/moderation', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { decision, abuseStatus, reason } = req.body;
        if (!decision || !['published', 'rejected'].includes(decision) || abuseStatus && !['clear', 'flagged', 'confirmed'].includes(abuseStatus))
            return res.status(400).json({ message: 'Vendim i pavlefshëm' });
        return res.json({ review: await (0, ratingService_1.moderateReview)(String(req.params.id), req.user.uid, decision, abuseStatus, reason) });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Moderimi dështoi' });
    }
});
router.patch('/:id/response', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        const { text } = req.body;
        if (!text?.trim())
            return res.status(400).json({ message: 'Përgjigjja është e detyrueshme' });
        return res.json({ review: await (0, ratingService_1.respondToReview)(req.user.uid, String(req.params.id), text) });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Përgjigjja dështoi' });
    }
});
exports.default = router;
//# sourceMappingURL=rating.routes.js.map