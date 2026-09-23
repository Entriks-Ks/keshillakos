"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const ProviderProfile_1 = require("../models/ProviderProfile");
const businessService_1 = require("../services/businessService");
const providerProfileService_1 = require("../services/providerProfileService");
const userService_1 = require("../services/userService");
const User_1 = require("../models/User");
const router = (0, express_1.Router)();
const locationInput = zod_1.z.object({
    countryId: zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid country ID'),
    cityId: zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid city ID'),
});
const locationFieldsInput = zod_1.z.object({
    location: locationInput.optional(),
    serviceAreaCityIds: zod_1.z.array(zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid city ID')).max(200).optional(),
});
function serializeBusiness(business) {
    return {
        _id: String(business._id),
        publicName: business.publicName,
        legalName: business.legalName,
        logoUrl: business.logoUrl,
        description: business.description,
        website: business.website,
        contactEmail: business.contactEmail,
        contactPhone: business.contactPhone,
        categoryIds: business.categoryIds ?? [],
        location: business.location
            ? { countryId: String(business.location.countryId), cityId: String(business.location.cityId) }
            : undefined,
        status: business.status,
        verification: business.verification,
    };
}
router.use(auth_1.requireAuth);
router.post('/expert', async (req, res) => {
    try {
        const { title, description, categories, languages, mode, city } = req.body;
        const locationFields = locationFieldsInput.parse(req.body);
        if (!Array.isArray(categories) || categories.length === 0 ||
            !categories.every((value) => typeof value === 'string') ||
            (mode !== 'online' && mode !== 'on_site') || (mode === 'on_site' && !city?.trim() && !locationFields.location)) {
            return res.status(400).json({ message: 'Kategoria dhe mënyra e punës janë të detyrueshme' });
        }
        const ownerUser = await (0, businessService_1.userIdForUid)(req.user.uid);
        const owner = await User_1.User.findById(ownerUser).select('firstName lastName name').lean();
        if (!owner)
            return res.status(400).json({ message: 'Përdoruesi nuk u gjet' });
        const displayName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.name;
        if (!displayName?.trim()) {
            return res.status(400).json({ message: 'Plotëso emrin dhe mbiemrin në profilin privat para se të bëhesh ekspert' });
        }
        let provider = await ProviderProfile_1.ProviderProfile.findOne({ ownerUser, providerType: 'individual', business: { $exists: false } });
        if (!provider) {
            provider = await (0, providerProfileService_1.createProviderProfile)({
                ownerUid: req.user.uid, providerType: 'individual', categories,
                languages: Array.isArray(languages) ? languages : [],
                modes: [mode],
                locations: mode === 'on_site' && city?.trim() ? [{ countryCode: 'XK', cityName: city.trim(), online: false }] : [],
                serviceAreas: city?.trim() ? [{ countryCode: 'XK', cityName: city.trim(), online: mode === 'online' }] : [],
                ...locationFields,
                publicProfile: { displayName, title: title?.trim(), description: description?.trim() },
            });
        }
        // Capability is granted immediately — no admin approval for becoming an Expert.
        const user = await (0, userService_1.grantCapability)(req.user.uid, 'provider');
        return res.status(201).json({ provider, user });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Regjistrimi i ekspertit dështoi' });
    }
});
router.get('/company', async (req, res) => {
    try {
        const business = await (0, businessService_1.findOwnedOpenBusiness)(req.user.uid);
        return res.json({ business: business ? serializeBusiness(business) : null });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Kompania nuk u ngarkua' });
    }
});
router.post('/company', async (req, res) => {
    try {
        const body = req.body;
        const location = locationInput.parse(body.location);
        const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds : [];
        if (!body.publicName?.trim() || !body.contactEmail?.trim() || !body.contactPhone?.trim() || !body.description?.trim() || !categoryIds.length) {
            return res.status(400).json({
                message: 'Emri, email, telefoni, qyteti, përshkrimi dhe kategoria janë të detyrueshme',
            });
        }
        const address = body.address?.trim();
        const branches = address
            ? [{
                    name: body.publicName.trim(),
                    location: {
                        countryCode: 'XK',
                        cityId: location.cityId,
                        address,
                        online: false,
                    },
                }]
            : undefined;
        const business = await (0, businessService_1.createBusiness)({
            ownerUid: req.user.uid,
            publicName: body.publicName,
            contactEmail: body.contactEmail,
            contactPhone: body.contactPhone,
            description: body.description,
            categoryIds,
            location,
            website: body.website,
            logoUrl: body.logoUrl,
            legalName: body.legalName,
            branches,
        });
        // Capability is granted immediately — company exists without admin approval.
        const user = await (0, userService_1.grantCapability)(req.user.uid, 'company');
        return res.status(201).json({ business: serializeBusiness(business), user });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Krijimi i kompanisë dështoi' });
    }
});
exports.default = router;
//# sourceMappingURL=onboarding.routes.js.map