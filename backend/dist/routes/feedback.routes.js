"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const auth_1 = require("../middleware/auth");
const platformFeedbackService_1 = require("../services/platformFeedbackService");
const router = (0, express_1.Router)();
router.post('/', async (req, res, next) => {
    if (!req.headers.authorization?.startsWith('Bearer '))
        return next();
    return (0, auth_1.requireAuth)(req, res, next);
}, async (req, res) => {
    try {
        const item = await (0, platformFeedbackService_1.createPlatformFeedback)({
            message: req.body?.message,
            name: req.body?.name,
            email: req.body?.email,
            userUid: req.user?.uid,
            userName: req.user?.name,
            userEmail: req.user?.email,
        });
        return res.status(201).json({ feedback: item });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Feedback-u nuk u dërgua';
        const status = /karaktere|gjatë|vlefshëm|nevojshëm/.test(message) ? 400 : 500;
        return res.status(status).json({ message });
    }
});
router.get('/', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (_req, res) => {
    try {
        return res.json({ feedback: await (0, platformFeedbackService_1.listPlatformFeedback)() });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Feedback-u nuk u ngarkua' });
    }
});
router.patch('/:id/read', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const id = String(req.params.id);
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Feedback i pavlefshëm' });
        }
        const item = await (0, platformFeedbackService_1.markPlatformFeedbackRead)(id);
        if (!item)
            return res.status(404).json({ message: 'Feedback-u nuk u gjet' });
        return res.json({ feedback: item });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Nuk u shënua si i lexuar' });
    }
});
exports.default = router;
//# sourceMappingURL=feedback.routes.js.map