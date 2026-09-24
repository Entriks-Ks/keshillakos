import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import { createCategory, createCustomDomain, listAllDomains, updateCategory } from '../services/domainService'
import type { CategoryDoc, ExtensionField } from '../models/Category'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const domains = await listAllDomains(typeof req.query.portal === 'string' ? req.query.portal : undefined)
    return res.json({ domains })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan domenet',
    })
  }
})

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { portal, stableId, slug, labels, guidelines, parent, order, status, extensionFields, requirements, configRefs, labelSq, labelDe, examples, keywords } = req.body as {
      portal?: string; stableId?: string; slug?: string; labels?: Record<string, string>; guidelines?: Record<string, string>
      parent?: string; order?: number; status?: CategoryDoc['status']
      extensionFields?: ExtensionField[]; requirements?: string[]; configRefs?: CategoryDoc['configRefs']
      labelSq?: string
      labelDe?: string
      examples?: string[]
      keywords?: string[]
    }

    if (!labels?.sq?.trim() && !labelSq?.trim()) {
      return res.status(400).json({ message: 'Emri i kategorisë (SQ) është i detyrueshëm' })
    }

    const domain = stableId ? await createCategory({
      portal: portal || 'keshillakos', stableId, slug, labels: labels ?? { sq: labelSq!.trim(), de: labelDe?.trim() || labelSq!.trim() },
      parent, order, status, extensionFields, requirements, configRefs, examples, keywords, guidelines,
    }) : await createCustomDomain({
      labelSq: labelSq || labels!.sq,
      labelDe: labelDe?.trim() || labels?.de || labelSq || labels!.sq,
      examples, keywords, createdByUid: req.user!.uid,
    })

    return res.status(201).json({ domain })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Krijimi i kategorisë dështoi',
    })
  }
})

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const body = req.body as Partial<CategoryDoc>
    const domain = await updateCategory(String(req.params.id), {
      slug: body.slug, parent: body.parent, labels: body.labels, guidelines: body.guidelines, order: body.order,
      status: body.status, examples: body.examples, keywords: body.keywords,
      requirements: body.requirements, extensionFields: body.extensionFields, configRefs: body.configRefs,
    })
    return res.json({ domain })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Kategoria nuk u përditësua' }) }
})

export default router
