"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const providerPublicService_1 = require("../services/providerPublicService");
const serviceService_1 = require("../services/serviceService");
const router = (0, express_1.Router)();
router.get('/:uid', async (req, res) => {
    try {
        const provider = await (0, providerPublicService_1.getPublicProviderProfile)(req.params.uid);
        if (!provider) {
            return res.status(404).json({ message: 'Profili i ofruesit nuk u gjet' });
        }
        const services = await (0, serviceService_1.listActiveServicesByProvider)(provider.uid);
        return res.json({ provider, services });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkua profili',
        });
    }
});
exports.default = router;
//# sourceMappingURL=provider.routes.js.map