"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const appointmentService_1 = require("../services/appointmentService");
const router = (0, express_1.Router)();
router.get('/mine', auth_1.requireAuth, async (req, res) => {
    try {
        return res.json({ appointments: await (0, appointmentService_1.listMyAppointments)(req.user.uid) });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Rezervimet nuk u ngarkuan' });
    }
});
router.get('/provider', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    try {
        return res.json({ appointments: await (0, appointmentService_1.listProviderAppointments)(req.user.uid) });
    }
    catch (err) {
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Rezervimet nuk u ngarkuan' });
    }
});
router.patch('/:id/cancel', auth_1.requireAuth, async (req, res) => {
    try {
        const { reason } = req.body;
        const appointment = await (0, appointmentService_1.cancelAppointment)(req.user.uid, String(req.params.id), reason, req.user.roles.includes('admin'));
        return res.json({ appointment });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Anulimi dështoi' });
    }
});
exports.default = router;
//# sourceMappingURL=appointment.routes.js.map