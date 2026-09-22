"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const mediaService_1 = require("../services/mediaService");
const serviceService_1 = require("../services/serviceService");
const router = (0, express_1.Router)();
const discoveryQuery = zod_1.z.object({
    cityId: zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid city ID').optional(),
    categoryId: zod_1.z.string().trim().min(1).max(120).optional(),
    subcategoryId: zod_1.z.string().trim().min(1).max(120).optional(),
    serviceId: zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid service ID').optional(),
    q: zod_1.z.string().trim().max(160).optional(),
});
function parseServicePayload(body) {
    const title = body.title?.trim();
    const description = body.description?.trim();
    const categoryId = body.categoryId?.trim() || body.category?.trim();
    const subcategoryId = body.subcategoryId?.trim();
    const subcategory = body.subcategory?.trim();
    const location = body.location?.trim();
    if (!title || !description || !categoryId || !location || (!subcategory && !subcategoryId)) {
        throw new Error('Titulli, përshkrimi, kategoria, nënkategoria dhe lokacioni janë të detyrueshme');
    }
    let priceFrom;
    if (body.priceFrom !== undefined && body.priceFrom !== '' && body.priceFrom !== null) {
        priceFrom = typeof body.priceFrom === 'number' ? body.priceFrom : Number(body.priceFrom);
        if (Number.isNaN(priceFrom) || priceFrom < 0)
            throw new Error('Çmimi fillestar nuk është i vlefshëm');
    }
    return { title, description, categoryId, subcategory: subcategory || '', subcategoryId, location, priceFrom, details: body.details };
}
router.get('/', async (req, res) => {
    try {
        const parsed = discoveryQuery.safeParse(req.query);
        if (!parsed.success)
            return res.status(400).json({ message: 'Filtrat nuk janë të vlefshëm', errors: parsed.error.issues });
        const services = await (0, serviceService_1.listActiveServices)(parsed.data);
        return res.json({ services });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkuan shërbimet',
        });
    }
});
router.get('/mine', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'admin'), async (req, res) => {
    try {
        const services = await (0, serviceService_1.listServicesByProvider)(req.user.uid);
        return res.json({ services });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkuan shërbimet',
        });
    }
});
router.post('/photos', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'admin'), (0, mediaService_1.withImageUpload)(mediaService_1.servicePhotoUpload), (req, res) => {
    try {
        const file = (0, mediaService_1.requireUploadedImage)(req, 'Zgjidh një foto për shërbimin');
        return res.status(201).json({ url: (0, mediaService_1.toPublicUploadPath)('services', file.filename) });
    }
    catch (err) {
        return res.status(400).json({
            message: err instanceof Error ? err.message : 'Ngarkimi i fotos dështoi',
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const service = await (0, serviceService_1.getActiveServiceById)(req.params.id);
        if (!service) {
            return res.status(404).json({ message: 'Shërbimi nuk u gjet' });
        }
        return res.json({ service });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkua shërbimi',
        });
    }
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'admin'), async (req, res) => {
    try {
        const payload = parseServicePayload(req.body);
        const service = await (0, serviceService_1.createService)({
            ...payload,
            providerUid: req.user.uid,
            providerName: req.user.name,
            providerId: typeof req.body.providerId === 'string' ? req.body.providerId : undefined,
        });
        return res.status(201).json({ service });
    }
    catch (err) {
        return res.status(400).json({
            message: err instanceof Error ? err.message : 'Krijimi i shërbimit dështoi',
        });
    }
});
router.patch('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'admin'), async (req, res) => {
    try {
        const payload = parseServicePayload(req.body);
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const service = await (0, serviceService_1.updateService)(id, req.user.uid, payload);
        return res.json({ service });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Përditësimi i shërbimit dështoi';
        const status = message.includes('nuk u gjet') ? 404 : message.includes('leje') ? 403 : 400;
        return res.status(status).json({ message });
    }
});
router.delete('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'admin'), async (req, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const result = await (0, serviceService_1.deleteService)(id, req.user.uid);
        return res.json(result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Fshirja e shërbimit dështoi';
        const status = message.includes('nuk u gjet') ? 404 : message.includes('leje') ? 403 : 400;
        return res.status(status).json({ message });
    }
});
exports.default = router;
//# sourceMappingURL=service.routes.js.map