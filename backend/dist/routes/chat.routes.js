"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const chatService_1 = require("../services/chatService");
const router = (0, express_1.Router)();
function paramId(value) {
    return Array.isArray(value) ? value[0] : value;
}
function statusOf(err) {
    if (err && typeof err === 'object' && 'status' in err && typeof err.status === 'number') {
        return err.status;
    }
    return 400;
}
router.get('/conversations', auth_1.requireAuth, async (req, res) => {
    try {
        const conversations = await (0, chatService_1.listConversationsForUser)(req.user.uid);
        return res.json({ conversations });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkuan bisedat',
        });
    }
});
router.post('/conversations', auth_1.requireAuth, (0, auth_1.requireRole)('user', 'provider', 'company', 'admin'), async (req, res) => {
    try {
        const { providerUid, seekerUid, serviceId, serviceTitle, initialMessage } = req.body;
        const roles = req.user.roles;
        const asProvider = roles.some((role) => role === 'provider' || role === 'company') && Boolean(seekerUid?.trim());
        const resolvedSeekerUid = asProvider ? seekerUid.trim() : req.user.uid;
        const resolvedProviderUid = asProvider ? req.user.uid : providerUid || '';
        if (asProvider) {
            await (0, chatService_1.assertProviderCanMessageSeeker)(resolvedProviderUid, resolvedSeekerUid);
        }
        const result = await (0, chatService_1.openOrGetConversation)({
            seekerUid: resolvedSeekerUid,
            providerUid: resolvedProviderUid,
            serviceId,
            serviceTitle,
            initialMessage,
            senderUid: req.user.uid,
        });
        return res.status(201).json(result);
    }
    catch (err) {
        return res.status(statusOf(err)).json({
            message: err instanceof Error ? err.message : 'Nuk u hap biseda',
        });
    }
});
router.get('/conversations/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const conversation = await (0, chatService_1.getConversationForUser)(paramId(req.params.id), req.user.uid);
        return res.json({ conversation });
    }
    catch (err) {
        return res.status(statusOf(err)).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkua biseda',
        });
    }
});
router.get('/conversations/:id/messages', auth_1.requireAuth, async (req, res) => {
    try {
        const before = typeof req.query.before === 'string' ? req.query.before : undefined;
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const messages = await (0, chatService_1.listMessages)({
            conversationId: paramId(req.params.id),
            uid: req.user.uid,
            before,
            limit,
        });
        return res.json({ messages });
    }
    catch (err) {
        return res.status(statusOf(err)).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkuan mesazhet',
        });
    }
});
router.post('/conversations/:id/messages', auth_1.requireAuth, async (req, res) => {
    try {
        const { body } = req.body;
        const message = await (0, chatService_1.sendMessage)({
            conversationId: paramId(req.params.id),
            senderUid: req.user.uid,
            body: body || '',
        });
        return res.status(201).json({ message });
    }
    catch (err) {
        return res.status(statusOf(err)).json({
            message: err instanceof Error ? err.message : 'Mesazhi nuk u dërgua',
        });
    }
});
router.post('/conversations/:id/read', auth_1.requireAuth, async (req, res) => {
    try {
        const conversation = await (0, chatService_1.markConversationRead)(paramId(req.params.id), req.user.uid);
        return res.json({ conversation });
    }
    catch (err) {
        return res.status(statusOf(err)).json({
            message: err instanceof Error ? err.message : 'Nuk u shënua si i lexuar',
        });
    }
});
exports.default = router;
//# sourceMappingURL=chat.routes.js.map