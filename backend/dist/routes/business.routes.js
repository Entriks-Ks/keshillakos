"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const businessService_1 = require("../services/businessService");
const router = (0, express_1.Router)();
router.get('/managed', auth_1.requireAuth, (0, auth_1.requireRole)('company', 'admin'), async (req, res) => {
    try {
        return res.json({ businesses: await (0, businessService_1.listManagedBusinesses)(req.user.uid) });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Bizneset nuk u ngarkuan' });
    }
});
router.get('/invitations/mine', auth_1.requireAuth, (0, auth_1.requireRole)('provider'), async (req, res) => {
    try {
        return res.json({ invitations: await (0, businessService_1.listMyBusinessInvitations)(req.user.uid) });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Ftesat nuk u ngarkuan' });
    }
});
router.post('/:id/invitations/accept', auth_1.requireAuth, (0, auth_1.requireRole)('provider'), async (req, res) => {
    try {
        return res.json({ business: await (0, businessService_1.acceptBusinessInvitation)(req.user.uid, String(req.params.id)) });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Ftesa nuk u pranua' });
    }
});
router.get('/:id/team', auth_1.requireAuth, (0, auth_1.requireRole)('company', 'admin'), async (req, res) => {
    try {
        return res.json({ team: await (0, businessService_1.businessTeam)(req.user.uid, String(req.params.id)) });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Ekipi nuk u ngarkua' });
    }
});
router.post('/:id/invitations', auth_1.requireAuth, (0, auth_1.requireRole)('company', 'admin'), async (req, res) => {
    try {
        const email = req.body.email;
        if (!email?.trim())
            return res.status(400).json({ message: 'Email i ekspertit është i detyrueshëm' });
        return res.status(201).json({ team: await (0, businessService_1.inviteBusinessExpert)(req.user.uid, String(req.params.id), email) });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Ftesa nuk u dërgua' });
    }
});
router.delete('/:id/members/:userId', auth_1.requireAuth, (0, auth_1.requireRole)('company', 'admin'), async (req, res) => {
    try {
        return res.json({ team: await (0, businessService_1.removeBusinessExpert)(req.user.uid, String(req.params.id), String(req.params.userId)) });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Anëtari nuk u hoq' });
    }
});
router.get('/mine', auth_1.requireAuth, (0, auth_1.requireRole)('company', 'admin'), async (req, res) => {
    try {
        const businesses = await (0, businessService_1.listMyBusinesses)(req.user.uid);
        return res.json({ businesses });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Bizneset nuk u ngarkuan' });
    }
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('company', 'admin'), async (req, res) => {
    try {
        const { publicName, legalName, logoUrl, branches } = req.body;
        if (!publicName?.trim() || (branches !== undefined && !Array.isArray(branches))) {
            return res.status(400).json({ message: 'Emri publik i biznesit është i detyrueshëm' });
        }
        const business = await (0, businessService_1.createBusiness)({ ownerUid: req.user.uid, publicName, legalName, logoUrl, branches });
        return res.status(201).json({ business });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Biznesi nuk u krijua' });
    }
});
router.patch('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('company', 'admin'), async (req, res) => {
    try {
        const { publicName, legalName, logoUrl, branches } = req.body;
        if (branches !== undefined && !Array.isArray(branches))
            return res.status(400).json({ message: 'Degët nuk janë të vlefshme' });
        const business = await (0, businessService_1.updateBusiness)(req.user.uid, String(req.params.id), { publicName, legalName, logoUrl, branches });
        return res.json({ business });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Biznesi nuk u përditësua' });
    }
});
router.patch('/:id/review', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { status, verification } = req.body;
        if (!status || !['active', 'suspended'].includes(status) || (verification && !['unverified', 'verified', 'rejected'].includes(verification))) {
            return res.status(400).json({ message: 'Vendimi nuk është i vlefshëm' });
        }
        const business = await (0, businessService_1.reviewBusiness)(String(req.params.id), req.user.uid, status, verification);
        return res.json({ business });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Rishikimi dështoi' });
    }
});
exports.default = router;
//# sourceMappingURL=business.routes.js.map