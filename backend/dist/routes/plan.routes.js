"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const catalog_1 = require("../plans/catalog");
const planService_1 = require("../services/planService");
const router = (0, express_1.Router)();
router.get('/', (_req, res) => {
    res.json({
        testMode: (0, catalog_1.isPlanTestMode)(),
        plans: [
            {
                id: 'basic',
                price: 0,
                interval: null,
                bio: catalog_1.PLAN_LIMITS.basicBio,
            },
            {
                id: 'pro',
                monthly: catalog_1.PLAN_LIMITS.monthlyPrice,
                yearly: catalog_1.PLAN_LIMITS.yearlyPrice,
                trialDays: catalog_1.PLAN_LIMITS.trialDays,
                bio: catalog_1.PLAN_LIMITS.proBio,
                photos: catalog_1.PLAN_LIMITS.galleryPhotos,
                videos: catalog_1.PLAN_LIMITS.videos,
                specialties: catalog_1.PLAN_LIMITS.specialties,
                faqs: catalog_1.PLAN_LIMITS.faqs,
                references: catalog_1.PLAN_LIMITS.references,
                qualifications: catalog_1.PLAN_LIMITS.qualifications,
            },
        ],
    });
});
router.get('/mine', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company', 'admin'), async (req, res) => {
    const audience = req.query.audience === 'company' ? 'company' : 'provider';
    const roles = req.user.roles ?? [];
    if (audience === 'company' && !roles.includes('company') && req.user.role !== 'company') {
        return res.status(403).json({ message: 'Ky plan është për kompanitë.' });
    }
    if (audience === 'provider' && !roles.includes('provider') && req.user.role !== 'provider' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Ky plan është për ofruesit.' });
    }
    return res.json({ subscription: await (0, planService_1.getPlan)(req.user.uid, audience) });
});
const choiceSchema = zod_1.z.object({
    audience: zod_1.z.enum(['provider', 'company']),
    choice: zod_1.z.enum(['basic', 'monthly', 'yearly', 'trial']),
});
router.post('/choose', auth_1.requireAuth, (0, auth_1.requireRole)('provider', 'company'), async (req, res) => {
    const parsed = choiceSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Zgjedhja e planit nuk është e vlefshme.' });
    const roles = req.user.roles ?? [req.user.role];
    if (!roles.includes(parsed.data.audience) && req.user.role !== parsed.data.audience) {
        return res.status(403).json({ message: 'Nuk ke këtë rol.' });
    }
    try {
        const subscription = await (0, planService_1.choosePlan)(req.user.uid, parsed.data.audience, parsed.data.choice);
        return res.json({ subscription });
    }
    catch (err) {
        if (err instanceof planService_1.PlanError)
            return res.status(err.status).json({ message: err.message });
        return res.status(500).json({ message: err instanceof Error ? err.message : 'Plani nuk u ndryshua.' });
    }
});
exports.default = router;
//# sourceMappingURL=plan.routes.js.map