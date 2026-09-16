import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { ProviderProfile } from '../models/ProviderProfile'
import { createBusiness, userIdForUid } from '../services/businessService'
import { createProviderProfile } from '../services/providerProfileService'
import { grantCapability } from '../services/userService'

const router = Router()
router.use(requireAuth)

router.post('/expert', async (req, res) => {
  try {
    const { displayName, title, description, categories, languages, mode, city } = req.body as {
      displayName?: string; title?: string; description?: string; categories?: string[]
      languages?: string[]; mode?: 'online' | 'on_site'; city?: string
    }
    if (!displayName?.trim() || !Array.isArray(categories) || categories.length === 0 ||
      !categories.every((value) => typeof value === 'string') ||
      (mode !== 'online' && mode !== 'on_site') || (mode === 'on_site' && !city?.trim())) {
      return res.status(400).json({ message: 'Emri, kategoria dhe mënyra e punës janë të detyrueshme' })
    }
    const ownerUser = await userIdForUid(req.user!.uid)
    let provider = await ProviderProfile.findOne({ ownerUser, providerType: 'individual', business: { $exists: false } })
    if (!provider) {
      provider = await createProviderProfile({
        ownerUid: req.user!.uid, providerType: 'individual', categories,
        languages: Array.isArray(languages) ? languages : [],
        modes: [mode],
        locations: mode === 'on_site' ? [{ countryCode: 'XK', cityName: city!.trim(), online: false }] : [],
        serviceAreas: [{ countryCode: 'XK', cityName: mode === 'on_site' ? city!.trim() : undefined, online: mode === 'online' }],
        publicProfile: { displayName: displayName.trim(), title: title?.trim(), description: description?.trim() },
      })
    }
    const user = await grantCapability(req.user!.uid, 'provider')
    return res.status(201).json({ provider, user })
  } catch (err) {
    return res.status(400).json({ message: err instanceof Error ? err.message : 'Regjistrimi i ekspertit dështoi' })
  }
})

router.post('/company', async (req, res) => {
  try {
    const { publicName, legalName } = req.body as { publicName?: string; legalName?: string }
    if (!publicName?.trim()) return res.status(400).json({ message: 'Emri i kompanisë është i detyrueshëm' })
    const business = await createBusiness({ ownerUid: req.user!.uid, publicName, legalName })
    const user = await grantCapability(req.user!.uid, 'company')
    return res.status(201).json({ business, user })
  } catch (err) {
    return res.status(400).json({ message: err instanceof Error ? err.message : 'Krijimi i kompanisë dështoi' })
  }
})

export default router
