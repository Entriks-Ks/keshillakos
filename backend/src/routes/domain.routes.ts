import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import { createCustomDomain, listAllDomains } from '../services/domainService'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const domains = await listAllDomains()
    return res.json({ domains })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan domenet',
    })
  }
})

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { labelSq, labelDe, examples, keywords } = req.body as {
      labelSq?: string
      labelDe?: string
      examples?: string[]
      keywords?: string[]
    }

    if (!labelSq?.trim()) {
      return res.status(400).json({ message: 'Emri i kategorisë (SQ) është i detyrueshëm' })
    }

    const domain = await createCustomDomain({
      labelSq,
      labelDe: labelDe?.trim() || labelSq.trim(),
      examples,
      keywords,
      createdByUid: req.user!.uid,
    })

    return res.status(201).json({ domain })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Krijimi i kategorisë dështoi',
    })
  }
})

export default router
