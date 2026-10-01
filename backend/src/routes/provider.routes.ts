import { Router } from 'express'
import { publicExpertsForOwner } from '../services/businessService'
import { getMarketplaceProviderByUid } from '../services/providerProfileService'
import { getPublicProviderProfile } from '../services/providerPublicService'
import { listActiveServicesByProvider } from '../services/serviceService'

const router = Router()

router.get('/:uid', async (req, res) => {
  try {
    const provider = await getPublicProviderProfile(req.params.uid)
    if (!provider) {
      return res.status(404).json({ message: 'Profili i ofruesit nuk u gjet' })
    }

    const [services, experts, profile] = await Promise.all([
      listActiveServicesByProvider(provider.uid),
      publicExpertsForOwner(provider.uid),
      getMarketplaceProviderByUid(provider.uid, provider.role === 'company' ? 'business' : 'individual'),
    ])
    return res.json({ provider, services, experts, profile })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkua profili',
    })
  }
})

export default router
