"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const availabilityService_1 = require("../services/availabilityService");
const router = (0, express_1.Router)();
router.get('/provider/:uid', async (req, res) => {
    try {
        const uid = String(req.params.uid || '').trim();
        if (!uid)
            return res.status(400).json({ message: 'Mungon ofruesi' });
        const view = typeof req.query.view === 'string' ? req.query.view : 'open';
        if (view === 'schedule') {
            const schedule = await (0, availabilityService_1.listScheduleForProvider)(uid);
            return res.json(schedule);
        }
        const slots = await (0, availabilityService_1.listOpenAvailabilityForProvider)(uid);
        return res.json({ slots });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkuan oraret',
        });
    }
});
router.get('/mine', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        const slots = await (0, availabilityService_1.listMyAvailability)(req.user.uid);
        return res.json({ slots });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkuan oraret',
        });
    }
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        const { startAt, endAt, note, providerId, businessId, serviceOfferId, staffUserId, resourceKey, timezone, mode, location, capacity } = req.body;
        if (!startAt || !endAt) {
            return res.status(400).json({ message: 'Data dhe ora janë të detyrueshme' });
        }
        const slot = await (0, availabilityService_1.createAvailabilitySlot)({
            providerUid: req.user.uid,
            providerName: req.user.name,
            providerId, businessId, serviceOfferId, staffUserId, resourceKey,
            startAt,
            endAt,
            timezone, mode, location, capacity,
            note,
        });
        return res.status(201).json({ slot });
    }
    catch (err) {
        return res.status(400).json({
            message: err instanceof Error ? err.message : 'Shtimi i orarit dështoi',
        });
    }
});
router.post('/bulk', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        const { slots, note, timezone, mode, providerId } = req.body;
        if (!Array.isArray(slots) || !slots.length) {
            return res.status(400).json({ message: 'Zgjidh të paktën një orë' });
        }
        const result = await (0, availabilityService_1.createAvailabilitySlotsBulk)({
            providerUid: req.user.uid,
            providerName: req.user.name,
            providerId,
            slots: slots.filter((slot) => slot.startAt && slot.endAt).map((slot) => ({ startAt: slot.startAt, endAt: slot.endAt })),
            timezone, mode, note,
        });
        return res.status(201).json(result);
    }
    catch (err) {
        return res.status(400).json({
            message: err instanceof Error ? err.message : 'Shtimi i orarit dështoi',
        });
    }
});
router.delete('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        const result = await (0, availabilityService_1.deleteAvailabilitySlot)({
            id: String(req.params.id),
            providerUid: req.user.uid,
            asAdmin: req.user.roles.includes('admin'),
        });
        return res.json(result);
    }
    catch (err) {
        return res.status(400).json({
            message: err instanceof Error ? err.message : 'Fshirja e orarit dështoi',
        });
    }
});
exports.default = router;
//# sourceMappingURL=availability.routes.js.map