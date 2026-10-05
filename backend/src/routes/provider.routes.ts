import { paginationInput, validatePagination } from '../services/pagination'
import { Router } from 'express'
import { publicExpertPageForOwner } from '../services/businessService'
import { getMarketplaceProviderByUid } from '../services/providerProfileService'
import { getPublicProviderProfile } from '../services/providerPublicService'
import { listProviderServicePage } from '../services/serviceService'

const router = Router()
router.use(validatePagination)

router.get('/:uid', async (req, res) => {
  try {
    const provider = await getPublicProviderProfile(req.params.uid)
    if (!provider) {
      return res.status(404).json({ message: 'Profili i ofruesit nuk u gjet' })
    }

    const [services, experts, profile] = await Promise.all([
      listProviderServicePage(provider.uid, paginationInput(req.query), true),
      publicExpertPageForOwner(provider.uid, paginationInput({ ...req.query, page: req.query.expertsPage })),
      getMarketplaceProviderByUid(provider.uid, provider.role === 'company' ? 'business' : 'individual'),
    ])
    const servicesPage = { items: services.services, pagination: services.pagination }
    const expertsPage = { items: experts.experts, pagination: experts.pagination }
    return res.json({ provider, services: servicesPage.items, experts: expertsPage.items, profile, pagination: servicesPage.pagination, expertsPagination: expertsPage.pagination })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkua profili',
    })
  }
})

export default router
