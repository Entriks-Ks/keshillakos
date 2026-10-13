import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth'
import { PLAN_LIMITS, isPlanTestMode } from '../plans/catalog'
import { PlanError, choosePlan, getPlan } from '../services/planService'

const router = Router()

router.get('/', (_req, res) => {
  res.json({
    testMode: isPlanTestMode(),
    plans: [
      {
        id: 'basic',
        price: 0,
        interval: null,
        bio: PLAN_LIMITS.basicBio,
      },
      {
        id: 'pro',
        monthly: PLAN_LIMITS.monthlyPrice,
        yearly: PLAN_LIMITS.yearlyPrice,
        trialDays: PLAN_LIMITS.trialDays,
        bio: PLAN_LIMITS.proBio,
        photos: PLAN_LIMITS.galleryPhotos,
        videos: PLAN_LIMITS.videos,
        specialties: PLAN_LIMITS.specialties,
        faqs: PLAN_LIMITS.faqs,
        references: PLAN_LIMITS.references,
        qualifications: PLAN_LIMITS.qualifications,
      },
    ],
  })
})

router.get('/mine', requireAuth, requireRole('provider', 'company', 'admin'), async (req, res) => {
  const audience = req.query.audience === 'company' ? 'company' : 'provider'
  const roles = req.user!.roles ?? []
  if (audience === 'company' && !roles.includes('company') && req.user!.role !== 'company') {
    return res.status(403).json({ message: 'Ky plan është për kompanitë.' })
  }
  if (audience === 'provider' && !roles.includes('provider') && req.user!.role !== 'provider' && req.user!.role !== 'admin') {
    return res.status(403).json({ message: 'Ky plan është për ofruesit.' })
  }
  return res.json({ subscription: await getPlan(req.user!.uid, audience) })
})

const choiceSchema = z.object({
  audience: z.enum(['provider', 'company']),
  choice: z.enum(['basic', 'monthly', 'yearly', 'trial']),
})

router.post('/choose', requireAuth, requireRole('provider', 'company'), async (req, res) => {
  const parsed = choiceSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Zgjedhja e planit nuk është e vlefshme.' })
  const roles = req.user!.roles ?? [req.user!.role]
  if (!roles.includes(parsed.data.audience) && req.user!.role !== parsed.data.audience) {
    return res.status(403).json({ message: 'Nuk ke këtë rol.' })
  }
  try {
    const subscription = await choosePlan(req.user!.uid, parsed.data.audience, parsed.data.choice)
    return res.json({ subscription })
  } catch (err) {
    if (err instanceof PlanError) return res.status(err.status).json({ message: err.message })
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Plani nuk u ndryshua.' })
  }
})

export default router
