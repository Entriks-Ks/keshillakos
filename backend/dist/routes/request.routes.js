"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const ServiceRequest_1 = require("../models/ServiceRequest");
const requestService_1 = require("../services/requestService");
const RequestDelivery_1 = require("../models/RequestDelivery");
const chatService_1 = require("../services/chatService");
const userRequestService_1 = require("../services/userRequestService");
const router = (0, express_1.Router)();
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('user', 'provider', 'company', 'admin'), async (req, res) => {
    try {
        const { providerUid, providerName, serviceId, serviceTitle, need, message, location, language, urgency, contactMethod, contactPhone, contactEmail, slotId, providerId, providerIds, categoryId, locationDetail, budget, preferredMode, portal, draft, } = req.body;
        if (!draft && !providerUid?.trim() && !providerId && !providerIds?.length) {
            return res.status(400).json({ message: 'Ofruesi është i detyrueshëm' });
        }
        if (!need?.trim() || !message?.trim()) {
            return res.status(400).json({ message: 'Nevoja dhe mesazhi janë të detyrueshme' });
        }
        if (!contactMethod || !ServiceRequest_1.CONTACT_METHODS.includes(contactMethod)) {
            return res.status(400).json({ message: 'Zgjidh mënyrën e kontaktit' });
        }
        if (!contactPhone?.trim()) {
            return res.status(400).json({ message: 'Shkruaj numrin e telefonit' });
        }
        if (contactMethod === 'email' && !contactEmail?.trim()) {
            return res.status(400).json({ message: 'Shkruaj email-in' });
        }
        if (!draft && !slotId?.trim()) {
            return res.status(400).json({ message: 'Zgjidh një orë të lirë për kërkesën' });
        }
        const created = await (0, userRequestService_1.createUserRequest)({
            uid: req.user.uid, providerIds: providerIds ?? (providerId ? [providerId] : undefined),
            providerUid: providerUid?.trim(), categoryId, serviceId,
            problem: need, description: message,
            location: locationDetail, legacyLocation: location,
            language, urgency: urgency,
            budget, preferredMode, contactPreference: contactMethod,
            contactPhone, contactEmail,
            portal, slotId, draft,
        });
        const request = (await (0, userRequestService_1.listMyUserRequests)(req.user.uid)).find((item) => item.requestId === String(created.request._id));
        const chatProviderUid = request?.providerUid || providerUid?.trim();
        if (chatProviderUid) {
            try {
                await (0, chatService_1.openOrGetConversation)({
                    seekerUid: req.user.uid,
                    providerUid: chatProviderUid,
                    serviceId,
                    serviceTitle,
                });
            }
            catch {
                // Request is already saved; chat thread is best-effort.
            }
        }
        return res.status(201).json({ request });
    }
    catch (err) {
        return res.status(400).json({
            message: err instanceof Error ? err.message : 'Dërgimi i kërkesës dështoi',
        });
    }
});
router.get('/mine', auth_1.requireAuth, (0, auth_1.requireRole)('user', 'provider', 'company', 'admin'), async (req, res) => {
    try {
        const [canonical, legacy] = await Promise.all([(0, userRequestService_1.listMyUserRequests)(req.user.uid), (0, requestService_1.listRequestsBySeeker)(req.user.uid)]);
        const requests = [...canonical, ...legacy];
        return res.json({ requests });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkuan kërkesat',
        });
    }
});
router.get('/inbox', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        const [canonical, legacy, canonicalPending, legacyPending] = await Promise.all([
            (0, userRequestService_1.listProviderDeliveries)(req.user.uid), (0, requestService_1.listRequestsByProvider)(req.user.uid),
            (0, userRequestService_1.countPendingDeliveries)(req.user.uid), (0, requestService_1.countPendingForProvider)(req.user.uid),
        ]);
        const requests = [...canonical, ...legacy];
        const pendingCount = canonicalPending + legacyPending;
        return res.json({ requests, pendingCount });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkua inbox-i',
        });
    }
});
router.get('/all', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (_req, res) => {
    try {
        const [canonical, legacy] = await Promise.all([(0, userRequestService_1.listAllUserRequests)(), (0, requestService_1.listAllRequests)()]);
        const requests = [...canonical, ...legacy];
        return res.json({ requests });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkuan kërkesat',
        });
    }
});
router.post('/:id/deliver', auth_1.requireAuth, (0, auth_1.requireRole)('user', 'provider', 'company', 'admin'), async (req, res) => {
    try {
        const { providerIds } = req.body;
        if (!Array.isArray(providerIds) || !providerIds.length)
            return res.status(400).json({ message: 'Zgjidh të paktën një ofrues' });
        const requests = await (0, userRequestService_1.sendExistingRequest)(req.user.uid, String(req.params.id), providerIds);
        return res.json({ requests });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Dërgimi dështoi' });
    }
});
router.patch('/:id/lifecycle', auth_1.requireAuth, (0, auth_1.requireRole)('user', 'provider', 'company', 'admin'), async (req, res) => {
    try {
        const { status } = req.body;
        if (status !== 'closed' && status !== 'cancelled')
            return res.status(400).json({ message: 'Status i pavlefshëm' });
        const requests = await (0, userRequestService_1.updateUserRequestLifecycle)(req.user.uid, String(req.params.id), status);
        return res.json({ requests });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Përditësimi dështoi' });
    }
});
router.patch('/:id/status', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        const { status, providerNote, offer } = req.body;
        if (!status || (!ServiceRequest_1.REQUEST_STATUSES.includes(status) && !RequestDelivery_1.DELIVERY_STATUSES.includes(status))) {
            return res.status(400).json({ message: 'Status i pavlefshëm' });
        }
        const id = String(req.params.id);
        const isCanonical = await RequestDelivery_1.RequestDelivery.exists({ _id: id });
        const request = isCanonical
            ? await (0, userRequestService_1.updateDeliveryStatus)(req.user.uid, id, status, providerNote, req.user.roles.includes('admin'), offer)
            : await (0, requestService_1.updateRequestStatus)({ id, providerUid: req.user.uid, status: status, providerNote, asAdmin: req.user.roles.includes('admin') });
        return res.json({ request });
    }
    catch (err) {
        return res.status(400).json({
            message: err instanceof Error ? err.message : 'Përditësimi dështoi',
        });
    }
});
exports.default = router;
//# sourceMappingURL=request.routes.js.map