"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pagination_1 = require("../services/pagination");
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const auth_1 = require("../middleware/auth");
const platformFeedbackService_1 = require("../services/platformFeedbackService");
const adminReportService_1 = require("../services/adminReportService");
const router = (0, express_1.Router)();
router.use(pagination_1.validatePagination);
router.get('/reports', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const reports = await (0, adminReportService_1.listUserReports)((0, pagination_1.paginationInput)(req.query, 20), (0, adminReportService_1.reportListOptions)(req.query));
        return res.json({ reports, pagination: reports.pagination, summary: reports.summary });
    }
    catch (error) {
        return res.status(error.status || 500).json({ message: 'Raportimet nuk u ngarkuan' });
    }
});
router.get('/reports/:id', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const id = String(req.params.id);
    if (!mongoose_1.Types.ObjectId.isValid(id))
        return res.status(400).json({ message: 'Raportimi është i pavlefshëm' });
    try {
        const report = await (0, adminReportService_1.userReportDetails)(id);
        return report ? res.json({ report }) : res.status(404).json({ message: 'Raportimi nuk u gjet' });
    }
    catch (error) {
        return res.status(error.status || 500).json({ message: 'Raportimi nuk u ngarkua' });
    }
});
router.patch('/reports/:id/status', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const id = String(req.params.id);
    if (!mongoose_1.Types.ObjectId.isValid(id))
        return res.status(400).json({ message: 'Raportimi është i pavlefshëm' });
    try {
        return res.json({ report: await (0, adminReportService_1.updateReportStatus)(id, req.body?.status, req.user.uid, req.body?.note) });
    }
    catch (error) {
        const status = error.status || 500;
        return res.status(status).json({ message: status === 500 ? 'Statusi i raportimit nuk u ruajt' : error.message });
    }
});
router.get('/reports/:id/conversation', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const id = String(req.params.id);
    if (!mongoose_1.Types.ObjectId.isValid(id))
        return res.status(400).json({ message: 'Raportimi është i pavlefshëm' });
    try {
        const messages = await (0, adminReportService_1.reportConversationEvidence)(id, (0, pagination_1.paginationInput)(req.query, 30), typeof req.query.before === 'string' ? req.query.before : undefined, typeof req.query.beforeId === 'string' ? req.query.beforeId : undefined);
        return res.json({ messages, pagination: messages.pagination });
    }
    catch (error) {
        return res.status(error.status || 500).json({ message: 'Biseda nuk është e disponueshme për shqyrtim' });
    }
});
router.get('/reports/:id/request', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const id = String(req.params.id);
    if (!mongoose_1.Types.ObjectId.isValid(id))
        return res.status(400).json({ message: 'Raportimi është i pavlefshëm' });
    try {
        return res.json({ request: await (0, adminReportService_1.reportRequestEvidence)(id) });
    }
    catch (error) {
        return res.status(error.status || 500).json({ message: 'Nuk ka kërkesë të lidhur të konfirmuar' });
    }
});
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
router.get('/', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const feedback = await (0, platformFeedbackService_1.listPlatformFeedback)((0, pagination_1.paginationInput)(req.query, 20));
        return res.json({ feedback, pagination: feedback.pagination, unreadTotal: feedback.unreadTotal });
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