"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const businessService_1 = require("../services/businessService");
const providerPublicService_1 = require("../services/providerPublicService");
const serviceService_1 = require("../services/serviceService");
const router = (0, express_1.Router)();
router.get('/:uid', async (req, res) => {
    try {
        const provider = await (0, providerPublicService_1.getPublicProviderProfile)(req.params.uid);
        if (!provider) {
            return res.status(404).json({ message: 'Profili i ofruesit nuk u gjet' });
        }
        const [services, experts] = await Promise.all([
            (0, serviceService_1.listActiveServicesByProvider)(provider.uid),
            (0, businessService_1.publicExpertsForOwner)(provider.uid),
        ]);
        return res.json({ provider, services, experts });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkua profili',
        });
    }
});
exports.default = router;
//# sourceMappingURL=provider.routes.js.map