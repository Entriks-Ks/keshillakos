import { Router } from 'express'
import { publicExpertsForOwner } from '../services/businessService'
import { getPublicProviderProfile } from '../services/providerPublicService'
import { listActiveServicesByProvider } from '../services/serviceService'

const router = Router()

router.get('/:uid', async (req, res) => {
  try {
    const provider = await getPublicProviderProfile(req.params.uid)
    if (!provider) {
      return res.status(404).json({ message: 'Profili i ofruesit nuk u gjet' })
    }

    const [services, experts] = await Promise.all([
      listActiveServicesByProvider(provider.uid),
      publicExpertsForOwner(provider.uid),
    ])
    return res.json({ provider, services, experts })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkua profili',
    })
  }
})

export default router
