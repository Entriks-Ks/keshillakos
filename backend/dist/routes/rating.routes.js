"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const auth_1 = require("../middleware/auth");
const ProviderProfile_1 = require("../models/ProviderProfile");
const RatingAggregate_1 = require("../models/RatingAggregate");
const Review_1 = require("../models/Review");
const User_1 = require("../models/User");
const ratingService_1 = require("../services/ratingService");
const router = (0, express_1.Router)();
router.get('/providers', auth_1.requireAuth, (0, auth_1.requireRole)('user', 'provider', 'company', 'admin'), async (req, res) => {
    try {
        return res.json({ providers: await (0, ratingService_1.listRateableProviders)(req.user.uid) });
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
        return res.json({ interactions: await (0, ratingService_1.eligibleInteractions)(req.user.uid, providerId) });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Ndërveprimet nuk u ngarkuan' });
    }
});
router.get('/eligible-uid/:providerUid', auth_1.requireAuth, (0, auth_1.requireRole)('user', 'provider', 'company', 'admin'), async (req, res) => {
    try {
        const providerUid = String(req.params.providerUid);
        const owner = await User_1.User.findOne({ uid: providerUid }).select('_id').lean();
        if (!owner)
            return res.json({ interactions: [], providerId: null });
        const profiles = await ProviderProfile_1.ProviderProfile.find({ ownerUser: owner._id }).select('_id').lean();
        const interactions = (await Promise.all(profiles.map((profile) => (0, ratingService_1.eligibleInteractions)(req.user.uid, String(profile._id))))).flat();
        return res.json({
            interactions,
            providerId: interactions[0]?.providerId || (profiles[0] ? String(profiles[0]._id) : null),
        });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Ndërveprimet nuk u ngarkuan' });
    }
});
router.get('/provider/:providerUid', async (req, res) => {
    try {
        const providerUid = String(req.params.providerUid);
        const [stats, ratings] = await Promise.all([(0, ratingService_1.getProviderStats)(providerUid), (0, ratingService_1.listProviderRatings)(providerUid)]);
        return res.json({ stats, ratings });
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
        const [aggregate, reviews] = await Promise.all([
            RatingAggregate_1.RatingAggregate.findOne({ portal: 'keshillakos', scope, subjectId: id }),
            Review_1.Review.find({ portal: 'keshillakos', subjectType: scope, subjectId: id, 'moderation.status': 'published', 'abuse.status': 'clear', 'interaction.eligible': true, publishedAt: { $exists: true } })
                .select('stars dimensions text language response.text publishedAt interaction.verified').sort({ publishedAt: -1 }).limit(20),
        ]);
        return res.json({ aggregate, reviews });
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
router.get('/moderation/pending', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (_req, res) => {
    try {
        const queue = await (0, ratingService_1.listModerationQueue)();
        return res.json({ reviews: queue.pending, published: queue.published });
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