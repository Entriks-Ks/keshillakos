"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pagination_1 = require("../services/pagination");
const express_1 = require("express");
const businessService_1 = require("../services/businessService");
const providerProfileService_1 = require("../services/providerProfileService");
const providerPublicService_1 = require("../services/providerPublicService");
const serviceService_1 = require("../services/serviceService");
const router = (0, express_1.Router)();
router.use(pagination_1.validatePagination);
router.get('/:uid', async (req, res) => {
    try {
        const provider = await (0, providerPublicService_1.getPublicProviderProfile)(req.params.uid);
        if (!provider) {
            return res.status(404).json({ message: 'Profili i ofruesit nuk u gjet' });
        }
        const [services, experts, profile] = await Promise.all([
            (0, serviceService_1.listProviderServicePage)(provider.uid, (0, pagination_1.paginationInput)(req.query), true),
            (0, businessService_1.publicExpertPageForOwner)(provider.uid, (0, pagination_1.paginationInput)({ ...req.query, page: req.query.expertsPage })),
            (0, providerProfileService_1.getMarketplaceProviderByUid)(provider.uid, provider.role === 'company' ? 'business' : 'individual'),
        ]);
        const servicesPage = { items: services.services, pagination: services.pagination };
        const expertsPage = { items: experts.experts, pagination: experts.pagination };
        return res.json({ provider, services: servicesPage.items, experts: expertsPage.items, profile, pagination: servicesPage.pagination, expertsPagination: expertsPage.pagination });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkua profili',
        });
    }
});
exports.default = router;
//# sourceMappingURL=provider.routes.js.map