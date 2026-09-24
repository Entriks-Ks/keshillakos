"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const serviceOfferService_1 = require("../services/serviceOfferService");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    try {
        return res.json({ offers: (await (0, serviceOfferService_1.listPublishedServiceOffers)()).map(serviceOfferService_1.toPublicServiceOffer) });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Shërbimet nuk u ngarkuan' });
    }
});
router.get('/mine', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        return res.json({ offers: await (0, serviceOfferService_1.listMyServiceOffers)(req.user.uid) });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Shërbimet nuk u ngarkuan' });
    }
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        const body = req.body;
        if (!body.providerId || !body.categoryId || !body.name?.trim() || !body.description?.trim() || !body.price?.model) {
            return res.status(400).json({ message: 'Profili, kategoria, emri, përshkrimi dhe çmimi janë të detyrueshme' });
        }
        const offer = await (0, serviceOfferService_1.createServiceOffer)({
            ownerUid: req.user.uid, providerId: body.providerId, portal: body.portal,
            categoryId: body.categoryId, name: body.name, subtitle: body.subtitle,
            description: body.description, price: body.price, durationMinutes: body.durationMinutes,
            formats: body.formats, modes: body.modes, languages: body.languages,
            serviceAreas: body.serviceAreas, availabilityMode: body.availabilityMode,
            visibility: body.visibility, extensions: body.extensions,
        });
        return res.status(201).json({ offer });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Shërbimi nuk u krijua' });
    }
});
router.patch('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        const body = req.body;
        const offer = await (0, serviceOfferService_1.updateServiceOffer)(req.user.uid, String(req.params.id), {
            name: body.name, subtitle: body.subtitle, description: body.description,
            price: body.price, durationMinutes: body.durationMinutes, formats: body.formats,
            modes: body.modes, languages: body.languages, serviceAreas: body.serviceAreas,
            availabilityMode: body.availabilityMode, visibility: body.visibility, extensions: body.extensions,
        });
        return res.json({ offer });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Shërbimi nuk u përditësua' });
    }
});
router.patch('/:id/review', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { decision } = req.body;
        if (decision !== 'approved' && decision !== 'rejected')
            return res.status(400).json({ message: 'Vendimi nuk është i vlefshëm' });
        const offer = await (0, serviceOfferService_1.reviewServiceOffer)(String(req.params.id), req.user.uid, decision);
        return res.json({ offer });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Moderimi dështoi' });
    }
});
exports.default = router;
//# sourceMappingURL=serviceOffer.routes.js.map