"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const providerProfileService_1 = require("../services/providerProfileService");
const router = (0, express_1.Router)();
const locationInput = zod_1.z.object({
    countryId: zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid country ID'),
    cityId: zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid city ID'),
});
const areaInput = zod_1.z.array(zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid city ID')).max(200);
router.get('/', async (_req, res) => {
    try {
        return res.json({ providers: (await (0, providerProfileService_1.listPublishedProviderProfiles)()).map(providerProfileService_1.toPublicProvider) });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Profilet nuk u ngarkuan' });
    }
});
router.get('/mine', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        return res.json({ providers: await (0, providerProfileService_1.listMyProviderProfiles)(req.user.uid) });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Profilet nuk u ngarkuan' });
    }
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        const body = req.body;
        if (!['individual', 'business'].includes(body.providerType || '') || !Array.isArray(body.categories) || !body.publicProfile?.displayName?.trim()) {
            return res.status(400).json({ message: 'Lloji, emri dhe kategoritë janë të detyrueshme' });
        }
        const locationFields = zod_1.z.object({ location: locationInput.optional(), serviceAreaCityIds: areaInput.optional() }).parse(body);
        const provider = await (0, providerProfileService_1.createProviderProfile)({
            ownerUid: req.user.uid,
            providerType: body.providerType,
            businessId: body.businessId,
            categories: body.categories,
            languages: body.languages,
            locations: body.locations,
            serviceAreas: body.serviceAreas,
            ...locationFields,
            modes: body.modes,
            publicProfile: { ...body.publicProfile, displayName: body.publicProfile.displayName },
        });
        return res.status(201).json({ provider });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Profili nuk u krijua' });
    }
});
router.patch('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        const { categories, languages, locations, serviceAreas, modes, publicProfile } = req.body;
        if ([categories, languages, locations, serviceAreas, modes].some((value) => value !== undefined && !Array.isArray(value))) {
            return res.status(400).json({ message: 'Lista nuk është e vlefshme' });
        }
        const locationFields = zod_1.z.object({ location: locationInput.nullable().optional(), serviceAreaCityIds: areaInput.optional() }).parse(req.body);
        const provider = await (0, providerProfileService_1.updateProviderProfile)(req.user.uid, String(req.params.id), { categories, languages, locations, serviceAreas, modes, publicProfile, ...locationFields });
        return res.json({ provider });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Profili nuk u përditësua' });
    }
});
router.patch('/:id/moderation', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { decision, reason } = req.body;
        if (decision !== 'approved' && decision !== 'rejected')
            return res.status(400).json({ message: 'Vendimi nuk është i vlefshëm' });
        const provider = await (0, providerProfileService_1.moderateProviderProfile)(String(req.params.id), req.user.uid, decision, reason);
        return res.json({ provider });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Moderimi dështoi' });
    }
});
exports.default = router;
//# sourceMappingURL=providerProfile.routes.js.map