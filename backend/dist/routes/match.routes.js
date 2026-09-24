"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const matchService_1 = require("../services/matchService");
const serviceService_1 = require("../services/serviceService");
const router = (0, express_1.Router)();
const AUDIENCES = new Set(['individual', 'business']);
const LANGUAGES = new Set(['Albanian', 'German', 'English']);
const URGENCIES = new Set(['today', 'this_week', 'flexible']);
const CONTACTS = new Set(['chat', 'phone', 'email']);
router.post('/', async (req, res) => {
    try {
        const body = req.body;
        if (!body.need?.trim() || body.need.trim().length < 4) {
            return res.status(400).json({ message: 'Përshkruaj për çfarë ke nevojë për ndihmë' });
        }
        if (!body.audience || !AUDIENCES.has(body.audience)) {
            return res.status(400).json({ message: 'Zgjidh: Individual ose Business' });
        }
        if (!body.location?.trim()) {
            return res.status(400).json({ message: 'Zgjidh lokacionin' });
        }
        if ([body.cityId, body.subcategoryId, body.serviceId].some((id) => id !== undefined && (typeof id !== 'string' || !mongoose_1.Types.ObjectId.isValid(id)))) {
            return res.status(400).json({ message: 'ID i lokacionit ose shërbimit është i pavlefshëm' });
        }
        if (body.categoryId !== undefined && (typeof body.categoryId !== 'string' || !body.categoryId.trim())) {
            return res.status(400).json({ message: 'Kategoria është e pavlefshme' });
        }
        if (body.cityId && !await (0, serviceService_1.isActiveDiscoveryCity)(body.cityId))
            return res.status(404).json({ message: 'Qyteti nuk u gjet' });
        if (!body.language || !LANGUAGES.has(body.language)) {
            return res.status(400).json({ message: 'Zgjidh gjuhën' });
        }
        if (!body.urgency || !URGENCIES.has(body.urgency)) {
            return res.status(400).json({ message: 'Zgjidh urgjencën' });
        }
        if (!body.contact || !CONTACTS.has(body.contact)) {
            return res.status(400).json({ message: 'Zgjidh si të kontaktojnë ekspertët' });
        }
        const intake = {
            need: body.need.trim(),
            audience: body.audience,
            location: body.location.trim(),
            cityId: body.cityId,
            categoryId: body.categoryId?.trim(),
            subcategoryId: body.subcategoryId,
            serviceId: body.serviceId,
            language: body.language,
            urgency: body.urgency,
            budget: body.budget?.trim() || undefined,
            contact: body.contact,
        };
        const result = await (0, matchService_1.matchExperts)(intake);
        return res.json({ intake, ...result });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Matching dështoi',
        });
    }
});
exports.default = router;
//# sourceMappingURL=match.routes.js.map