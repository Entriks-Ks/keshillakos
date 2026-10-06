"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chatUnreadService_1 = require("../services/chatUnreadService");
const pagination_1 = require("../services/pagination");
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const chatService_1 = require("../services/chatService");
const chatSafetyService_1 = require("../services/chatSafetyService");
const chatContextService_1 = require("../services/chatContextService");
const router = (0, express_1.Router)();
router.use(pagination_1.validatePagination);
function paramId(value) {
    return Array.isArray(value) ? value[0] : value;
}
function statusOf(err) {
    if (err && typeof err === 'object' && 'status' in err && typeof err.status === 'number') {
        return err.status;
    }
    return 400;
}
router.get('/unread-count', auth_1.requireAuth, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'private, no-store');
        return res.json({ unreadCount: await (0, chatUnreadService_1.chatUnreadCount)(req.user.uid) });
    }
    catch (error) {
        return res.status(500).json({ message: 'Nuk u ngarkuan mesazhet e palexuara' });
    }
});
router.get('/conversations', auth_1.requireAuth, async (req, res) => {
    try {
        const conversations = await (0, chatService_1.listConversationsForUser)(req.user.uid, (0, pagination_1.paginationInput)(req.query, 20), typeof req.query.q === "string" ? req.query.q : "");
        return res.json({ conversations, pagination: conversations.pagination, summary: conversations.summary });
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
        if (seekerUid !== undefined && typeof seekerUid !== 'string')
            return res.status(400).json({ message: 'Përdoruesi është i pavlefshëm' });
        if (providerUid !== undefined && typeof providerUid !== 'string')
            return res.status(400).json({ message: 'Ofruesi është i pavlefshëm' });
        if (initialMessage !== undefined && typeof initialMessage !== 'string')
            return res.status(400).json({ message: 'Mesazhi është i pavlefshëm' });
        const asProvider = roles.some((role) => role === 'provider' || role === 'company') && Boolean(seekerUid?.trim());
        const resolvedSeekerUid = asProvider ? seekerUid.trim() : req.user.uid;
        const resolvedProviderUid = asProvider ? req.user.uid : providerUid || '';
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
router.get('/conversations/:id/details', auth_1.requireAuth, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'private, no-store');
        const conversation = await (0, chatService_1.assertParticipant)(paramId(req.params.id), req.user.uid);
        const peerUid = req.user.uid === conversation.seekerUid ? conversation.providerUid : conversation.seekerUid;
        const [availability, requestContext] = await Promise.all([(0, chatSafetyService_1.chatAvailability)(req.user.uid, peerUid), (0, chatContextService_1.chatRequestContext)(conversation)]);
        return res.json({ ...availability, requestContext });
    }
    catch (error) {
        return res.status(statusOf(error)).json({ message: error instanceof Error ? error.message : 'Gabim' });
    }
});
router.post('/conversations/:id/block', auth_1.requireAuth, async (req, res) => {
    try {
        if (typeof req.body.blocked !== 'boolean')
            return res.status(400).json({ message: 'Zgjedhja është e pavlefshme' });
        const conversation = await (0, chatService_1.assertParticipant)(paramId(req.params.id), req.user.uid);
        return res.json(await (0, chatSafetyService_1.setChatBlock)(conversation, req.user.uid, req.body.blocked));
    }
    catch (error) {
        return res.status(statusOf(error)).json({ message: error instanceof Error ? error.message : 'Gabim' });
    }
});
router.post('/conversations/:id/report', auth_1.requireAuth, async (req, res) => {
    try {
        const conversation = await (0, chatService_1.assertParticipant)(paramId(req.params.id), req.user.uid);
        await (0, chatSafetyService_1.reportChatUser)(conversation, req.user.uid, req.body.reason);
        return res.status(201).json({ ok: true });
    }
    catch (error) {
        return res.status(statusOf(error)).json({ message: error instanceof Error ? error.message : 'Gabim' });
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
        const { page, limit } = (0, pagination_1.paginationInput)(req.query, 50);
        const messages = await (0, chatService_1.listMessages)({
            conversationId: paramId(req.params.id),
            uid: req.user.uid,
            before,
            page,
            limit,
        });
        return res.json({ messages, pagination: messages.pagination });
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