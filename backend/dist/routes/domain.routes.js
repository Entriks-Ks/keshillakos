"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const domainService_1 = require("../services/domainService");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const domains = await (0, domainService_1.listAllDomains)(typeof req.query.portal === 'string' ? req.query.portal : undefined);
        return res.json({ domains });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkuan domenet',
        });
    }
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { portal, stableId, slug, labels, guidelines, parent, order, status, extensionFields, requirements, configRefs, labelSq, labelDe, examples, keywords } = req.body;
        if (!labels?.sq?.trim() && !labelSq?.trim()) {
            return res.status(400).json({ message: 'Emri i kategorisë (SQ) është i detyrueshëm' });
        }
        const domain = stableId ? await (0, domainService_1.createCategory)({
            portal: portal || 'keshillakos', stableId, slug, labels: labels ?? { sq: labelSq.trim(), de: labelDe?.trim() || labelSq.trim() },
            parent, order, status, extensionFields, requirements, configRefs, examples, keywords, guidelines,
        }) : await (0, domainService_1.createCustomDomain)({
            labelSq: labelSq || labels.sq,
            labelDe: labelDe?.trim() || labels?.de || labelSq || labels.sq,
            examples, keywords, createdByUid: req.user.uid,
        });
        return res.status(201).json({ domain });
    }
    catch (err) {
        return res.status(400).json({
            message: err instanceof Error ? err.message : 'Krijimi i kategorisë dështoi',
        });
    }
});
router.patch('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const body = req.body;
        const domain = await (0, domainService_1.updateCategory)(String(req.params.id), {
            slug: body.slug, parent: body.parent, labels: body.labels, guidelines: body.guidelines, order: body.order,
            status: body.status, examples: body.examples, keywords: body.keywords,
            requirements: body.requirements, extensionFields: body.extensionFields, configRefs: body.configRefs,
        });
        return res.json({ domain });
    }
    catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Kategoria nuk u përditësua' });
    }
});
exports.default = router;
//# sourceMappingURL=domain.routes.js.map