"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const livekitService_1 = require("../services/livekitService");
const callService_1 = require("../services/callService");
const router = (0, express_1.Router)();
function statusOf(err) {
    if (err &&
        typeof err === 'object' &&
        'status' in err &&
        typeof err.status === 'number') {
        return err.status;
    }
    return 400;
}
/**
 * Generate a LiveKit access token for an active call.
 * Authenticated user must be caller or receiver.
 */
router.post('/token', auth_1.requireAuth, async (req, res) => {
    try {
        const { callId } = req.body;
        if (!callId || typeof callId !== 'string') {
            return res.status(400).json({ message: 'Mungon ID e thirrjes' });
        }
        const call = await (0, callService_1.getCallById)(callId, req.user.uid);
        if (call.status !== 'ringing' && call.status !== 'accepted') {
            return res.status(400).json({
                message: `Thirrja ka përfunduar ose është e pavlefshme (statusi: ${call.status})`,
            });
        }
        const token = await (0, livekitService_1.generateLivekitToken)({
            roomName: call.roomName,
            identity: req.user.uid,
            name: req.user.name,
        });
        const { url } = (0, livekitService_1.getLivekitConfig)();
        return res.json({
            token,
            roomName: call.roomName,
            livekitUrl: url,
        });
    }
    catch (err) {
        return res.status(statusOf(err)).json({
            message: err instanceof Error ? err.message : 'Dështoi gjenerimi i tokenit të LiveKit',
        });
    }
});
/**
 * Fetch current active call for the logged in user, if any.
 */
router.get('/active', auth_1.requireAuth, async (req, res) => {
    try {
        const activeCall = await (0, callService_1.getActiveCallForUser)(req.user.uid);
        if (!activeCall) {
            return res.json({ activeCall: null });
        }
        const formatted = await (0, callService_1.formatCallDoc)(activeCall, req.user.uid);
        return res.json({ activeCall: formatted });
    }
    catch (err) {
        return res.status(statusOf(err)).json({
            message: err instanceof Error ? err.message : 'Gabim gjatë leximit të thirrjes aktive',
        });
    }
});
/**
 * Fetch call history for logged in user.
 */
router.get('/history', auth_1.requireAuth, async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const history = await (0, callService_1.listCallHistory)(req.user.uid, page, limit);
        return res.json(history);
    }
    catch (err) {
        return res.status(statusOf(err)).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkua historiku i thirrjeve',
        });
    }
});
/**
 * Fetch single call by ID.
 */
router.get('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const callId = req.params.id;
        const call = await (0, callService_1.getCallById)(callId, req.user.uid);
        const formatted = await (0, callService_1.formatCallDoc)(call, req.user.uid);
        return res.json({ call: formatted });
    }
    catch (err) {
        return res.status(statusOf(err)).json({
            message: err instanceof Error ? err.message : 'Thirrja nuk u gjet',
        });
    }
});
exports.default = router;
//# sourceMappingURL=call.routes.js.map