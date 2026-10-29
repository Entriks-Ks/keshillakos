import { paginationInput, validatePagination } from '../services/pagination'
import { Router } from 'express'
import { publicExpertPageForOwner } from '../services/businessService'
import { getMarketplaceProviderByUid } from '../services/providerProfileService'
import { getPublicProviderProfile } from '../services/providerPublicService'
import { listProviderServicePage } from '../services/serviceService'
import { listOpenAvailabilityForProvider } from '../services/availabilityService'

const router = Router()
router.use(validatePagination)

const serverCompareCache = new Map<string, { data: unknown[]; timestamp: number }>()
const SERVER_CACHE_TTL = 60_000 // 60 seconds

router.get('/compare', async (req, res) => {
  try {
    const rawUids = req.query.uids
    const uids = (Array.isArray(rawUids) ? rawUids.join(',') : String(rawUids || ''))
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3)

    if (uids.length === 0) {
      return res.json({ providers: [] })
    }

    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')

    const cacheKey = [...uids].sort().join(',')
    const now = Date.now()
    const cached = serverCompareCache.get(cacheKey)
    if (cached && now - cached.timestamp < SERVER_CACHE_TTL) {
      return res.json({ providers: cached.data })
    }

    const items = await Promise.all(
      uids.map(async (uid) => {
        try {
          const provider = await getPublicProviderProfile(uid)
          if (!provider) return null

          const [servicesData, profile, slotsData] = await Promise.all([
            listProviderServicePage(provider.uid, { page: 1, limit: 8 }, true).catch(() => ({ services: [], pagination: { page: 1, limit: 8, total: 0, totalPages: 0 } })),
            getMarketplaceProviderByUid(provider.uid, provider.role === 'company' ? 'business' : 'individual').catch(() => null),
            listOpenAvailabilityForProvider(provider.uid, { page: 1, limit: 6 }).catch(() => Object.assign([], { pagination: { page: 1, limit: 6, total: 0, totalPages: 0 } })),
          ])

          return {
            uid: provider.uid,
            provider,
            profile,
            services: servicesData?.services ?? [],
            openSlots: Array.isArray(slotsData) ? slotsData : ((slotsData as { slots?: unknown[] })?.slots ?? []),
          }
        } catch {
          return null
        }
      })
    )

    const validProviders = items.filter(Boolean)
    serverCompareCache.set(cacheKey, { data: validProviders, timestamp: now })

    return res.json({ providers: validProviders })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkua krahasimi i ofruesve',
    })
  }
})

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
