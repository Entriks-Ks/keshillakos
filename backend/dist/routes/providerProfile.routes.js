"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const mediaService_1 = require("../services/mediaService");
const providerProfileService_1 = require("../services/providerProfileService");
const router = (0, express_1.Router)();
const locationInput = zod_1.z.object({
    countryId: zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid country ID'),
    cityId: zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid city ID'),
});
const areaInput = zod_1.z.array(zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid city ID')).max(200);
const monthYearInput = zod_1.z.object({
    month: zod_1.z.number().int().min(1).max(12),
    year: zod_1.z.number().int().min(1950).max(2100),
});
const workExperienceInput = zod_1.z.array(zod_1.z.object({
    position: zod_1.z.string().trim().min(1).max(160),
    organization: zod_1.z.string().trim().min(1).max(160),
    from: monthYearInput,
    to: monthYearInput.optional(),
    current: zod_1.z.boolean().optional(),
    description: zod_1.z.string().trim().max(2000).optional(),
})).max(30);
const educationInput = zod_1.z.array(zod_1.z.object({
    institution: zod_1.z.string().trim().min(1).max(160),
    degree: zod_1.z.string().trim().min(1).max(160),
    fieldOfStudy: zod_1.z.string().trim().min(1).max(160),
    from: monthYearInput,
    to: monthYearInput.optional(),
    current: zod_1.z.boolean().optional(),
})).max(20);
const certificationsInput = zod_1.z.array(zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(160),
    issuer: zod_1.z.string().trim().min(1).max(160),
    year: zod_1.z.number().int().min(1950).max(2100),
    credentialUrl: zod_1.z.string().trim().max(500).optional(),
})).max(30);
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
        return res.json({ providers: (await (0, providerProfileService_1.listMyProviderProfiles)(req.user.uid)).map(providerProfileService_1.toPublicProvider) });
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
        return res.status(201).json({ provider: (0, providerProfileService_1.toPublicProvider)(provider) });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Profili nuk u krijua' });
    }
});
router.patch('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        const body = zod_1.z.object({
            categories: zod_1.z.array(zod_1.z.string()).optional(),
            subcategoryIds: zod_1.z.array(zod_1.z.string()).optional(),
            languages: zod_1.z.array(zod_1.z.string()).optional(),
            locations: zod_1.z.array(zod_1.z.any()).optional(),
            serviceAreas: zod_1.z.array(zod_1.z.any()).optional(),
            modes: zod_1.z.array(zod_1.z.enum(['online', 'on_site'])).optional(),
            experience: zod_1.z.string().optional(),
            yearsOfExperience: zod_1.z.number().int().min(0).max(60).nullable().optional(),
            specializations: zod_1.z.array(zod_1.z.string()).optional(),
            socialLinks: zod_1.z.record(zod_1.z.string(), zod_1.z.string().optional()).nullable().optional(),
            publicProfile: zod_1.z.object({
                displayName: zod_1.z.string().optional(),
                title: zod_1.z.string().optional(),
                shortDescription: zod_1.z.string().optional(),
                description: zod_1.z.string().optional(),
                photoUrl: zod_1.z.string().optional(),
                publicEmail: zod_1.z.string().optional(),
                publicPhone: zod_1.z.string().optional(),
            }).optional(),
            qualificationClaims: zod_1.z.array(zod_1.z.object({
                categoryId: zod_1.z.string(),
                referenceNumber: zod_1.z.string().optional(),
                status: zod_1.z.enum(['unverified', 'verified', 'rejected']).optional(),
            })).optional(),
            workExperience: workExperienceInput.optional(),
            education: educationInput.optional(),
            certifications: certificationsInput.optional(),
            location: locationInput.nullable().optional(),
            serviceAreaCityIds: areaInput.optional(),
        }).parse(req.body);
        if ([body.categories, body.subcategoryIds, body.languages, body.locations, body.serviceAreas, body.modes, body.specializations].some((value) => value !== undefined && !Array.isArray(value))) {
            return res.status(400).json({ message: 'Lista nuk është e vlefshme' });
        }
        const provider = await (0, providerProfileService_1.updateProviderProfile)(req.user.uid, String(req.params.id), {
            categories: body.categories,
            subcategoryIds: body.subcategoryIds,
            languages: body.languages,
            locations: body.locations,
            serviceAreas: body.serviceAreas,
            modes: body.modes,
            publicProfile: body.publicProfile,
            experience: body.experience,
            yearsOfExperience: body.yearsOfExperience === undefined ? undefined : body.yearsOfExperience,
            specializations: body.specializations,
            socialLinks: body.socialLinks,
            workExperience: body.workExperience?.map((entry) => ({
                ...entry,
                current: Boolean(entry.current),
            })),
            education: body.education?.map((entry) => ({
                ...entry,
                current: Boolean(entry.current),
            })),
            certifications: body.certifications,
            qualificationClaims: body.qualificationClaims?.map((claim) => ({
                categoryId: claim.categoryId,
                referenceNumber: claim.referenceNumber,
                status: claim.status ?? 'unverified',
            })),
            location: body.location,
            serviceAreaCityIds: body.serviceAreaCityIds,
        });
        return res.json({ provider: (0, providerProfileService_1.toPublicProvider)(provider) });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: err.issues[0]?.message || 'Të dhënat nuk janë të vlefshme' });
        }
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Profili nuk u përditësua' });
    }
});
router.post('/:id/photo', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), (0, mediaService_1.withImageUpload)(mediaService_1.profilePhotoUpload), async (req, res) => {
    try {
        const file = (0, mediaService_1.requireUploadedImage)(req, 'Zgjidh një foto për profilin e ekspertit');
        const photoUrl = (0, mediaService_1.toPublicUploadPath)('profiles', file.filename);
        const provider = await (0, providerProfileService_1.updateProviderPhoto)(req.user.uid, String(req.params.id), photoUrl);
        return res.json({ provider: (0, providerProfileService_1.toPublicProvider)(provider) });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Ngarkimi i fotos dështoi' });
    }
});
router.patch('/:id/moderation', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { decision, reason } = req.body;
        if (decision !== 'approved' && decision !== 'rejected')
            return res.status(400).json({ message: 'Vendimi nuk është i vlefshëm' });
        const provider = await (0, providerProfileService_1.moderateProviderProfile)(String(req.params.id), req.user.uid, decision, reason);
        return res.json({ provider: (0, providerProfileService_1.toPublicProvider)(provider) });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Moderimi dështoi' });
    }
});
exports.default = router;
//# sourceMappingURL=providerProfile.routes.js.map