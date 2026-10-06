"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const notificationService_1 = require("../services/notificationService");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
router.get('/', async (req, res, next) => {
    try {
        const page = Number(req.query.page ?? 1);
        if (!Number.isInteger(page) || page < 1 || page > 10000)
            return res.status(400).json({ message: 'Faqe e pavlefshme' });
        res.json(await (0, notificationService_1.notificationHistory)(req.user.uid, page));
    }
    catch (error) {
        next(error);
    }
});
router.get('/unread-count', async (req, res, next) => {
    try {
        res.json({ unreadCount: await (0, notificationService_1.unreadCount)(req.user.uid) });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/read-all', async (req, res, next) => {
    try {
        res.json(await (0, notificationService_1.markRead)(req.user.uid));
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:id/read', async (req, res, next) => {
    try {
        res.json(await (0, notificationService_1.markRead)(req.user.uid, String(req.params.id)));
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : 'Gabim' });
    }
});
exports.default = router;
//# sourceMappingURL=notification.routes.js.map