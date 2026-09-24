"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const expertService_1 = require("../services/expertService");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    try {
        const experts = await (0, expertService_1.listActiveExperts)();
        return res.json({ experts });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkuan ekspertët',
        });
    }
});
router.get('/mine', auth_1.requireAuth, (0, auth_1.requireRole)('company', 'admin'), async (req, res) => {
    try {
        const experts = await (0, expertService_1.listExpertsByCompany)(req.user.uid);
        return res.json({ experts });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkuan ekspertët',
        });
    }
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('company', 'admin'), async (req, res) => {
    try {
        const { name, title, categoryId, specialty, bio, location, licenseNumber, languageFrom, languageTo, deliveryModes, crossBorder, } = req.body;
        if (!name?.trim() ||
            !title?.trim() ||
            !categoryId?.trim() ||
            !specialty?.trim() ||
            !bio?.trim() ||
            !location?.trim()) {
            return res.status(400).json({
                message: 'Emri, titulli, kategoria, specialiteti, bio dhe lokacioni janë të detyrueshme',
            });
        }
        const expert = await (0, expertService_1.createExpert)({
            name,
            title,
            categoryId,
            specialty,
            bio,
            location,
            licenseNumber,
            languageFrom,
            languageTo,
            deliveryModes,
            crossBorder,
            ownerUid: req.user.uid,
            ownerName: req.user.name,
        });
        return res.status(201).json({ expert });
    }
    catch (err) {
        return res.status(400).json({
            message: err instanceof Error ? err.message : 'Shtimi i ekspertit dështoi',
        });
    }
});
exports.default = router;
//# sourceMappingURL=expert.routes.js.map