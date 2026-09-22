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
const router = (0, express_1.Router)();
const locationFieldsInput = zod_1.z.object({
    location: zod_1.z.object({
        countryId: zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid country ID'),
        cityId: zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid city ID'),
    }).optional(),
    serviceAreaCityIds: zod_1.z.array(zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid city ID')).max(200).optional(),
});
router.use(auth_1.requireAuth);
router.post('/expert', async (req, res) => {
    try {
        const { displayName, title, description, categories, languages, mode, city } = req.body;
        const locationFields = locationFieldsInput.parse(req.body);
        if (!displayName?.trim() || !Array.isArray(categories) || categories.length === 0 ||
            !categories.every((value) => typeof value === 'string') ||
            (mode !== 'online' && mode !== 'on_site') || (mode === 'on_site' && !city?.trim() && !locationFields.location)) {
            return res.status(400).json({ message: 'Emri, kategoria dhe mënyra e punës janë të detyrueshme' });
        }
        const ownerUser = await (0, businessService_1.userIdForUid)(req.user.uid);
        let provider = await ProviderProfile_1.ProviderProfile.findOne({ ownerUser, providerType: 'individual', business: { $exists: false } });
        if (!provider) {
            provider = await (0, providerProfileService_1.createProviderProfile)({
                ownerUid: req.user.uid, providerType: 'individual', categories,
                languages: Array.isArray(languages) ? languages : [],
                modes: [mode],
                locations: mode === 'on_site' && city?.trim() ? [{ countryCode: 'XK', cityName: city.trim(), online: false }] : [],
                serviceAreas: city?.trim() ? [{ countryCode: 'XK', cityName: city.trim(), online: mode === 'online' }] : [],
                ...locationFields,
                publicProfile: { displayName: displayName.trim(), title: title?.trim(), description: description?.trim() },
            });
        }
        const user = await (0, userService_1.requestRoleChange)(req.user.uid, 'provider');
        return res.status(201).json({ provider, user });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Regjistrimi i ekspertit dështoi' });
    }
});
router.post('/company', async (req, res) => {
    try {
        const { publicName, legalName } = req.body;
        if (!publicName?.trim())
            return res.status(400).json({ message: 'Emri i kompanisë është i detyrueshëm' });
        const business = await (0, businessService_1.createBusiness)({ ownerUid: req.user.uid, publicName, legalName });
        const user = await (0, userService_1.requestRoleChange)(req.user.uid, 'company');
        return res.status(201).json({ business, user });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Krijimi i kompanisë dështoi' });
    }
});
exports.default = router;
//# sourceMappingURL=onboarding.routes.js.map